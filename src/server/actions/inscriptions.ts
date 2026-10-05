"use server";

import { revalidatePath } from "next/cache";
import { inscriptionEnregistree, notify, promotionListeAttente } from "@/server/email/notifications";
import { getSessionUser } from "@/server/permissions";
import { annulerParEtudiant, inscrire, InscriptionError, type InscriptionErreur } from "@/server/services/inscriptions";
import { MESSAGES_INSCRIPTION } from "@/lib/erreurs";

export type InscriptionState =
  | { ok: true; statut: "CONFIRMEE" | "LISTE_ATTENTE" | "PRE_INSCRITE"; inscriptionId: string }
  | { ok: false; code: InscriptionErreur | "NON_AUTHENTIFIE" | "ERREUR"; message: string }
  | null;

const MESSAGES = MESSAGES_INSCRIPTION;

function fail(code: keyof typeof MESSAGES): InscriptionState {
  return { ok: false, code: code as InscriptionErreur, message: MESSAGES[code] };
}

export async function inscrireEnLigne(_prev: InscriptionState, formData: FormData): Promise<InscriptionState> {
  const user = await getSessionUser();
  if (!user) return fail("NON_AUTHENTIFIE");
  const eventId = String(formData.get("eventId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  try {
    const { inscription } = await inscrire({
      compteId: user.id,
      role: user.role,
      eventId,
      source: "EN_LIGNE",
      telephone: (formData.get("telephone") as string | null) ?? null,
    });
    notify(() => inscriptionEnregistree(inscription.id));
    revalidatePath(`/evenements/${slug}`);
    revalidatePath("/moi/billets");
    return { ok: true, statut: inscription.statut as "CONFIRMEE", inscriptionId: inscription.id };
  } catch (e) {
    if (e instanceof InscriptionError) return fail(e.code);
    console.error(e);
    return fail("ERREUR");
  }
}

export async function annulerInscription(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  try {
    const { promu } = await annulerParEtudiant(user.id, String(formData.get("inscriptionId") ?? ""));
    if (promu) notify(() => promotionListeAttente(promu));
  } catch (e) {
    if (!(e instanceof InscriptionError)) throw e;
  }
  revalidatePath("/moi/billets");
  revalidatePath("/", "layout");
}
