import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/server/db";
import { utcToZoned } from "@/lib/dates";

// BF-43 : membres d'une organisation (président, trésorier, membre), avec leur compte Google personnel.

export const ROLES_MEMBRE = ["PRESIDENT", "TRESORIER", "MEMBRE"] as const;
export type RoleMembre = (typeof ROLES_MEMBRE)[number];

export class MembreError extends Error {}

/** Année universitaire de septembre à août : « 2026-2027 ». */
export function anneeUniversitaire(d = new Date()) {
  const [y, m] = utcToZoned(d).date.split("-").map(Number);
  return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

const estRole = (r: unknown): r is RoleMembre => ROLES_MEMBRE.includes(r as RoleMembre);

export async function listMembres(orgId: string) {
  return getDb()
    .select({
      id: s.membreOrganisation.id,
      role: s.membreOrganisation.role,
      annee: s.membreOrganisation.anneeUniversitaire,
      depuis: s.membreOrganisation.dateDebut,
      idCompte: s.compte.id,
      email: s.compte.email,
      prenom: s.personne.prenom,
      nom: s.personne.nom,
    })
    .from(s.membreOrganisation)
    .innerJoin(s.compte, eq(s.compte.id, s.membreOrganisation.idCompte))
    .leftJoin(s.personne, eq(s.personne.idCompte, s.compte.id))
    .where(and(eq(s.membreOrganisation.idOrganisation, orgId), isNull(s.membreOrganisation.dateFin)))
    .orderBy(asc(s.membreOrganisation.role), asc(s.personne.prenom));
}

/** Ajoute une personne déjà connectée au moins une fois (compte étudiant ou externe actif). */
export async function ajouterMembre(p: { orgId: string; compteId: string; role: RoleMembre; ajoutePar: string }) {
  if (!estRole(p.role)) throw new MembreError("Rôle invalide.");
  const db = getDb();
  const [c] = await db.select().from(s.compte).where(eq(s.compte.id, p.compteId)).limit(1);
  if (!c || c.statut !== "ACTIF" || (c.role !== "ETUDIANT" && c.role !== "EXTERNE")) throw new MembreError("Ce compte ne peut pas être ajouté comme membre.");
  const [deja] = await db
    .select({ id: s.membreOrganisation.id })
    .from(s.membreOrganisation)
    .where(and(eq(s.membreOrganisation.idOrganisation, p.orgId), eq(s.membreOrganisation.idCompte, c.id), isNull(s.membreOrganisation.dateFin)))
    .limit(1);
  if (deja) throw new MembreError("Cette personne fait déjà partie de l'équipe.");
  await db.insert(s.membreOrganisation).values({ role: p.role, anneeUniversitaire: anneeUniversitaire(), idCompte: c.id, idOrganisation: p.orgId, idAjoutePar: p.ajoutePar });
  return { email: c.email };
}

/** Membre actif de CETTE organisation (jamais d'une autre, même avec un identifiant forgé). */
async function membreDe(orgId: string, membreId: string) {
  const [m] = await getDb()
    .select()
    .from(s.membreOrganisation)
    .where(and(eq(s.membreOrganisation.id, membreId), eq(s.membreOrganisation.idOrganisation, orgId), isNull(s.membreOrganisation.dateFin)))
    .limit(1);
  if (!m) throw new MembreError("Membre introuvable.");
  return m;
}

export async function changerRole(p: { orgId: string; membreId: string; role: RoleMembre; parCompte: string }) {
  if (!estRole(p.role)) throw new MembreError("Rôle invalide.");
  const m = await membreDe(p.orgId, p.membreId);
  if (m.idCompte === p.parCompte) throw new MembreError("Tu ne peux pas changer ton propre rôle : demande au compte du club ou à un autre président.");
  await getDb().update(s.membreOrganisation).set({ role: p.role }).where(eq(s.membreOrganisation.id, m.id));
}

/** Retrait : la ligne est gardée avec une date de fin (historique des encaissements et des saisies). */
export async function retirerMembre(p: { orgId: string; membreId: string; parCompte: string }) {
  const m = await membreDe(p.orgId, p.membreId);
  if (m.idCompte === p.parCompte) throw new MembreError("Tu ne peux pas te retirer toi-même : demande au compte du club ou à un autre président.");
  await getDb().update(s.membreOrganisation).set({ dateFin: new Date() }).where(eq(s.membreOrganisation.id, m.id));
}
