import "server-only";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/server/db";
import { withTx } from "@/server/db/tx";

// BF-45 : annonce d'une organisation aux inscrits d'un événement (email + affichée sur le billet).

export const CIBLES = {
  CONFIRMES: ["CONFIRMEE"],
  INSCRITS: ["CONFIRMEE", "PRE_INSCRITE"],
  TOUS: ["CONFIRMEE", "PRE_INSCRITE", "LISTE_ATTENTE"],
} as const;
export type Cible = keyof typeof CIBLES;

export const MAX_PAR_JOUR = 3;

export const AnnonceSchema = z.object({
  titre: z.string().trim().min(3, "Titre trop court.").max(120, "Titre trop long (120 caractères max)."),
  contenu: z.string().trim().min(10, "Message trop court.").max(2000, "Message trop long (2000 caractères max)."),
  cible: z.enum(["CONFIRMES", "INSCRITS", "TOUS"], { error: "Destinataires invalides." }),
});

export class AnnonceError extends Error {}

/** Identifiants de l'événement et de ses activités (un programme s'adresse aux inscrits de toutes ses activités). */
async function famille(eventId: string) {
  const subs = await getDb().select({ id: s.evenement.id }).from(s.evenement).where(eq(s.evenement.idParent, eventId));
  return [eventId, ...subs.map((x) => x.id)];
}

export async function compterDestinataires(eventId: string) {
  const ids = await famille(eventId);
  const rows = await getDb()
    .select({ statut: s.inscription.statut, n: sql<number>`count(distinct ${s.inscription.idCompte})`.mapWith(Number) })
    .from(s.inscription)
    .where(inArray(s.inscription.idEvenement, ids))
    .groupBy(s.inscription.statut);
  const n = (st: readonly string[]) => rows.filter((r) => st.includes(r.statut)).reduce((a, r) => a + r.n, 0);
  return { CONFIRMES: n(CIBLES.CONFIRMES), INSCRITS: n(CIBLES.INSCRITS), TOUS: n(CIBLES.TOUS) };
}

/** Enregistre l'annonce et renvoie les destinataires (comptes actifs, sans doublon). */
export async function creerAnnonce(p: { eventId: string; orgId: string; auteurId: string; input: z.input<typeof AnnonceSchema> }) {
  const parsed = AnnonceSchema.safeParse(p.input);
  if (!parsed.success) throw new AnnonceError(parsed.error.issues[0]?.message ?? "Annonce invalide.");
  const d = parsed.data;
  const ids = await famille(p.eventId);

  return withTx(async (tx) => {
    const [evt] = await tx.select().from(s.evenement).where(eq(s.evenement.id, p.eventId)).for("update");
    if (!evt || (evt.statut !== "PUBLIE" && evt.statut !== "TERMINE")) throw new AnnonceError("Les annonces sont possibles pour un événement publié ou terminé.");
    const [{ recentes }] = await tx
      .select({ recentes: sql<number>`count(*)`.mapWith(Number) })
      .from(s.annonce)
      .where(and(eq(s.annonce.idEvenement, evt.id), gt(s.annonce.datePublication, sql`now() - interval '24 hours'`)));
    if (recentes >= MAX_PAR_JOUR) throw new AnnonceError(`${MAX_PAR_JOUR} annonces maximum par 24 h pour un événement : regroupe tes informations.`);

    const destinataires = await tx
      .selectDistinctOn([s.compte.id], { idInscription: s.inscription.id, email: s.compte.email, prenom: s.personne.prenom })
      .from(s.inscription)
      .innerJoin(s.compte, eq(s.compte.id, s.inscription.idCompte))
      .leftJoin(s.personne, eq(s.personne.idCompte, s.compte.id))
      .where(and(inArray(s.inscription.idEvenement, ids), inArray(s.inscription.statut, [...CIBLES[d.cible]]), eq(s.compte.statut, "ACTIF")));
    if (!destinataires.length) throw new AnnonceError("Aucun inscrit ne correspond à ces destinataires.");

    const [row] = await tx
      .insert(s.annonce)
      .values({ titre: d.titre, contenu: d.contenu, cible: d.cible, destinataires: destinataires.length, idEvenement: evt.id, idOrganisation: p.orgId, idAuteur: p.auteurId })
      .returning({ id: s.annonce.id });
    return { id: row.id, nombre: destinataires.length, destinataires };
  });
}

/** Annonces encore possibles sur les 24 dernières heures. */
export async function annoncesRestantes(eventId: string) {
  const [{ n }] = await getDb()
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(s.annonce)
    .where(and(eq(s.annonce.idEvenement, eventId), gt(s.annonce.datePublication, sql`now() - interval '24 hours'`)));
  return Math.max(0, MAX_PAR_JOUR - n);
}

export async function listAnnonces(eventId: string) {
  return getDb()
    .select({ id: s.annonce.id, titre: s.annonce.titre, contenu: s.annonce.contenu, destinataires: s.annonce.destinataires, date: s.annonce.datePublication, org: s.organisation.nom })
    .from(s.annonce)
    .innerJoin(s.organisation, eq(s.organisation.id, s.annonce.idOrganisation))
    .where(eq(s.annonce.idEvenement, eventId))
    .orderBy(desc(s.annonce.datePublication));
}

/** Annonces visibles sur le billet d'un participant : celles de l'événement et de son programme parent, qui le visaient. */
export async function annoncesPourBillet(evt: { id: string; idParent: string | null }, statut: string) {
  const ids = evt.idParent ? [evt.id, evt.idParent] : [evt.id];
  const cibles = (Object.keys(CIBLES) as Cible[]).filter((c) => (CIBLES[c] as readonly string[]).includes(statut));
  if (!cibles.length) return [];
  return getDb()
    .select({ id: s.annonce.id, titre: s.annonce.titre, contenu: s.annonce.contenu, date: s.annonce.datePublication, org: s.organisation.nom })
    .from(s.annonce)
    .innerJoin(s.organisation, eq(s.organisation.id, s.annonce.idOrganisation))
    .where(and(inArray(s.annonce.idEvenement, ids), inArray(s.annonce.cible, cibles)))
    .orderBy(desc(s.annonce.datePublication))
    .limit(10);
}
