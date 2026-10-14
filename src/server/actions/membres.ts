"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { membreAjoute, notify } from "@/server/email/notifications";
import { AccessError, getSessionUser, mesOrganisations, ORG_COOKIE, requireOrganisation } from "@/server/permissions";
import { chercherEtudiants } from "@/server/services/caisse";
import { ajouterMembre, changerRole, MembreError, retirerMembre, type RoleMembre } from "@/server/services/membres";

export type MembreResult = { ok: boolean; message: string };

/** Club actif d'une personne membre de plusieurs organisations. Refusé si elle n'en fait pas partie. */
export async function choisirOrganisationAction(orgId: string) {
  const user = await getSessionUser();
  if (!user) return false;
  const list = await mesOrganisations(user.id, user.role);
  if (!list.some((x) => x.org.id === orgId)) return false;
  (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
  revalidatePath("/org", "layout");
  return true;
}

/** Écran « Mes espaces » : entre dans l'espace choisi puis revient à la page demandée (dans /org uniquement). */
export async function entrerEspaceAction(orgId: string, retour: string) {
  if (!(await choisirOrganisationAction(orgId))) redirect("/espaces");
  redirect(/^\/org(?:[/?#]|$)/.test(retour) ? retour : "/org");
}

async function wrap(fn: () => Promise<string>): Promise<MembreResult> {
  try {
    const message = await fn();
    revalidatePath("/org/membres");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof MembreError) return { ok: false, message: e.message };
    if (e instanceof AccessError) return { ok: false, message: "Réservé au compte du club et aux présidents." };
    console.error(e);
    return { ok: false, message: "Une erreur est survenue. Réessaie." };
  }
}

export async function chercherCandidatsAction(q: string) {
  await requireOrganisation("gerer");
  return chercherEtudiants(String(q ?? ""));
}

export async function ajouterMembreAction(compteId: string, role: RoleMembre, nom: string) {
  return wrap(async () => {
    const { user, org } = await requireOrganisation("gerer");
    await ajouterMembre({ orgId: org.id, compteId: String(compteId), role, ajoutePar: user.id });
    notify(() => membreAjoute(org.id, String(compteId), role));
    return `${nom} fait maintenant partie de l'équipe.`;
  });
}

export async function changerRoleAction(membreId: string, role: RoleMembre) {
  return wrap(async () => {
    const { user, org } = await requireOrganisation("gerer");
    await changerRole({ orgId: org.id, membreId: String(membreId), role, parCompte: user.id });
    return "Rôle mis à jour.";
  });
}

export async function retirerMembreAction(membreId: string, nom: string) {
  return wrap(async () => {
    const { user, org } = await requireOrganisation("gerer");
    await retirerMembre({ orgId: org.id, membreId: String(membreId), parCompte: user.id });
    return `${nom} ne fait plus partie de l'équipe.`;
  });
}
