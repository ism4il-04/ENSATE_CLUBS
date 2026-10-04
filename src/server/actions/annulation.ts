"use server";

import { revalidatePath } from "next/cache";
import { evenementAnnule, notify } from "@/server/email/notifications";
import { AccessError, getSessionUser, requireOrganisation } from "@/server/permissions";
import { AnnulationError, annulerEvenement } from "@/server/services/annulation";

export type AnnulationResult = { ok: boolean; message: string };

/** Annule un événement (organisation principale ou coordinateur) et prévient les inscrits. */
export async function annulerEvenementAction(eventId: string, motif: string): Promise<AnnulationResult> {
  try {
    const user = await getSessionUser();
    if (!user) throw new AccessError("NON_AUTHENTIFIE");
    const coordinateur = user.role === "COORDINATEUR" || user.role === "ADMIN";
    const orgId = coordinateur ? undefined : (await requireOrganisation("gerer")).org.id;
    const evt = await annulerEvenement({ eventId, orgId, coordinateur });
    notify(() => evenementAnnule(eventId, motif.slice(0, 500), coordinateur));
    revalidatePath("/", "layout");
    return { ok: true, message: `« ${evt.titre} » est annulé. Les inscrits sont prévenus par email.` };
  } catch (e) {
    if (e instanceof AnnulationError) return { ok: false, message: e.message };
    if (e instanceof AccessError) return { ok: false, message: "Accès refusé." };
    console.error(e);
    return { ok: false, message: "Une erreur est survenue. Réessaie." };
  }
}
