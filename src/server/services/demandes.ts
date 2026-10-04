import "server-only";
import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@/server/db";
import { withTx, type Tx } from "@/server/db/tx";
import { slugify, zonedToUtc } from "@/lib/dates";
import { periodeDe, periodesEntre } from "./periodes";

const Creneau = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date manquante"),
  debut: z.string().regex(/^\d{2}:\d{2}$/),
  fin: z.string().regex(/^\d{2}:\d{2}$/),
  lieux: z.array(z.object({ idLieu: z.string().uuid(), precision: z.string().trim().max(120).optional() })).min(1, "au moins un lieu"),
});

export const DemandeSchema = z.object({
  id: z.string().uuid().optional(),
  structure: z.enum(["SIMPLE", "PROGRAMME"]),
  titre: z.string().trim().min(3, "titre trop court").max(120),
  categorie: z.enum(s.categorieEvenement.enumValues),
  descriptionCourte: z.string().trim().max(600).optional().default(""),
  creneaux: z.array(Creneau).default([]),
  activites: z.array(z.object({ titre: z.string().trim().min(2, "nom d'activité manquant").max(120), creneau: Creneau })).default([]),
  partenaires: z.array(z.string().uuid()).max(10).default([]),
  idOrganisationPrincipale: z.string().uuid().optional(),
});
export type DemandeInput = z.input<typeof DemandeSchema>;

export class DemandeError extends Error {
  constructor(public erreurs: string[]) {
    super(erreurs.join(" "));
  }
}

const COLORS = ["#B79CFF", "#7CC8FF", "#FFB547", "#FF8CC6", "#FF8A65", "#C6F24E"];
const pickColor = (seed: string) => COLORS[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

/** Créneau saisi → instants UTC ; une fin avant le début compte pour le lendemain (soirée). */
function toInstants(c: z.infer<typeof Creneau>) {
  const debut = zonedToUtc(c.date, c.debut);
  let fin = zonedToUtc(c.date, c.fin);
  if (fin <= debut) fin = new Date(fin.getTime() + 24 * 3600 * 1000);
  return { debut, fin };
}

async function uniqueSlug(tx: Tx, titre: string) {
  const base = slugify(titre) || "evenement";
  const taken = await tx.select({ slug: s.evenement.slug }).from(s.evenement).where(eq(s.evenement.slug, base));
  return taken.length ? `${base}-${randomBytes(2).toString("hex")}` : base;
}

async function insertCreneaux(tx: Tx, eventId: string, creneaux: z.infer<typeof Creneau>[], autreIds: Set<string>) {
  for (const c of creneaux) {
    const { debut, fin } = toInstants(c);
    const [row] = await tx.insert(s.creneau).values({ idEvenement: eventId, debut, fin }).returning({ id: s.creneau.id });
    await tx.insert(s.creneauLieu).values(
      c.lieux.map((l) => ({ idCreneau: row.id, idLieu: l.idLieu, precision: autreIds.has(l.idLieu) ? l.precision?.trim() || null : null })),
    );
  }
}

/** Validation métier (RG-05, RG-06) au-delà du schéma. */
function check(d: z.infer<typeof DemandeSchema>, autreIds: Set<string>, submit: boolean) {
  const errs: string[] = [];
  const word = d.structure === "PROGRAMME" ? "Activité" : "Créneau";
  const list = d.structure === "PROGRAMME" ? d.activites.map((a) => a.creneau) : d.creneaux;
  if (submit && !list.length) errs.push(d.structure === "PROGRAMME" ? "Ajoute au moins une activité." : "Ajoute au moins un créneau.");
  list.forEach((c, i) => {
    const { debut, fin } = toInstants(c);
    if (fin.getTime() - debut.getTime() > 24 * 3600 * 1000) errs.push(`${word} ${i + 1} : durée supérieure à 24 h.`);
    if (c.lieux.some((l) => autreIds.has(l.idLieu) && !l.precision?.trim())) errs.push(`${word} ${i + 1} : précise le lieu « Autre ».`);
    if (submit && debut.getTime() < Date.now()) errs.push(`${word} ${i + 1} : la date est passée.`);
  });
  if (errs.length) throw new DemandeError(errs);
}

/** BF-67 : un club ne soumet pas de créneau dans une période bloquée (le coordinateur, si). */
async function checkPeriodes(d: z.infer<typeof DemandeSchema>) {
  const word = d.structure === "PROGRAMME" ? "Activité" : "Créneau";
  const list = d.structure === "PROGRAMME" ? d.activites.map((a) => a.creneau) : d.creneaux;
  if (!list.length) return;
  const dates = list.map((c) => c.date).sort();
  const periodes = await periodesEntre(dates[0], dates.at(-1)!);
  const errs = list.flatMap((c, i) => {
    const p = periodeDe(c.date, periodes);
    return p ? [`${word} ${i + 1} : le ${c.date.split("-").reverse().join("/")} tombe pendant « ${p.libelle} » (période bloquée). Choisis une autre date ou contacte le coordinateur.`] : [];
  });
  if (errs.length) throw new DemandeError(errs);
}

/**
 * Crée ou met à jour une demande (BROUILLON / MODIF_DEMANDEE), puis la soumet si `submit`.
 * Mode coordinateur : l'événement est créé directement VALIDE (RG-27).
 */
export async function saveDemande(input: DemandeInput, ctx: { compteId: string; orgId?: string; coordinateur?: boolean; submit: boolean }) {
  const parsed = DemandeSchema.safeParse(input);
  if (!parsed.success) throw new DemandeError(parsed.error.issues.map((i) => i.message));
  const d = parsed.data;

  return withTx(async (tx) => {
    const autres = await tx.select({ id: s.lieu.id }).from(s.lieu).where(eq(s.lieu.code, "AUTRE"));
    const autreIds = new Set(autres.map((a) => a.id));
    check(d, autreIds, ctx.submit);
    if (ctx.submit && !ctx.coordinateur) await checkPeriodes(d);

    const principal = ctx.coordinateur ? d.idOrganisationPrincipale : ctx.orgId;
    if (!principal) throw new DemandeError(["Choisis l'organisation principale."]);
    const partenaires = [...new Set(d.partenaires)].filter((p) => p !== principal);

    let eventId = d.id;
    if (eventId) {
      const [evt] = await tx.select().from(s.evenement).where(eq(s.evenement.id, eventId)).for("update");
      const [link] = evt
        ? await tx
            .select()
            .from(s.organisationEvenement)
            .where(eq(s.organisationEvenement.idEvenement, evt.id))
            .then((rows) => rows.filter((r) => r.role === "PRINCIPAL"))
        : [];
      if (!evt || (!ctx.coordinateur && link?.idOrganisation !== ctx.orgId)) throw new DemandeError(["Demande introuvable."]);
      if (evt.statut !== "BROUILLON" && evt.statut !== "MODIF_DEMANDEE") throw new DemandeError(["Cette demande n'est plus modifiable : contacte le coordinateur."]);
      await tx
        .update(s.evenement)
        .set({ structure: d.structure, titre: d.titre, categorie: d.categorie, descriptionCourte: d.descriptionCourte || null, modeInscription: d.structure === "PROGRAMME" ? "AUCUNE" : evt.modeInscription === "AUCUNE" ? "EN_LIGNE" : evt.modeInscription, dateMaj: new Date() })
        .where(eq(s.evenement.id, eventId));
      // On reconstruit créneaux, sous-événements et organisateurs (rien n'est encore publié).
      const subs = await tx.select({ id: s.evenement.id }).from(s.evenement).where(eq(s.evenement.idParent, eventId));
      if (subs.length) await tx.delete(s.evenement).where(inArray(s.evenement.id, subs.map((x) => x.id)));
      await tx.delete(s.creneau).where(eq(s.creneau.idEvenement, eventId));
      await tx.delete(s.organisationEvenement).where(eq(s.organisationEvenement.idEvenement, eventId));
    } else {
      const [row] = await tx
        .insert(s.evenement)
        .values({
          structure: d.structure,
          titre: d.titre,
          slug: await uniqueSlug(tx, d.titre),
          categorie: d.categorie,
          descriptionCourte: d.descriptionCourte || null,
          couleur: pickColor(d.titre),
          modeInscription: d.structure === "PROGRAMME" ? "AUCUNE" : "EN_LIGNE",
          idCreateur: ctx.compteId,
        })
        .returning({ id: s.evenement.id });
      eventId = row.id;
    }

    await tx.insert(s.organisationEvenement).values([
      { idEvenement: eventId, idOrganisation: principal, role: "PRINCIPAL" as const },
      ...partenaires.map((p) => ({ idEvenement: eventId!, idOrganisation: p, role: "PARTENAIRE" as const })),
    ]);

    if (d.structure === "SIMPLE") {
      await insertCreneaux(tx, eventId, d.creneaux, autreIds);
    } else {
      for (const a of d.activites) {
        const [sub] = await tx
          .insert(s.evenement)
          .values({
            structure: "SOUS_EVENEMENT",
            titre: a.titre,
            slug: await uniqueSlug(tx, `${d.titre} ${a.titre}`),
            categorie: d.categorie,
            couleur: pickColor(a.titre),
            modeInscription: "EN_LIGNE",
            idParent: eventId,
            idCreateur: ctx.compteId,
          })
          .returning({ id: s.evenement.id });
        await insertCreneaux(tx, sub.id, [a.creneau], autreIds);
      }
    }

    if (ctx.submit) {
      const statut = ctx.coordinateur ? "VALIDE" : "EN_ATTENTE";
      await tx.update(s.evenement).set({ statut, dateMaj: new Date() }).where(eq(s.evenement.id, eventId));
      await tx.update(s.evenement).set({ statut }).where(eq(s.evenement.idParent, eventId));
      if (ctx.coordinateur) {
        await tx.insert(s.decision).values({ idEvenement: eventId, idCoordinateur: ctx.compteId, decision: "VALIDE", commentaire: "Créé par le coordinateur" });
      }
    }
    return { id: eventId };
  });
}
