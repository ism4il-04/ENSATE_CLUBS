"use server";

import { revalidatePath } from "next/cache";
import { AccessError, requireRole } from "@/server/permissions";
import { decider, DecisionError, remplacerCreneaux } from "@/server/services/coord";

export type CoordResult = { ok: boolean; message: string };

export async function deciderAction(eventId: string, decision: "VALIDE" | "REFUSE" | "MODIF_DEMANDEE", commentaire: string): Promise<CoordResult> {
  try {
    const user = await requireRole("COORDINATEUR", "ADMIN");
    const evt = await decider({ eventId, coordId: user.id, decision, commentaire });
    revalidatePath("/coord");
    revalidatePath("/org");
    const msg = { VALIDE: `« ${evt.titre} » validé : le club peut le publier.`, MODIF_DEMANDEE: "Modification demandée au club.", REFUSE: `« ${evt.titre} » refusé : le club voit ton commentaire.` };
    return { ok: true, message: msg[decision] };
  } catch (e) {
    if (e instanceof DecisionError) return { ok: false, message: e.message };
    if (e instanceof AccessError) return { ok: false, message: "Accès refusé." };
    console.error(e);
    return { ok: false, message: "Une erreur est survenue. Réessaie." };
  }
}

export async function remplacerCreneauxAction(
  eventId: string,
  creneaux: { date: string; debut: string; fin: string; lieux: { idLieu: string; precision?: string }[] }[],
): Promise<CoordResult> {
  try {
    await requireRole("COORDINATEUR", "ADMIN");
    const evt = await remplacerCreneaux(eventId, creneaux);
    revalidatePath("/coord", "layout");
    revalidatePath(`/evenements/${evt.slug}`);
    return { ok: true, message: "Créneaux mis à jour." };
  } catch (e) {
    if (e instanceof DecisionError) return { ok: false, message: e.message };
    if (e instanceof AccessError) return { ok: false, message: "Accès refusé." };
    console.error(e);
    return { ok: false, message: "Une erreur est survenue. Réessaie." };
  }
}
