"use server";

import { revalidatePath } from "next/cache";
import {
  evenementComplet,
  inscriptionAnnuleeParClub,
  notify,
  paiementEnregistre,
  placeMembreAttribuee,
  promotionListeAttente,
} from "@/server/email/notifications";
import { AccessError, requireOrganisation, roleOnEvent, type Capacite } from "@/server/permissions";
import {
  annulerPaiement,
  annulerParOrganisation,
  attribuerPlaceMembre,
  CaisseError,
  chercherEtudiants,
  marquerPaye,
  trouverParBillet,
} from "@/server/services/caisse";
import { MESSAGES_CAISSE } from "@/lib/erreurs";

export type CaisseResult = { ok: boolean; message: string };

const MESSAGES = MESSAGES_CAISSE;

/** Organisation principale ou partenaire de l'événement. */
async function organiser(eventId: string, cap: Capacite = "caisse") {
  const { user, org } = await requireOrganisation(cap);
  if (!(await roleOnEvent(org.id, eventId))) throw new AccessError("ACCES_REFUSE");
  return { user, org };
}

async function wrap(eventId: string, fn: () => Promise<string>): Promise<CaisseResult> {
  try {
    const message = await fn();
    revalidatePath(`/org/evenements/${eventId}/inscrits`);
    revalidatePath(`/org/evenements/${eventId}/stand`);
    return { ok: true, message };
  } catch (e) {
    if (e instanceof CaisseError) return { ok: false, message: MESSAGES[e.code] ?? e.code };
    if (e instanceof AccessError) return { ok: false, message: "Accès refusé." };
    console.error(e);
    return { ok: false, message: "Une erreur est survenue. Réessaie." };
  }
}

export async function payerAction(eventId: string, inscriptionId: string, tarifId: string, nom: string) {
  return wrap(eventId, async () => {
    const { org } = await organiser(eventId);
    const r = await marquerPaye({ eventId, inscriptionId, tarifId, orgId: org.id });
    notify(() => paiementEnregistre(inscriptionId));
    if (r.complet) notify(() => evenementComplet(eventId));
    return `${nom} : ${r.tarif} · ${r.montant} DH enregistré.`;
  });
}

export async function annulerPaiementAction(eventId: string, inscriptionId: string, nom: string) {
  return wrap(eventId, async () => {
    const { org } = await organiser(eventId);
    await annulerPaiement({ eventId, inscriptionId, orgId: org.id });
    return `Paiement annulé : ${nom} redevient pré-inscrit.`;
  });
}

export async function annulerInscriptionAction(eventId: string, inscriptionId: string, nom: string) {
  return wrap(eventId, async () => {
    const { org, user } = await organiser(eventId);
    const { promu } = await annulerParOrganisation({ eventId, inscriptionId, orgId: org.id, compteId: user.id });
    notify(() => inscriptionAnnuleeParClub(inscriptionId));
    if (promu) notify(() => promotionListeAttente(promu));
    return `Inscription de ${nom} annulée : la place est libérée.`;
  });
}

export async function attribuerPlaceAction(eventId: string, compteId: string, nom: string) {
  return wrap(eventId, async () => {
    await organiser(eventId, "gerer");
    await attribuerPlaceMembre({ eventId, compteId });
    notify(() => placeMembreAttribuee(eventId, compteId));
    return `Place membre attribuée à ${nom}.`;
  });
}

/** Scan d'un billet à la caisse : renvoie l'inscription si le billet est bien pour cet événement. */
export async function trouverBilletAction(eventId: string, token: string): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    await organiser(eventId);
    const id = await trouverParBillet(eventId, String(token ?? ""));
    return id ? { ok: true, id } : { ok: false, message: "Ce billet ne correspond pas à cet événement." };
  } catch (e) {
    if (e instanceof AccessError) return { ok: false, message: "Accès refusé." };
    console.error(e);
    return { ok: false, message: "Une erreur est survenue. Réessaie." };
  }
}

export async function chercherEtudiantsAction(eventId: string, q: string) {
  await organiser(eventId, "gerer");
  return chercherEtudiants(q);
}
