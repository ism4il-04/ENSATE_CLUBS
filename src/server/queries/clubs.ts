import "server-only";
import { cache } from "react";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { getDb, schema as s } from "@/server/db";

export const listClubs = cache(async () => {
  const db = getDb();
  const orgs = await db.select().from(s.organisation).where(eq(s.organisation.statut, "ACTIVE")).orderBy(asc(s.organisation.nom));
  const links = orgs.length
    ? await db
        .select({ idOrganisation: s.organisationEvenement.idOrganisation, statut: s.evenement.statut })
        .from(s.organisationEvenement)
        .innerJoin(s.evenement, eq(s.evenement.id, s.organisationEvenement.idEvenement))
        .where(and(inArray(s.organisationEvenement.idOrganisation, orgs.map((o) => o.id)), eq(s.evenement.statut, "PUBLIE")))
    : [];
  return orgs.map((o) => ({ ...o, aVenir: links.filter((l) => l.idOrganisation === o.id).length }));
});

export const getClub = cache(async (slug: string) => {
  const db = getDb();
  const [org] = await db
    .select()
    .from(s.organisation)
    .where(and(eq(s.organisation.slug, slug), eq(s.organisation.statut, "ACTIVE")))
    .limit(1);
  if (!org) return null;
  const evts = await db
    .select({ evt: s.evenement, role: s.organisationEvenement.role })
    .from(s.organisationEvenement)
    .innerJoin(s.evenement, eq(s.evenement.id, s.organisationEvenement.idEvenement))
    .where(and(eq(s.organisationEvenement.idOrganisation, org.id), inArray(s.evenement.statut, ["PUBLIE", "TERMINE"])));
  const ids = evts.map((e) => e.evt.id);
  const [subs, partners] = ids.length
    ? await Promise.all([
        db.select({ id: s.evenement.id, idParent: s.evenement.idParent }).from(s.evenement).where(inArray(s.evenement.idParent, ids)),
        db
          .select({ idEvenement: s.organisationEvenement.idEvenement, nom: s.organisation.nom, slug: s.organisation.slug, couleur: s.organisation.couleur, sigle: s.organisation.sigle })
          .from(s.organisationEvenement)
          .innerJoin(s.organisation, eq(s.organisation.id, s.organisationEvenement.idOrganisation))
          .where(and(inArray(s.organisationEvenement.idEvenement, ids), ne(s.organisationEvenement.idOrganisation, org.id))),
      ])
    : [[], []];
  const creneaux = ids.length
    ? await db.select().from(s.creneau).where(inArray(s.creneau.idEvenement, [...ids, ...subs.map((x) => x.id)])).orderBy(asc(s.creneau.debut))
    : [];
  const events = evts.map(({ evt }) => {
    const family = [evt.id, ...subs.filter((x) => x.idParent === evt.id).map((x) => x.id)];
    const cs = creneaux.filter((c) => family.includes(c.idEvenement));
    return { ...evt, debut: cs[0]?.debut ?? null, fin: cs.at(-1)?.fin ?? null, partenaires: partners.filter((p) => p.idEvenement === evt.id) };
  });
  const collabs = [...new Map(partners.map((p) => [p.slug, p])).values()];
  return { org, events, collabs };
});
