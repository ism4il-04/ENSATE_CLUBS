import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/server/db";
import { utcToZoned } from "@/lib/dates";

export type CheckinResult =
  | { kind: "VALIDE"; nom: string }
  | { kind: "DEJA_PRESENT"; nom: string; a: Date }
  | { kind: "NON_CONFIRMEE"; nom: string; statut: string }
  | { kind: "BILLET_INVALIDE" }
  | { kind: "EVENEMENT_ANNULE" }
  | { kind: "CRENEAU_HORS_JOUR" };

/** Check-in d'un billet (jeton du QR) ou d'une inscription (recherche manuelle) — RG-19. */
export async function checkin(p: { eventId: string; creneauId: string; scannerId: string; token?: string; inscriptionId?: string }): Promise<CheckinResult> {
  const db = getDb();
  const [creneau] = await db
    .select()
    .from(s.creneau)
    .where(and(eq(s.creneau.id, p.creneauId), eq(s.creneau.idEvenement, p.eventId)))
    .limit(1);
  if (!creneau) return { kind: "BILLET_INVALIDE" };
  const [evt] = await db.select({ statut: s.evenement.statut }).from(s.evenement).where(eq(s.evenement.id, p.eventId)).limit(1);
  if (evt?.statut === "ANNULE") return { kind: "EVENEMENT_ANNULE" };
  const today = utcToZoned(new Date()).date;
  if (utcToZoned(creneau.debut).date !== today && utcToZoned(creneau.fin).date !== today) return { kind: "CRENEAU_HORS_JOUR" };

  const where = p.token ? eq(s.inscription.tokenBillet, p.token) : eq(s.inscription.id, p.inscriptionId ?? "00000000-0000-0000-0000-000000000000");
  const [row] = await db
    .select({ ins: s.inscription, prenom: s.personne.prenom, nom: s.personne.nom, email: s.compte.email })
    .from(s.inscription)
    .innerJoin(s.compte, eq(s.compte.id, s.inscription.idCompte))
    .leftJoin(s.personne, eq(s.personne.idCompte, s.inscription.idCompte))
    .where(where)
    .limit(1);
  if (!row || row.ins.idEvenement !== p.eventId) return { kind: "BILLET_INVALIDE" };
  const nom = [row.prenom, row.nom].filter(Boolean).join(" ") || row.email;
  if (row.ins.statut !== "CONFIRMEE") return { kind: "NON_CONFIRMEE", nom, statut: row.ins.statut };

  const inserted = await db
    .insert(s.presence)
    .values({ idInscription: row.ins.id, idCreneau: creneau.id, idScanneur: p.scannerId })
    .onConflictDoNothing()
    .returning();
  if (inserted.length) return { kind: "VALIDE", nom };
  const [prev] = await db
    .select()
    .from(s.presence)
    .where(and(eq(s.presence.idInscription, row.ins.id), eq(s.presence.idCreneau, creneau.id)));
  return { kind: "DEJA_PRESENT", nom, a: prev.dateCheckin };
}

export async function controleData(eventId: string) {
  const db = getDb();
  const creneaux = await db.select().from(s.creneau).where(eq(s.creneau.idEvenement, eventId)).orderBy(asc(s.creneau.debut));
  const participants = await db
    .select({ id: s.inscription.id, statut: s.inscription.statut, prenom: s.personne.prenom, nom: s.personne.nom, email: s.compte.email })
    .from(s.inscription)
    .innerJoin(s.compte, eq(s.compte.id, s.inscription.idCompte))
    .leftJoin(s.personne, eq(s.personne.idCompte, s.inscription.idCompte))
    .where(and(eq(s.inscription.idEvenement, eventId), inArray(s.inscription.statut, ["CONFIRMEE", "PRE_INSCRITE"])));
  const counts = creneaux.length
    ? await db
        .select({ idCreneau: s.presence.idCreneau, n: sql<number>`count(*)`.mapWith(Number) })
        .from(s.presence)
        .where(inArray(s.presence.idCreneau, creneaux.map((c) => c.id)))
        .groupBy(s.presence.idCreneau)
    : [];
  const presents = creneaux.length
    ? await db.select({ idInscription: s.presence.idInscription, idCreneau: s.presence.idCreneau }).from(s.presence).where(inArray(s.presence.idCreneau, creneaux.map((c) => c.id)))
    : [];
  return {
    creneaux: creneaux.map((c) => ({ id: c.id, debut: c.debut, fin: c.fin, presents: counts.find((x) => x.idCreneau === c.id)?.n ?? 0 })),
    participants: participants.map((p) => ({
      id: p.id,
      nom: [p.prenom, p.nom].filter(Boolean).join(" ") || p.email,
      confirme: p.statut === "CONFIRMEE",
      presences: presents.filter((x) => x.idInscription === p.id).map((x) => x.idCreneau),
    })),
    confirmes: participants.filter((p) => p.statut === "CONFIRMEE").length,
  };
}
