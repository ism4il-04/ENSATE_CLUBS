"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { inscriptionEnregistree, notify } from "@/server/email/notifications";
import { AccessError, getSessionUser, requireOrganisation, roleOnEvent } from "@/server/permissions";
import { inscrire, InscriptionError } from "@/server/services/inscriptions";
import { checkStandCookie, fermerSession, ouvrirSession, sessionPourInscription, standCookieName } from "@/server/services/stand";
import type { InscriptionState } from "./inscriptions";

export async function ouvrirStandAction(eventId: string) {
  const { user, org } = await requireOrganisation("caisse");
  if (!(await roleOnEvent(org.id, eventId))) throw new AccessError("ACCES_REFUSE");
  await ouvrirSession({ eventId, orgId: org.id, compteId: user.id });
  revalidatePath(`/org/evenements/${eventId}/stand`);
}

export async function fermerStandAction(eventId: string, sessionId: string) {
  const { org } = await requireOrganisation("caisse");
  await fermerSession(sessionId, org.id);
  revalidatePath(`/org/evenements/${eventId}/stand`);
}

const MESSAGES: Record<string, string> = {
  TELEPHONE_REQUIS: "Entre un numéro marocain valide, par exemple 06 12 34 56 78.",
  DEJA_INSCRIT: "Tu es déjà inscrit : montre ton billet au stand.",
  EVENEMENT_COMPLET: "Il n'y a plus de place pour cet événement.",
  RESERVE_ETUDIANTS_ENSA: "Cet événement est réservé aux étudiants de l'ENSA.",
  ACCES_REFUSE: "Ce compte ne peut pas s'inscrire aux événements.",
};

/** Inscription au stand (source STAND) : exige le cookie « accès stand » valide (RG-14, RG-15). */
export async function inscrireAuStand(_prev: InscriptionState, formData: FormData): Promise<InscriptionState> {
  const sessionId = String(formData.get("sessionId") ?? "");
  const user = await getSessionUser();
  if (!user) return { ok: false, code: "NON_AUTHENTIFIE", message: "Connecte-toi pour t'inscrire." };
  const jar = await cookies();
  if (!checkStandCookie(sessionId, jar.get(standCookieName(sessionId))?.value)) {
    return { ok: false, code: "ERREUR", message: "Le QR a expiré : scanne à nouveau le QR affiché au stand." };
  }
  const ctx = await sessionPourInscription(sessionId);
  if (!ctx) return { ok: false, code: "ERREUR", message: "Le stand est fermé." };
  try {
    const { inscription } = await inscrire({
      compteId: user.id,
      role: user.role,
      eventId: ctx.evt.id,
      source: "STAND",
      telephone: (formData.get("telephone") as string | null) ?? null,
      sessionStandId: sessionId,
    });
    notify(() => inscriptionEnregistree(inscription.id));
    revalidatePath(`/org/evenements/${ctx.evt.id}/stand`);
    return { ok: true, statut: inscription.statut as "CONFIRMEE", inscriptionId: inscription.id };
  } catch (e) {
    if (e instanceof InscriptionError) return { ok: false, code: e.code, message: MESSAGES[e.code] ?? "Inscription impossible." };
    console.error(e);
    return { ok: false, code: "ERREUR", message: "Une erreur est survenue. Réessaie." };
  }
}
