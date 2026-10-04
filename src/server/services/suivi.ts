import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Role } from "@/auth";
import { getDb, schema as s } from "@/server/db";

// BF-17 : un participant (étudiant ou externe) suit des organisations et reçoit un email à chaque nouvel événement.
export const peutSuivre = (role: Role) => role === "ETUDIANT" || role === "EXTERNE";

export async function estSuivie(compteId: string, orgId: string) {
  const [row] = await getDb()
    .select({ id: s.suiviOrganisation.idOrganisation })
    .from(s.suiviOrganisation)
    .where(and(eq(s.suiviOrganisation.idCompte, compteId), eq(s.suiviOrganisation.idOrganisation, orgId)))
    .limit(1);
  return !!row;
}

/** Suivre / ne plus suivre. Seules les organisations actives peuvent être suivies. */
export async function definirSuivi(compteId: string, orgId: string, suivre: boolean) {
  const db = getDb();
  if (!suivre) {
    await db.delete(s.suiviOrganisation).where(and(eq(s.suiviOrganisation.idCompte, compteId), eq(s.suiviOrganisation.idOrganisation, orgId)));
    return null;
  }
  const [org] = await db
    .select({ slug: s.organisation.slug })
    .from(s.organisation)
    .where(and(eq(s.organisation.id, orgId), eq(s.organisation.statut, "ACTIVE")))
    .limit(1);
  if (!org) return null;
  await db.insert(s.suiviOrganisation).values({ idCompte: compteId, idOrganisation: orgId }).onConflictDoNothing();
  return org.slug;
}

export async function listSuivis(compteId: string) {
  return getDb()
    .select({ id: s.organisation.id, nom: s.organisation.nom, slug: s.organisation.slug, sigle: s.organisation.sigle, couleur: s.organisation.couleur })
    .from(s.suiviOrganisation)
    .innerJoin(s.organisation, eq(s.organisation.id, s.suiviOrganisation.idOrganisation))
    .where(and(eq(s.suiviOrganisation.idCompte, compteId), eq(s.organisation.statut, "ACTIVE")))
    .orderBy(asc(s.organisation.nom));
}
