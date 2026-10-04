"use server";

import { revalidatePath } from "next/cache";
import { AccessError, requireOrganisation, roleOnEvent } from "@/server/permissions";
import {
  annulerPaiement,
  annulerParOrganisation,
  attribuerPlaceMembre,
  CaisseError,
  chercherEtudiants,
  marquerPaye,
} from "@/server/services/caisse";

export type CaisseResult = { ok: boolean; message: string };

const MESSAGES: Record<string, string> = {
  INTROUVABLE: "Inscription introuvable.",
  EVENEMENT_COMPLET: "Complet : toutes les places publiques sont confirmées.",
  TARIF_INVALIDE: "Choisis d'abord un tarif.",
  STATUT_INVALIDE: "Cette inscription a déjà changé : actualise la page.",
  PAIEMENT_AUTRE_ORGANISATION: "Ce paiement a été encaissé par une autre organisation.",
  PLACES_MEMBRES_EPUISEES: "Toutes les places membres sont attribuées.",
  ETUDIANT_INTROUVABLE: "Étudiant introuvable.",
  DEJA_INSCRIT: "Cet étudiant est déjà inscrit.",
};

/** Organisation principale ou partenaire de l'événement. */
async function organiser(eventId: string) {
  const { user, org } = await requireOrganisation();
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
    await annulerParOrganisation({ eventId, inscriptionId, orgId: org.id, compteId: user.id });
    return `Inscription de ${nom} annulée : la place est libérée.`;
  });
}

export async function attribuerPlaceAction(eventId: string, compteId: string, nom: string) {
  return wrap(eventId, async () => {
    await organiser(eventId);
    await attribuerPlaceMembre({ eventId, compteId });
    return `Place membre attribuée à ${nom}.`;
  });
}

export async function chercherEtudiantsAction(eventId: string, q: string) {
  await organiser(eventId);
  return chercherEtudiants(q);
}
