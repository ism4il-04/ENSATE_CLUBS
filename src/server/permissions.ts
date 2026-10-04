import "server-only";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
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

/** Action / API : lève une erreur au lieu de rediriger. */
export async function requireRole(...roles: Role[]) {
  const user = await getSessionUser();
  if (!user) throw new AccessError("NON_AUTHENTIFIE");
  if (roles.length && !roles.includes(user.role)) throw new AccessError("ACCES_REFUSE");
  return user;
}

/** L'organisation liée au compte connecté (rôle ORGANISATION). */
export async function requireOrganisation() {
  const user = await requireRole("ORGANISATION");
  const [org] = await getDb()
    .select()
    .from(schema.organisation)
    .where(and(eq(schema.organisation.idCompte, user.id), eq(schema.organisation.statut, "ACTIVE")))
    .limit(1);
  if (!org) throw new AccessError("ACCES_REFUSE");
  return { user, org };
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
