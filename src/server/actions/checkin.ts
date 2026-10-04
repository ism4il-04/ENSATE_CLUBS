"use server";

import { AccessError, requireOrganisation, roleOnEvent } from "@/server/permissions";
import { checkin, type CheckinResult } from "@/server/services/checkin";

export type CheckinView =
  | { kind: "VALIDE"; nom: string }
  | { kind: "DEJA_PRESENT"; nom: string; a: string }
  | { kind: "NON_CONFIRMEE"; nom: string; statut: string }
  | { kind: "BILLET_INVALIDE" }
  | { kind: "CRENEAU_HORS_JOUR" }
  | { kind: "EVENEMENT_ANNULE" }
  | { kind: "ACCES_REFUSE" };

/** Le QR du billet contient uniquement le jeton (RG-20). Organisation principale ou partenaire. */
export async function checkinAction(eventId: string, creneauId: string, input: { token?: string; inscriptionId?: string }): Promise<CheckinView> {
  try {
    const { user, org } = await requireOrganisation();
    if (!(await roleOnEvent(org.id, eventId))) throw new AccessError("ACCES_REFUSE");
    const token = input.token?.trim().split("/").pop();
    const r: CheckinResult = await checkin({ eventId, creneauId, scannerId: user.id, token: token || undefined, inscriptionId: input.inscriptionId });
    return r.kind === "DEJA_PRESENT" ? { ...r, a: r.a.toISOString() } : r;
  } catch (e) {
    if (e instanceof AccessError) return { kind: "ACCES_REFUSE" };
    throw e;
  }
}
