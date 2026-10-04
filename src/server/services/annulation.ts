import "server-only";
import { and, eq } from "drizzle-orm";
import { schema as s } from "@/server/db";
import { withTx } from "@/server/db/tx";

export class AnnulationError extends Error {}

/**
 * Annulation d'un événement (BF-42) : l'événement et ses activités passent à ANNULE.
 * Les inscriptions sont conservées (historique, remboursements) ; les billets affichent l'annulation
 * et le contrôle d'entrée les refuse. Organisation principale : événement validé ou publié.
 * Coordinateur : tout événement non terminé.
 */
export async function annulerEvenement(p: { eventId: string; orgId?: string; coordinateur?: boolean }) {
  return withTx(async (tx) => {
    const [evt] = await tx.select().from(s.evenement).where(eq(s.evenement.id, p.eventId)).for("update");
    if (!evt || evt.structure === "SOUS_EVENEMENT") throw new AnnulationError("Événement introuvable.");
    if (!p.coordinateur) {
      const [link] = await tx
        .select()
        .from(s.organisationEvenement)
        .where(and(eq(s.organisationEvenement.idEvenement, evt.id), eq(s.organisationEvenement.role, "PRINCIPAL")));
      if (!link || link.idOrganisation !== p.orgId) throw new AnnulationError("Seule l'organisation principale peut annuler l'événement.");
      if (evt.statut !== "VALIDE" && evt.statut !== "PUBLIE") throw new AnnulationError("Cet événement ne peut plus être annulé.");
    } else if (evt.statut === "ANNULE" || evt.statut === "TERMINE" || evt.statut === "REFUSE") {
      throw new AnnulationError("Cet événement ne peut plus être annulé.");
    }
    const now = new Date();
    await tx.update(s.evenement).set({ statut: "ANNULE", inscriptionsOuvertes: false, dateMaj: now }).where(eq(s.evenement.id, evt.id));
    await tx.update(s.evenement).set({ statut: "ANNULE", inscriptionsOuvertes: false, dateMaj: now }).where(eq(s.evenement.idParent, evt.id));
    await tx.update(s.sessionStand).set({ actif: false }).where(eq(s.sessionStand.idEvenement, evt.id)); // ferme le stand
    return evt;
  });
}
