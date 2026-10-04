import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/server/db";
import { withTx } from "@/server/db/tx";
import { utcToZoned, zonedToUtc } from "@/lib/dates";
import { LIEU_LABEL } from "@/lib/format";

type Statut = (typeof s.statutEvenement.enumValues)[number];

/** Créneaux (avec lieux) d'un ensemble d'événements ; les sous-événements sont rattachés à leur parent. */
async function creneauxOf(eventIds: string[]) {
  const db = getDb();
  if (!eventIds.length) return [];
  const subs = await db.select({ id: s.evenement.id, idParent: s.evenement.idParent, titre: s.evenement.titre }).from(s.evenement).where(inArray(s.evenement.idParent, eventIds));
  const all = [...eventIds, ...subs.map((x) => x.id)];
  const cs = await db.select().from(s.creneau).where(inArray(s.creneau.idEvenement, all)).orderBy(asc(s.creneau.debut));
  const ls = cs.length
    ? await db
        .select({ idCreneau: s.creneauLieu.idCreneau, idLieu: s.lieu.id, code: s.lieu.code, nom: s.lieu.nom, precision: s.creneauLieu.precision })
        .from(s.creneauLieu)
        .innerJoin(s.lieu, eq(s.lieu.id, s.creneauLieu.idLieu))
        .where(inArray(s.creneauLieu.idCreneau, cs.map((c) => c.id)))
    : [];
  return cs.map((c) => {
    const sub = subs.find((x) => x.id === c.idEvenement);
    return {
      ...c,
      root: sub?.idParent ?? c.idEvenement,
      activite: sub?.titre ?? null,
      lieux: ls.filter((l) => l.idCreneau === c.id).map((l) => ({ ...l, label: LIEU_LABEL(l.code, l.nom, l.precision) })),
    };
  });
}

async function orgsOf(eventIds: string[]) {
  if (!eventIds.length) return [];
  return getDb()
    .select({ idEvenement: s.organisationEvenement.idEvenement, role: s.organisationEvenement.role, id: s.organisation.id, nom: s.organisation.nom, sigle: s.organisation.sigle, couleur: s.organisation.couleur })
    .from(s.organisationEvenement)
    .innerJoin(s.organisation, eq(s.organisation.id, s.organisationEvenement.idOrganisation))
    .where(inArray(s.organisationEvenement.idEvenement, eventIds));
}

export async function listDemandes() {
  const db = getDb();
  const evts = await db
    .select()
    .from(s.evenement)
    .where(and(eq(s.evenement.statut, "EN_ATTENTE"), ne(s.evenement.structure, "SOUS_EVENEMENT")))
    .orderBy(asc(s.evenement.dateMaj));
  const ids = evts.map((e) => e.id);
  const [cs, orgs, decisions] = await Promise.all([
    creneauxOf(ids),
    orgsOf(ids),
    ids.length ? db.select().from(s.decision).where(inArray(s.decision.idEvenement, ids)).orderBy(desc(s.decision.dateDecision)) : [],
  ]);
  return evts.map((e) => ({
    evt: e,
    creneaux: cs.filter((c) => c.root === e.id),
    orgs: orgs.filter((o) => o.idEvenement === e.id).sort((a) => (a.role === "PRINCIPAL" ? -1 : 1)),
    decisions: decisions.filter((d) => d.idEvenement === e.id),
  }));
}

/** « Le même jour » (RG-10) : autres événements validés ou publiés aux mêmes dates, lieux communs signalés. */
export async function sameDay(creneaux: { debut: Date; fin: Date; root: string; lieux: { idLieu: string; code: string }[] }[]) {
  if (!creneaux.length) return [];
  const root = creneaux[0].root;
  const days = [...new Set(creneaux.map((c) => utcToZoned(c.debut).date))];
  const db = getDb();
  const from = zonedToUtc(days.toSorted()[0], "00:00");
  const to = new Date(zonedToUtc(days.toSorted().at(-1)!, "00:00").getTime() + 24 * 3600 * 1000);
  const candidates = await db
    .select({ id: s.creneau.id, idEvenement: s.creneau.idEvenement })
    .from(s.creneau)
    .innerJoin(s.evenement, eq(s.evenement.id, s.creneau.idEvenement))
    .where(and(gte(s.creneau.debut, from), lte(s.creneau.debut, to), inArray(s.evenement.statut, ["VALIDE", "PUBLIE"])));
  const evtIds = [...new Set(candidates.map((c) => c.idEvenement))];
  if (!evtIds.length) return [];
  const evts = await db.select({ id: s.evenement.id, titre: s.evenement.titre, statut: s.evenement.statut, idParent: s.evenement.idParent }).from(s.evenement).where(inArray(s.evenement.id, evtIds));
  const rootIds = [...new Set(evts.map((e) => e.idParent ?? e.id))].filter((id) => id !== root);
  const [others, orgs] = await Promise.all([creneauxOf(rootIds), orgsOf(rootIds)]);
  const roots = rootIds.length ? await db.select({ id: s.evenement.id, titre: s.evenement.titre, statut: s.evenement.statut }).from(s.evenement).where(inArray(s.evenement.id, rootIds)) : [];

  const mine = creneaux.flatMap((c) => c.lieux.map((l) => ({ ...l, debut: c.debut, fin: c.fin, day: utcToZoned(c.debut).date })));
  return others
    .filter((o) => days.includes(utcToZoned(o.debut).date))
    .map((o) => {
      const day = utcToZoned(o.debut).date;
      const sameDayMine = mine.filter((m) => m.day === day);
      const sharesPlace = o.lieux.some((l) => sameDayMine.some((m) => m.idLieu === l.idLieu || m.code === "ECOLE" || l.code === "ECOLE"));
      const overlaps = sameDayMine.some((m) => m.debut < o.fin && o.debut < m.fin);
      const r = roots.find((x) => x.id === o.root);
      return {
        titre: o.activite ? `${r?.titre} · ${o.activite}` : (r?.titre ?? ""),
        statut: r?.statut as Statut,
        org: orgs.find((x) => x.idEvenement === o.root && x.role === "PRINCIPAL")?.nom ?? "",
        debut: o.debut,
        fin: o.fin,
        lieux: o.lieux.map((l) => l.label),
        niveau: sharesPlace && overlaps ? ("conflit" as const) : sharesPlace ? ("attention" as const) : ("ok" as const),
      };
    });
}

export class DecisionError extends Error {}

/** Décision du coordinateur (RG-07) : s'applique au programme et à ses activités. */
export async function decider(p: { eventId: string; coordId: string; decision: "VALIDE" | "REFUSE" | "MODIF_DEMANDEE"; commentaire: string }) {
  const commentaire = p.commentaire.trim();
  if (p.decision !== "VALIDE" && !commentaire) throw new DecisionError("Ajoute un commentaire pour expliquer ta décision au club.");
  return withTx(async (tx) => {
    const [evt] = await tx.select().from(s.evenement).where(eq(s.evenement.id, p.eventId)).for("update");
    if (!evt || evt.statut !== "EN_ATTENTE") throw new DecisionError("Cette demande a déjà été traitée.");
    await tx.update(s.evenement).set({ statut: p.decision, dateMaj: new Date() }).where(eq(s.evenement.id, evt.id));
    await tx.update(s.evenement).set({ statut: p.decision }).where(eq(s.evenement.idParent, evt.id));
    await tx.insert(s.decision).values({ idEvenement: evt.id, idCoordinateur: p.coordId, decision: p.decision, commentaire: commentaire || null });
    return evt;
  });
}

/** Modification des créneaux par le coordinateur après validation (RG-08). */
export async function remplacerCreneaux(eventId: string, creneaux: { date: string; debut: string; fin: string; lieux: { idLieu: string; precision?: string }[] }[]) {
  if (!creneaux.length) throw new DecisionError("Au moins un créneau est nécessaire.");
  return withTx(async (tx) => {
    const [evt] = await tx.select().from(s.evenement).where(eq(s.evenement.id, eventId)).for("update");
    if (!evt || evt.structure === "PROGRAMME") throw new DecisionError("Modifie les créneaux activité par activité.");
    const used = await tx
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(s.presence)
      .innerJoin(s.creneau, eq(s.creneau.id, s.presence.idCreneau))
      .where(eq(s.creneau.idEvenement, eventId));
    if (used[0].n > 0) throw new DecisionError("Des présences sont déjà enregistrées : les créneaux ne peuvent plus être remplacés.");
    await tx.delete(s.creneau).where(eq(s.creneau.idEvenement, eventId));
    for (const c of creneaux) {
      if (!c.lieux.length) throw new DecisionError("Chaque créneau doit avoir au moins un lieu.");
      const debut = zonedToUtc(c.date, c.debut);
      let fin = zonedToUtc(c.date, c.fin);
      if (fin <= debut) fin = new Date(fin.getTime() + 24 * 3600 * 1000);
      const [row] = await tx.insert(s.creneau).values({ idEvenement: eventId, debut, fin }).returning({ id: s.creneau.id });
      await tx.insert(s.creneauLieu).values(c.lieux.map((l) => ({ idCreneau: row.id, idLieu: l.idLieu, precision: l.precision?.trim() || null })));
    }
    await tx.update(s.evenement).set({ dateMaj: new Date() }).where(eq(s.evenement.id, eventId));
    return evt;
  });
}

export { creneauxOf, orgsOf };
