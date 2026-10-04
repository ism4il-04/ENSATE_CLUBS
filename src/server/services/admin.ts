import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/server/db";
import { withTx } from "@/server/db/tx";
import { slugify } from "@/lib/dates";

export class AdminError extends Error {}

const COLORS = ["#C6F24E", "#7CC8FF", "#FFB547", "#FF8CC6", "#B79CFF", "#FF8A65"];
const email = z.string().trim().toLowerCase().email("Adresse email invalide.");

// ------------------------------------------------------------ organisations (BF-64)

export async function listOrganisationsAdmin() {
  const db = getDb();
  const orgs = await db
    .select({ org: s.organisation, email: s.compte.email, googleSub: s.compte.googleSub, derniereConnexion: s.compte.derniereConnexion })
    .from(s.organisation)
    .innerJoin(s.compte, eq(s.compte.id, s.organisation.idCompte))
    .orderBy(asc(s.organisation.nom));
  const counts = orgs.length
    ? await db
        .select({ id: s.organisationEvenement.idOrganisation, n: sql<number>`count(*)`.mapWith(Number) })
        .from(s.organisationEvenement)
        .where(inArray(s.organisationEvenement.idOrganisation, orgs.map((o) => o.org.id)))
        .groupBy(s.organisationEvenement.idOrganisation)
    : [];
  return orgs.map((o) => ({ ...o, evenements: counts.find((c) => c.id === o.org.id)?.n ?? 0 }));
}

export const OrgSchema = z.object({
  type: z.enum(["CLUB", "ASSOCIATION"]),
  nom: z.string().trim().min(3, "Nom trop court.").max(80),
  sigle: z.string().trim().max(6).optional().default(""),
  email,
});

/** Crée l'organisation et son compte (toute adresse Google, RG-02). Le compte s'active à la première connexion. */
export async function createOrganisation(input: z.input<typeof OrgSchema>, createurId: string) {
  const parsed = OrgSchema.safeParse(input);
  if (!parsed.success) throw new AdminError(parsed.error.issues[0]?.message);
  const d = parsed.data;
  return withTx(async (tx) => {
    const [taken] = await tx.select({ id: s.compte.id }).from(s.compte).where(eq(s.compte.email, d.email));
    if (taken) throw new AdminError("Un compte existe déjà avec cette adresse.");
    const [sameName] = await tx.select({ id: s.organisation.id }).from(s.organisation).where(eq(s.organisation.nom, d.nom));
    if (sameName) throw new AdminError("Une organisation porte déjà ce nom.");
    const [compte] = await tx.insert(s.compte).values({ email: d.email, role: "ORGANISATION", idCreateur: createurId }).returning({ id: s.compte.id });
    let slug = slugify(d.nom) || "organisation";
    const [slugTaken] = await tx.select({ id: s.organisation.id }).from(s.organisation).where(eq(s.organisation.slug, slug));
    if (slugTaken) slug = `${slug}-${randomBytes(2).toString("hex")}`;
    const initials = d.sigle || d.nom.split(/\s+/).filter((w) => w.length > 2).map((w) => w[0].toUpperCase()).slice(-2).join("");
    await tx.insert(s.organisation).values({
      type: d.type,
      nom: d.nom,
      sigle: initials || null,
      slug,
      couleur: COLORS[d.nom.length % COLORS.length],
      idCompte: compte.id,
    });
    return d.nom;
  });
}

export async function setOrganisationStatut(id: string, active: boolean) {
  const [org] = await getDb()
    .update(s.organisation)
    .set({ statut: active ? "ACTIVE" : "INACTIVE" })
    .where(eq(s.organisation.id, id))
    .returning({ nom: s.organisation.nom });
  if (!org) throw new AdminError("Organisation introuvable.");
  return org.nom;
}

// ------------------------------------------------------------ lieux (BF-65)

export async function listLieuxAdmin() {
  return getDb().select().from(s.lieu).orderBy(asc(s.lieu.code));
}

export const LieuSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(12).regex(/^[A-Z0-9_-]+$/, "Code : lettres, chiffres, - ou _."),
  nom: z.string().trim().min(2).max(60),
  type: z.enum(s.typeLieu.enumValues),
  etage: z.number().int().min(-2).max(10).nullable(),
  capacite: z.number().int().positive().nullable(),
});

export async function createLieu(input: z.input<typeof LieuSchema>) {
  const parsed = LieuSchema.safeParse(input);
  if (!parsed.success) throw new AdminError(parsed.error.issues[0]?.message);
  const rows = await getDb().insert(s.lieu).values(parsed.data).onConflictDoNothing().returning({ nom: s.lieu.nom });
  if (!rows.length) throw new AdminError("Ce code existe déjà.");
  return rows[0].nom;
}

export async function setLieuActif(id: string, actif: boolean) {
  const [row] = await getDb().update(s.lieu).set({ actif }).where(eq(s.lieu.id, id)).returning({ nom: s.lieu.nom });
  if (!row) throw new AdminError("Lieu introuvable.");
  return row.nom;
}

// ------------------------------------------------------------ comptes (BF-80, BF-82)

export async function listComptes() {
  return getDb()
    .select({ compte: s.compte, prenom: s.personne.prenom, nom: s.personne.nom, organisation: s.organisation.nom })
    .from(s.compte)
    .leftJoin(s.personne, eq(s.personne.idCompte, s.compte.id))
    .leftJoin(s.organisation, eq(s.organisation.idCompte, s.compte.id))
    .orderBy(desc(s.compte.dateCreation))
    .limit(500);
}

export const CompteSchema = z.object({
  email,
  role: z.enum(["COORDINATEUR", "ADMIN", "ETUDIANT", "EXTERNE"]),
  prenom: z.string().trim().max(60).optional().default(""),
  nom: z.string().trim().max(60).optional().default(""),
});

/** Compte créé par l'admin, avec n'importe quelle adresse Google (RG-02). */
export async function createCompte(input: z.input<typeof CompteSchema>, createurId: string) {
  const parsed = CompteSchema.safeParse(input);
  if (!parsed.success) throw new AdminError(parsed.error.issues[0]?.message);
  const d = parsed.data;
  return withTx(async (tx) => {
    const [taken] = await tx.select({ id: s.compte.id }).from(s.compte).where(eq(s.compte.email, d.email));
    if (taken) throw new AdminError("Un compte existe déjà avec cette adresse.");
    const [c] = await tx.insert(s.compte).values({ email: d.email, role: d.role, idCreateur: createurId }).returning({ id: s.compte.id });
    await tx.insert(s.personne).values({ idCompte: c.id, prenom: d.prenom || d.email.split("@")[0], nom: d.nom });
    return d.email;
  });
}

export async function setCompteStatut(id: string, actif: boolean, selfId: string) {
  if (id === selfId) throw new AdminError("Tu ne peux pas suspendre ton propre compte.");
  const [row] = await getDb()
    .update(s.compte)
    .set({ statut: actif ? "ACTIF" : "SUSPENDU" })
    .where(eq(s.compte.id, id))
    .returning({ email: s.compte.email });
  if (!row) throw new AdminError("Compte introuvable.");
  return row.email;
}

// ------------------------------------------------------------ statistiques (BF-66, RG-22 : aucun montant)

export async function statistiques(from: Date, to: Date) {
  const db = getDb();
  const cs = await db
    .select({ idEvenement: s.creneau.idEvenement })
    .from(s.creneau)
    .where(and(gte(s.creneau.debut, from), lt(s.creneau.debut, to)));
  const evtIds = [...new Set(cs.map((c) => c.idEvenement))];
  if (!evtIds.length) return { parOrg: [], parCategorie: [], totalConfirmes: 0, totalPresents: 0, evenements: 0 };
  const evts = await db
    .select({ id: s.evenement.id, idParent: s.evenement.idParent, categorie: s.evenement.categorie, statut: s.evenement.statut })
    .from(s.evenement)
    .where(and(inArray(s.evenement.id, evtIds), inArray(s.evenement.statut, ["PUBLIE", "TERMINE"])));
  const ids = evts.map((e) => e.id);
  if (!ids.length) return { parOrg: [], parCategorie: [], totalConfirmes: 0, totalPresents: 0, evenements: 0 };
  const roots = [...new Set(evts.map((e) => e.idParent ?? e.id))];
  // Uniquement des comptages : aucune colonne de montant n'est lue.
  const [inscrits, presents, liens] = await Promise.all([
    db
      .select({ id: s.inscription.idEvenement, n: sql<number>`count(*)`.mapWith(Number) })
      .from(s.inscription)
      .where(and(inArray(s.inscription.idEvenement, ids), eq(s.inscription.statut, "CONFIRMEE")))
      .groupBy(s.inscription.idEvenement),
    db
      .select({ id: s.inscription.idEvenement, n: sql<number>`count(distinct ${s.inscription.id})`.mapWith(Number) })
      .from(s.presence)
      .innerJoin(s.inscription, eq(s.inscription.id, s.presence.idInscription))
      .where(inArray(s.inscription.idEvenement, ids))
      .groupBy(s.inscription.idEvenement),
    db
      .select({ idEvenement: s.organisationEvenement.idEvenement, nom: s.organisation.nom })
      .from(s.organisationEvenement)
      .innerJoin(s.organisation, eq(s.organisation.id, s.organisationEvenement.idOrganisation))
      .where(and(inArray(s.organisationEvenement.idEvenement, roots), eq(s.organisationEvenement.role, "PRINCIPAL"))),
  ]);
  const byOrg = new Map<string, { confirmes: number; presents: number }>();
  const byCat = new Map<string, number>();
  for (const e of evts) {
    const nom = liens.find((l) => l.idEvenement === (e.idParent ?? e.id))?.nom ?? "—";
    const cur = byOrg.get(nom) ?? { confirmes: 0, presents: 0 };
    cur.confirmes += inscrits.find((x) => x.id === e.id)?.n ?? 0;
    cur.presents += presents.find((x) => x.id === e.id)?.n ?? 0;
    byOrg.set(nom, cur);
    byCat.set(e.categorie, (byCat.get(e.categorie) ?? 0) + 1);
  }
  const parOrg = [...byOrg.entries()].map(([nom, v]) => ({ nom, ...v })).sort((a, b) => b.confirmes - a.confirmes);
  return {
    parOrg,
    parCategorie: [...byCat.entries()].map(([categorie, n]) => ({ categorie, n })).sort((a, b) => b.n - a.n),
    totalConfirmes: parOrg.reduce((a, x) => a + x.confirmes, 0),
    totalPresents: parOrg.reduce((a, x) => a + x.presents, 0),
    evenements: evts.length,
  };
}
