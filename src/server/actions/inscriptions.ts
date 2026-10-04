"use server";

import { revalidatePath } from "next/cache";
import { inscriptionEnregistree, notify, promotionListeAttente } from "@/server/email/notifications";
import { getSessionUser } from "@/server/permissions";
import { annulerParEtudiant, inscrire, InscriptionError, type InscriptionErreur } from "@/server/services/inscriptions";

export type InscriptionState =
  | { ok: true; statut: "CONFIRMEE" | "LISTE_ATTENTE" | "PRE_INSCRITE"; inscriptionId: string }
  | { ok: false; code: InscriptionErreur | "NON_AUTHENTIFIE" | "ERREUR"; message: string }
  | null;

const MESSAGES: Record<string, string> = {
  NON_AUTHENTIFIE: "Connecte-toi pour t'inscrire.",
  INTROUVABLE: "Cet événement n'est plus disponible.",
  PROGRAMME_SANS_INSCRIPTION: "Inscris-toi aux activités du programme, une par une.",
  INSCRIPTION_STAND_UNIQUEMENT: "L'inscription se fait au stand du club.",
  INSCRIPTIONS_FERMEES: "Les inscriptions en ligne sont fermées.",
  RESERVE_ETUDIANTS_ENSA: "Cet événement est réservé aux étudiants de l'ENSA.",
  TELEPHONE_REQUIS: "Entre un numéro marocain valide, par exemple 06 12 34 56 78.",
  DEJA_INSCRIT: "Tu es déjà inscrit à cet événement.",
  EVENEMENT_COMPLET: "Il n'y a plus de place pour cet événement.",
  ACCES_REFUSE: "Ce compte ne peut pas s'inscrire aux événements.",
  ANNULATION_APRES_PAIEMENT: "Ton inscription est payée : contacte le club pour l'annuler.",
  ERREUR: "Une erreur est survenue. Réessaie.",
};

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
