import "server-only";
import { cache } from "react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/server/db";

export const getPersonne = cache(async (compteId: string) => {
  const [p] = await getDb().select().from(s.personne).where(eq(s.personne.idCompte, compteId)).limit(1);
  return p ?? null;
});

export async function getMyInscription(compteId: string, eventId: string) {
  const [row] = await getDb()
    .select()
    .from(s.inscription)
    .where(and(eq(s.inscription.idCompte, compteId), eq(s.inscription.idEvenement, eventId)))
    .limit(1);
  return row && row.statut !== "ANNULEE" ? row : null;
}

/** Mes inscriptions (hors annulées) avec l'événement et ses créneaux. */
export async function listMyInscriptions(compteId: string) {
  const db = getDb();
  const rows = await db
    .select({ ins: s.inscription, evt: s.evenement })
    .from(s.inscription)
    .innerJoin(s.evenement, eq(s.evenement.id, s.inscription.idEvenement))
    .where(and(eq(s.inscription.idCompte, compteId), inArray(s.inscription.statut, ["PRE_INSCRITE", "CONFIRMEE", "LISTE_ATTENTE"])))
    .orderBy(desc(s.inscription.dateInscription));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.evt.id);
  const [creneaux, presences, tarifs] = await Promise.all([
    db.select().from(s.creneau).where(inArray(s.creneau.idEvenement, ids)),
    db.select().from(s.presence).where(inArray(s.presence.idInscription, rows.map((r) => r.ins.id))),
    db.select().from(s.tarif).where(inArray(s.tarif.idEvenement, ids)),
  ]);
  return rows.map(({ ins, evt }) => {
    const cs = creneaux.filter((c) => c.idEvenement === evt.id).sort((a, b) => a.debut.getTime() - b.debut.getTime());
    return {
      ins,
      evt,
      creneaux: cs,
      presences: presences.filter((p) => p.idInscription === ins.id),
      tarif: tarifs.find((t) => t.id === ins.idTarif) ?? null,
      debut: cs[0]?.debut ?? null,
      fin: cs.at(-1)?.fin ?? null,
    };
  });
}

/** Sépare les inscriptions à venir (fin non passée) et passées. */
export function splitByPeriod<T extends { fin: Date | null }>(items: T[], now = Date.now()) {
  return {
    avenir: items.filter((x) => !x.fin || x.fin.getTime() >= now),
    passes: items.filter((x) => x.fin && x.fin.getTime() < now),
  };
}
