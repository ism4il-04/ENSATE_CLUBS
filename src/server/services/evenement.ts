import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { CATEGORIES, type CategorieKey } from "@/lib/format";
import { schema as s } from "@/server/db";
import { withTx } from "@/server/db/tx";

// Modifications d'un événement par l'organisation principale (ou le coordinateur), hors créneaux (RG-08).

export class EvenementError extends Error {}

export const InfosSchema = z.object({
  titre: z.string().trim().min(3, "Titre trop court.").max(120, "Titre trop long (120 caractères max)."),
  categorie: z.enum(Object.keys(CATEGORIES) as [CategorieKey, ...CategorieKey[]], { error: "Catégorie invalide." }),
  descriptionCourte: z.string().trim().max(600, "Description courte trop longue (600 caractères max).").default(""),
});

async function verrouiller(tx: Parameters<Parameters<typeof withTx>[0]>[0], eventId: string, ctx: { orgId?: string; coordinateur?: boolean }) {
  const [evt] = await tx.select().from(s.evenement).where(eq(s.evenement.id, eventId)).for("update");
  if (!evt) throw new EvenementError("Événement introuvable.");
  if (!ctx.coordinateur) {
    const racine = evt.idParent ?? evt.id;
    const [lien] = await tx
      .select()
      .from(s.organisationEvenement)
      .where(and(eq(s.organisationEvenement.idEvenement, racine), eq(s.organisationEvenement.role, "PRINCIPAL")));
    if (!lien || lien.idOrganisation !== ctx.orgId) throw new EvenementError("Seule l'organisation principale peut modifier l'événement.");
  }
  return evt;
}

/**
 * Titre, catégorie et description courte d'un événement validé ou publié.
 * L'adresse de la page (slug) ne change pas : les liens déjà partagés restent valides.
 */
export async function modifierInfos(eventId: string, input: z.input<typeof InfosSchema>, ctx: { orgId?: string; coordinateur?: boolean }) {
  const parsed = InfosSchema.safeParse(input);
  if (!parsed.success) throw new EvenementError(parsed.error.issues[0]?.message ?? "Informations invalides.");
  const d = parsed.data;
  return withTx(async (tx) => {
    const evt = await verrouiller(tx, eventId, ctx);
    if (evt.statut !== "VALIDE" && evt.statut !== "PUBLIE") throw new EvenementError("Ces informations se modifient une fois la demande validée.");
    await tx
      .update(s.evenement)
      .set({ titre: d.titre, categorie: d.categorie, descriptionCourte: d.descriptionCourte || null, dateMaj: new Date() })
      .where(eq(s.evenement.id, evt.id));
    return { slug: evt.slug };
  });
}

/** Reprendre une demande envoyée (EN_ATTENTE → BROUILLON) pour la modifier, puis la renvoyer. */
export async function reprendreDemande(eventId: string, orgId: string) {
  return withTx(async (tx) => {
    const evt = await verrouiller(tx, eventId, { orgId });
    if (evt.statut !== "EN_ATTENTE") throw new EvenementError("Seule une demande en attente peut être reprise.");
    await tx.update(s.evenement).set({ statut: "BROUILLON", dateMaj: new Date() }).where(eq(s.evenement.id, evt.id));
    await tx.update(s.evenement).set({ statut: "BROUILLON" }).where(eq(s.evenement.idParent, evt.id));
    return evt;
  });
}

/** Vérifie qu'une demande de changement de créneaux est recevable (le message part ensuite par email). */
export async function verifierDemandeChangement(eventId: string, orgId: string, message: string) {
  const texte = message.trim();
  if (texte.length < 10) throw new EvenementError("Explique le changement souhaité (10 caractères minimum).");
  if (texte.length > 1000) throw new EvenementError("Message trop long (1000 caractères max).");
  return withTx(async (tx) => {
    const evt = await verrouiller(tx, eventId, { orgId });
    if (evt.statut !== "VALIDE" && evt.statut !== "PUBLIE") throw new EvenementError("Avant validation, modifie directement ta demande.");
    return { evt, texte };
  });
}
