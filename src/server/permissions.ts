import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { auth, type Role } from "@/auth";
import { getDb, schema } from "@/server/db";

// Toute Server Action et toute route API vérifie elle-même ses droits :
// le proxy ne protège que la navigation (docs/05_Architecture.md §5).

export async function getSessionUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

/** Page : redirige vers la connexion si besoin. */
export async function requireUser(retour = "/") {
  const user = await getSessionUser();
  if (!user) redirect(`/connexion?retour=${encodeURIComponent(retour)}`);
  return user;
}

export class AccessError extends Error {
  constructor(public code: "NON_AUTHENTIFIE" | "ACCES_REFUSE" | "INTROUVABLE") {
    super(code);
  }
}

/** Page réservée à certains rôles : vérifiée dans chaque page (un layout ne re-vérifie pas à la navigation). */
export async function requirePageRole(retour: string, ...roles: Role[]) {
  const user = await requireUser(retour);
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

/** Action / API : lève une erreur au lieu de rediriger. */
export async function requireRole(...roles: Role[]) {
  const user = await getSessionUser();
  if (!user) throw new AccessError("NON_AUTHENTIFIE");
  if (roles.length && !roles.includes(user.role)) throw new AccessError("ACCES_REFUSE");
  return user;
}

// ---------------------------------------------------------------- espace organisation (BF-43)

/** Comment on accède à une organisation : son compte commun, ou un compte personnel de membre. */
export type AccesOrg = "COMPTE" | "PRESIDENT" | "TRESORIER" | "MEMBRE";
/**
 * Capacités : gerer = publication, demandes, profil, annonces, membres, export des inscrits ;
 * caisse = inscrits, stand, encaissement, contrôle d'entrée ; finance = trésorerie (RG-21).
 */
export type Capacite = "gerer" | "caisse" | "finance";
const CAPACITES: Record<Capacite, readonly AccesOrg[]> = {
  gerer: ["COMPTE", "PRESIDENT"],
  caisse: ["COMPTE", "PRESIDENT", "TRESORIER", "MEMBRE"],
  finance: ["COMPTE", "PRESIDENT", "TRESORIER"],
};
export const peut = (acces: AccesOrg, cap: Capacite) => CAPACITES[cap].includes(acces);

/** Cookie du club actif, pour une personne membre de plusieurs organisations (toujours revérifié). */
export const ORG_COOKIE = "org_active";

/** Organisations accessibles au compte connecté, avec le type d'accès. */
export const mesOrganisations = cache(async (userId: string, role: Role) => {
  const db = getDb();
  if (role === "ORGANISATION") {
    const rows = await db
      .select()
      .from(schema.organisation)
      .where(and(eq(schema.organisation.idCompte, userId), eq(schema.organisation.statut, "ACTIVE")))
      .limit(1);
    return rows.map((org) => ({ org, acces: "COMPTE" as AccesOrg }));
  }
  if (role !== "ETUDIANT" && role !== "EXTERNE") return []; // coordinateur et admin ne sont jamais membres (RG-21)
  const rows = await db
    .select({ org: schema.organisation, role: schema.membreOrganisation.role })
    .from(schema.membreOrganisation)
    .innerJoin(schema.organisation, eq(schema.organisation.id, schema.membreOrganisation.idOrganisation))
    .where(and(eq(schema.membreOrganisation.idCompte, userId), isNull(schema.membreOrganisation.dateFin), eq(schema.organisation.statut, "ACTIVE")))
    .orderBy(asc(schema.organisation.nom));
  return rows.map((r) => ({ org: r.org, acces: r.role as AccesOrg }));
});

async function organisationActive(cap: Capacite) {
  const user = await getSessionUser();
  if (!user) return { error: "NON_AUTHENTIFIE" as const };
  if (user.role === "COORDINATEUR" || user.role === "ADMIN") return { error: "ACCES_REFUSE" as const };
  const list = await mesOrganisations(user.id, user.role);
  if (!list.length) return { error: "ACCES_REFUSE" as const };
  // Plusieurs organisations : l'espace doit avoir été choisi (cookie revérifié contre les appartenances actuelles).
  const wanted = (await cookies()).get(ORG_COOKIE)?.value;
  const choisie = list.find((x) => x.org.id === wanted) ?? (list.length === 1 ? list[0] : null);
  if (!choisie) return { error: "CHOIX" as const };
  if (!peut(choisie.acces, cap)) return { error: "CAPACITE" as const, acces: choisie.acces };
  return { user, org: choisie.org, acces: choisie.acces, autres: list.length - 1 };
}

/** Action / API : organisation active du compte connecté, avec la capacité demandée (sinon AccessError). */
export async function requireOrganisation(cap: Capacite) {
  const r = await organisationActive(cap);
  if ("error" in r) throw new AccessError(r.error === "NON_AUTHENTIFIE" ? "NON_AUTHENTIFIE" : "ACCES_REFUSE");
  return r;
}

/** Page : comme requireOrganisation, mais redirige (connexion, choix de l'espace, accueil du club, ou accueil du site). */
export async function requireOrgPage(cap: Capacite, retour: string) {
  const r = await organisationActive(cap);
  if ("error" in r) {
    if (r.error === "NON_AUTHENTIFIE") redirect(`/connexion?retour=${encodeURIComponent(retour)}`);
    if (r.error === "CHOIX") redirect(`/espaces?retour=${encodeURIComponent(retour)}`);
    redirect(r.error === "CAPACITE" ? "/org" : "/");
  }
  return r;
}

/**
 * Garde de la trésorerie (RG-21, docs/05 §5) : compte de l'organisation, président ou trésorier.
 * COORDINATEUR et ADMIN sont refusés explicitement, quelle que soit l'organisation demandée.
 */
export async function requireFinance() {
  return requireOrganisation("finance");
}

/** Rôle de l'organisation connectée sur un événement (ou null). Les sous-événements héritent du parent. */
export async function roleOnEvent(orgId: string, eventId: string) {
  const db = getDb();
  const [evt] = await db
    .select({ id: schema.evenement.id, idParent: schema.evenement.idParent })
    .from(schema.evenement)
    .where(eq(schema.evenement.id, eventId))
    .limit(1);
  if (!evt) return null;
  const target = evt.idParent ?? evt.id;
  const [row] = await db
    .select({ role: schema.organisationEvenement.role })
    .from(schema.organisationEvenement)
    .where(and(eq(schema.organisationEvenement.idEvenement, target), eq(schema.organisationEvenement.idOrganisation, orgId)))
    .limit(1);
  return row?.role ?? null;
}
