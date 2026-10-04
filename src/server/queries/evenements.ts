import "server-only";
import { cache } from "react";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/server/db";
import { LIEU_LABEL } from "@/lib/format";

export type EventCard = Awaited<ReturnType<typeof listPublishedEvents>>[number];

/** Détails communs (créneaux, lieux, organisateurs, tarifs affichés, places) pour une liste d'événements. */
async function enrich(eventIds: string[]) {
  const db = getDb();
  if (!eventIds.length) return { creneaux: [], lieux: [], orgs: [], tarifs: [], counts: [] };
  const [creneaux, lieux, orgs, tarifs, counts] = await Promise.all([
    db.select().from(s.creneau).where(inArray(s.creneau.idEvenement, eventIds)).orderBy(asc(s.creneau.debut)),
    db
      .select({ idCreneau: s.creneauLieu.idCreneau, code: s.lieu.code, nom: s.lieu.nom, precision: s.creneauLieu.precision })
      .from(s.creneauLieu)
      .innerJoin(s.lieu, eq(s.lieu.id, s.creneauLieu.idLieu))
      .innerJoin(s.creneau, eq(s.creneau.id, s.creneauLieu.idCreneau))
      .where(inArray(s.creneau.idEvenement, eventIds)),
    db
      .select({
        idEvenement: s.organisationEvenement.idEvenement,
        role: s.organisationEvenement.role,
        id: s.organisation.id,
        nom: s.organisation.nom,
        sigle: s.organisation.sigle,
        slug: s.organisation.slug,
        couleur: s.organisation.couleur,
        emailContact: s.organisation.emailContact,
        instagram: s.organisation.instagram,
      })
      .from(s.organisationEvenement)
      .innerJoin(s.organisation, eq(s.organisation.id, s.organisationEvenement.idOrganisation))
      .where(inArray(s.organisationEvenement.idEvenement, eventIds)),
    // Côté public : uniquement les tarifs affichés (RG-36).
    db
      .select()
      .from(s.tarif)
      .where(and(inArray(s.tarif.idEvenement, eventIds), eq(s.tarif.affiche, true)))
      .orderBy(asc(s.tarif.ordre)),
    db
      .select({
        idEvenement: s.inscription.idEvenement,
        confirmesPublics: sql<number>`count(*) filter (where ${s.inscription.statut} = 'CONFIRMEE' and ${s.inscription.source} <> 'MEMBRE')`.mapWith(Number),
      })
      .from(s.inscription)
      .where(inArray(s.inscription.idEvenement, eventIds))
      .groupBy(s.inscription.idEvenement),
  ]);
  return { creneaux, lieux, orgs, tarifs, counts };
}

function assemble(
  evt: typeof s.evenement.$inferSelect,
  d: Awaited<ReturnType<typeof enrich>>,
  childIds: string[] = [], // programme : ses dates viennent des sous-événements
) {
  const creneaux = d.creneaux
    .filter((c) => c.idEvenement === evt.id || childIds.includes(c.idEvenement))
    .map((c) => ({
      ...c,
      lieux: d.lieux.filter((l) => l.idCreneau === c.id).map((l) => LIEU_LABEL(l.code, l.nom, l.precision)),
    }));
  const orgs = d.orgs
    .filter((o) => o.idEvenement === evt.id)
    .sort((a, b) => (a.role === "PRINCIPAL" ? -1 : b.role === "PRINCIPAL" ? 1 : 0));
  const tarifs = d.tarifs.filter((t) => t.idEvenement === evt.id).map((t) => ({ libelle: t.libelle, prix: Number(t.prix) }));
  const confirmes = d.counts.find((c) => c.idEvenement === evt.id)?.confirmesPublics ?? 0;
  const placesPubliques = evt.capacite === null ? null : evt.capacite - evt.placesMembres;
  const restantes = placesPubliques === null ? null : Math.max(0, placesPubliques - confirmes);
  const prixMin = evt.gratuit || !tarifs.length ? 0 : Math.min(...tarifs.map((t) => t.prix));
  const lieux = [...new Set(creneaux.flatMap((c) => c.lieux))];
  return {
    ...evt,
    creneaux,
    orgs,
    tarifs,
    lieux,
    debut: creneaux[0]?.debut ?? null,
    fin: creneaux.at(-1)?.fin ?? null,
    confirmes,
    placesPubliques,
    restantes,
    prixMin,
  };
}

/** Événements publiés à venir (accueil). */
export const listPublishedEvents = cache(async () => {
  const db = getDb();
  const events = await db
    .select()
    .from(s.evenement)
    .where(and(eq(s.evenement.statut, "PUBLIE"), ne(s.evenement.structure, "SOUS_EVENEMENT")));
  const parents = events.filter((e) => e.structure === "PROGRAMME").map((e) => e.id);
  const subs = parents.length
    ? await db
        .select({ id: s.evenement.id, idParent: s.evenement.idParent })
        .from(s.evenement)
        .where(and(inArray(s.evenement.idParent, parents), eq(s.evenement.statut, "PUBLIE")))
    : [];
  const d = await enrich([...events.map((e) => e.id), ...subs.map((x) => x.id)]);
  const now = Date.now();
  return events
    .map((e) => assemble(e, d, subs.filter((x) => x.idParent === e.id).map((x) => x.id)))
    .filter((e) => e.fin === null || e.fin.getTime() >= now)
    .sort((a, b) => (a.debut?.getTime() ?? Infinity) - (b.debut?.getTime() ?? Infinity));
});

/** Fiche publique d'un événement (avec ses sous-événements s'il s'agit d'un programme). */
export const getPublicEvent = cache(async (slug: string) => {
  const db = getDb();
  const [evt] = await db
    .select()
    .from(s.evenement)
    .where(and(eq(s.evenement.slug, slug), inArray(s.evenement.statut, ["PUBLIE", "TERMINE"])))
    .limit(1);
  if (!evt) return null;
  const subs =
    evt.structure === "PROGRAMME"
      ? await db
          .select()
          .from(s.evenement)
          .where(and(eq(s.evenement.idParent, evt.id), inArray(s.evenement.statut, ["PUBLIE", "TERMINE"])))
      : [];
  const d = await enrich([evt.id, ...subs.map((x) => x.id)]);
  const parent = assemble(evt, d, subs.map((x) => x.id));
  const children = subs.map((x) => ({ ...assemble(x, d), orgs: parent.orgs }));
  return {
    ...parent,
    sousEvenements: children.sort((a, b) => (a.debut?.getTime() ?? 0) - (b.debut?.getTime() ?? 0)),
    medias: await db.select().from(s.media).where(eq(s.media.idEvenement, evt.id)).orderBy(asc(s.media.ordre)),
  };
});
