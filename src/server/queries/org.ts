import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/server/db";
import { AccessError } from "@/server/permissions";

/** Événements dont l'organisation est principale ou partenaire (hors sous-événements). */
export async function listOrgEvents(orgId: string) {
  const db = getDb();
  const links = await db
    .select({ evt: s.evenement, role: s.organisationEvenement.role })
    .from(s.organisationEvenement)
    .innerJoin(s.evenement, eq(s.evenement.id, s.organisationEvenement.idEvenement))
    .where(eq(s.organisationEvenement.idOrganisation, orgId))
    .orderBy(desc(s.evenement.dateMaj));
  if (!links.length) return [];
  const ids = links.map((l) => l.evt.id);
  const subs = await db.select({ id: s.evenement.id, idParent: s.evenement.idParent }).from(s.evenement).where(inArray(s.evenement.idParent, ids));
  const allIds = [...ids, ...subs.map((x) => x.id)];
  const [creneaux, counts, decisions, principals] = await Promise.all([
    db.select().from(s.creneau).where(inArray(s.creneau.idEvenement, allIds)).orderBy(asc(s.creneau.debut)),
    db
      .select({
        id: s.inscription.idEvenement,
        confirmes: sql<number>`count(*) filter (where ${s.inscription.statut} = 'CONFIRMEE' and ${s.inscription.source} <> 'MEMBRE')`.mapWith(Number),
        pre: sql<number>`count(*) filter (where ${s.inscription.statut} = 'PRE_INSCRITE')`.mapWith(Number),
      })
      .from(s.inscription)
      .where(inArray(s.inscription.idEvenement, allIds))
      .groupBy(s.inscription.idEvenement),
    db.select().from(s.decision).where(inArray(s.decision.idEvenement, ids)).orderBy(desc(s.decision.dateDecision)),
    db
      .select({ idEvenement: s.organisationEvenement.idEvenement, nom: s.organisation.nom })
      .from(s.organisationEvenement)
      .innerJoin(s.organisation, eq(s.organisation.id, s.organisationEvenement.idOrganisation))
      .where(and(inArray(s.organisationEvenement.idEvenement, ids), eq(s.organisationEvenement.role, "PRINCIPAL"))),
  ]);
  return links.map(({ evt, role }) => {
    const family = [evt.id, ...subs.filter((x) => x.idParent === evt.id).map((x) => x.id)];
    const cs = creneaux.filter((c) => family.includes(c.idEvenement));
    const c = counts.filter((x) => family.includes(x.id));
    return {
      evt,
      role,
      principal: principals.find((p) => p.idEvenement === evt.id)?.nom ?? null,
      debut: cs[0]?.debut ?? null,
      fin: cs.at(-1)?.fin ?? null,
      confirmes: c.reduce((a, x) => a + x.confirmes, 0),
      pre: c.reduce((a, x) => a + x.pre, 0),
      derniereDecision: decisions.find((d) => d.idEvenement === evt.id) ?? null,
    };
  });
}

/** Événement vu par une organisation organisatrice (ou le coordinateur) — lève une erreur sinon. */
export async function getManagedEvent(eventId: string, viewer: { orgId?: string; coordinateur?: boolean }) {
  const db = getDb();
  const [evt] = await db.select().from(s.evenement).where(eq(s.evenement.id, eventId)).limit(1);
  if (!evt) throw new AccessError("INTROUVABLE");
  const familyRoot = evt.idParent ?? evt.id;
  const orgs = await db
    .select({ id: s.organisation.id, nom: s.organisation.nom, sigle: s.organisation.sigle, couleur: s.organisation.couleur, role: s.organisationEvenement.role })
    .from(s.organisationEvenement)
    .innerJoin(s.organisation, eq(s.organisation.id, s.organisationEvenement.idOrganisation))
    .where(eq(s.organisationEvenement.idEvenement, familyRoot));
  const myRole = viewer.orgId ? (orgs.find((o) => o.id === viewer.orgId)?.role ?? null) : null;
  if (!viewer.coordinateur && !myRole) throw new AccessError("INTROUVABLE");

  const [creneaux, tarifs, subs, decisions] = await Promise.all([
    db.select().from(s.creneau).where(eq(s.creneau.idEvenement, evt.id)).orderBy(asc(s.creneau.debut)),
    db.select().from(s.tarif).where(eq(s.tarif.idEvenement, evt.id)).orderBy(asc(s.tarif.ordre)),
    db.select().from(s.evenement).where(eq(s.evenement.idParent, evt.id)),
    db.select().from(s.decision).where(eq(s.decision.idEvenement, familyRoot)).orderBy(desc(s.decision.dateDecision)),
  ]);
  const lieux = creneaux.length
    ? await db
        .select({ idCreneau: s.creneauLieu.idCreneau, idLieu: s.lieu.id, code: s.lieu.code, nom: s.lieu.nom, precision: s.creneauLieu.precision })
        .from(s.creneauLieu)
        .innerJoin(s.lieu, eq(s.lieu.id, s.creneauLieu.idLieu))
        .where(inArray(s.creneauLieu.idCreneau, creneaux.map((c) => c.id)))
    : [];
  return {
    evt,
    orgs,
    myRole,
    isPrincipal: myRole === "PRINCIPAL" || !!viewer.coordinateur,
    creneaux: creneaux.map((c) => ({ ...c, lieux: lieux.filter((l) => l.idCreneau === c.id) })),
    tarifs,
    sousEvenements: subs,
    decisions,
  };
}

export async function listLieux() {
  return getDb().select().from(s.lieu).where(eq(s.lieu.actif, true)).orderBy(asc(s.lieu.code));
}

export async function listOrganisations() {
  return getDb()
    .select({ id: s.organisation.id, nom: s.organisation.nom, sigle: s.organisation.sigle, couleur: s.organisation.couleur, type: s.organisation.type })
    .from(s.organisation)
    .where(eq(s.organisation.statut, "ACTIVE"))
    .orderBy(asc(s.organisation.nom));
}

/** Inscrits actifs d'un événement et de ses activités (pour l'avertissement d'annulation). */
export async function countInscritsActifs(eventId: string) {
  const db = getDb();
  const subs = await db.select({ id: s.evenement.id }).from(s.evenement).where(eq(s.evenement.idParent, eventId));
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(s.inscription)
    .where(and(inArray(s.inscription.idEvenement, [eventId, ...subs.map((x) => x.id)]), inArray(s.inscription.statut, ["CONFIRMEE", "PRE_INSCRITE", "LISTE_ATTENTE"])));
  return n;
}
