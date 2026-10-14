"use server";

import { revalidatePath } from "next/cache";
import { changementCreneauxDemande, notify } from "@/server/email/notifications";
import { AccessError, getSessionUser, requireOrganisation } from "@/server/permissions";
import { EvenementError, modifierInfos, reprendreDemande, verifierDemandeChangement } from "@/server/services/evenement";

export type EvenementResult = { ok: boolean; message: string };

async function wrap(fn: () => Promise<string>): Promise<EvenementResult> {
  try {
    return { ok: true, message: await fn() };
  } catch (e) {
    if (e instanceof EvenementError) return { ok: false, message: e.message };
    if (e instanceof AccessError) return { ok: false, message: "Accès refusé." };
    console.error(e);
    return { ok: false, message: "Une erreur est survenue. Réessaie." };
  }
}

/** Titre, catégorie, description courte : organisation principale (président·e, compte du club) ou coordinateur. */
export async function modifierInfosAction(eventId: string, input: { titre: string; categorie: string; descriptionCourte: string }) {
  return wrap(async () => {
    const user = await getSessionUser();
    if (!user) throw new AccessError("NON_AUTHENTIFIE");
    const coordinateur = user.role === "COORDINATEUR" || user.role === "ADMIN";
    const orgId = coordinateur ? undefined : (await requireOrganisation("gerer")).org.id;
    const r = await modifierInfos(String(eventId), input as never, { orgId, coordinateur });
    revalidatePath("/", "layout");
    revalidatePath(`/evenements/${r.slug}`);
    return "Informations enregistrées.";
  });
}

export async function reprendreDemandeAction(eventId: string) {
  return wrap(async () => {
    const { org } = await requireOrganisation("gerer");
    await reprendreDemande(String(eventId), org.id);
    revalidatePath("/org");
    revalidatePath("/coord");
    return "La demande est repassée en brouillon : modifie-la puis renvoie-la au coordinateur.";
  });
}

export async function demanderChangementAction(eventId: string, message: string) {
  return wrap(async () => {
    const { user, org } = await requireOrganisation("gerer");
    const { evt, texte } = await verifierDemandeChangement(String(eventId), org.id, String(message ?? ""));
    notify(() => changementCreneauxDemande(evt.id, org.nom, user.email ?? "", texte));
    return "Demande envoyée au coordinateur : il te répondra par email.";
  });
}
