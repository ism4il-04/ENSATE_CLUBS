"use server";

import { revalidatePath } from "next/cache";
import { AccessError, requireRole } from "@/server/permissions";
import {
  AdminError,
  createCompte,
  createLieu,
  createOrganisation,
  setCompteStatut,
  setLieuActif,
  setOrganisationStatut,
} from "@/server/services/admin";

export type AdminResult = { ok: boolean; message: string; at: number } | null;

async function wrap(path: string, fn: () => Promise<string>): Promise<AdminResult> {
  try {
    const message = await fn();
    revalidatePath(path);
    return { ok: true, message, at: Date.now() };
  } catch (e) {
    if (e instanceof AdminError) return { ok: false, message: e.message, at: Date.now() };
    if (e instanceof AccessError) return { ok: false, message: "Accès refusé.", at: Date.now() };
    console.error(e);
    return { ok: false, message: "Une erreur est survenue. Réessaie.", at: Date.now() };
  }
}

// Organisations et lieux : coordinateur ou admin.
export async function creerOrganisationAction(_prev: AdminResult, fd: FormData) {
  return wrap("/coord/organisations", async () => {
    const user = await requireRole("COORDINATEUR", "ADMIN");
    const nom = await createOrganisation({ type: fd.get("type") === "ASSOCIATION" ? "ASSOCIATION" : "CLUB", nom: String(fd.get("nom") ?? ""), sigle: String(fd.get("sigle") ?? ""), email: String(fd.get("email") ?? "") }, user.id);
    return `${nom} créée : le compte s'activera à la première connexion Google.`;
  });
}

export async function organisationStatutAction(id: string, active: boolean) {
  return wrap("/coord/organisations", async () => {
    await requireRole("COORDINATEUR", "ADMIN");
    const nom = await setOrganisationStatut(id, active);
    return active ? `${nom} réactivée.` : `${nom} désactivée : elle ne peut plus accéder à son espace.`;
  });
}

export async function creerLieuAction(_prev: AdminResult, fd: FormData) {
  return wrap("/coord/lieux", async () => {
    await requireRole("COORDINATEUR", "ADMIN");
    const etage = String(fd.get("etage") ?? "");
    const capacite = String(fd.get("capacite") ?? "");
    const nom = await createLieu({
      code: String(fd.get("code") ?? ""),
      nom: String(fd.get("nom") ?? ""),
      type: (String(fd.get("type") ?? "SALLE") as "SALLE"),
      etage: etage === "" ? null : Number(etage),
      capacite: capacite === "" ? null : Number(capacite),
    });
    return `Lieu « ${nom} » ajouté.`;
  });
}

export async function lieuActifAction(id: string, actif: boolean) {
  return wrap("/coord/lieux", async () => {
    await requireRole("COORDINATEUR", "ADMIN");
    const nom = await setLieuActif(id, actif);
    return actif ? `${nom} réactivé.` : `${nom} désactivé : il n'est plus proposé aux clubs.`;
  });
}

// Comptes : admin uniquement.
export async function creerCompteAction(_prev: AdminResult, fd: FormData) {
  return wrap("/admin", async () => {
    const user = await requireRole("ADMIN");
    const role = String(fd.get("role") ?? "COORDINATEUR") as "COORDINATEUR";
    const email = await createCompte({ email: String(fd.get("email") ?? ""), role, prenom: String(fd.get("prenom") ?? ""), nom: String(fd.get("nom") ?? "") }, user.id);
    return `Compte créé pour ${email} : il s'activera à la première connexion Google.`;
  });
}

export async function compteStatutAction(id: string, actif: boolean) {
  return wrap("/admin", async () => {
    const user = await requireRole("ADMIN");
    const email = await setCompteStatut(id, actif, user.id);
    return actif ? `${email} réactivé.` : `${email} suspendu : il ne peut plus se connecter.`;
  });
}
