import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { aujourdhui } from "@/lib/dates";
import { getDb, schema as s } from "@/server/db";
import { dossierJustificatifs, supprimerJustificatif } from "@/server/uploads";

// Trésorerie d'une organisation (BF-44, RG-21). Toutes les fonctions prennent l'organisation
// fournie par requireFinance() : un identifiant venant du client n'est jamais utilisé seul.

export const CATEGORIES = ["Billetterie", "Cotisations", "Sponsoring", "Subvention", "Matériel", "Impression", "Communication", "Transport", "Restauration", "Location", "Autre"] as const;
export const BILLETTERIE = "Billetterie";

export class TresorerieError extends Error {}

const JUSTIF = /^(jpg|jpeg|png|webp|pdf):ensate-clubs\/justificatifs\/([0-9a-f-]{36})\/[A-Za-z0-9_-]{1,200}$/;

export const TransactionSchema = z.object({
  type: z.enum(["RECETTE", "DEPENSE"], { error: "Type invalide." }),
  montant: z
    .number({ error: "Montant invalide." })
    .positive("Le montant doit être positif.")
    .max(10_000_000, "Montant trop élevé.")
    .refine((v) => Math.round(v * 100) === v * 100, "Deux décimales au maximum."),
  libelle: z.string().trim().min(2, "Libellé trop court.").max(120, "Libellé trop long."),
  categorie: z.enum(CATEGORIES, { error: "Catégorie invalide." }),
  dateOperation: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  idEvenement: z.string().uuid().nullable(),
  justificatif: z.string().nullable(),
});
export type TransactionInput = z.input<typeof TransactionSchema>;

/** Valide l'entrée : événement de cette organisation, justificatif rangé dans SON dossier privé. */
async function verifier(orgId: string, input: TransactionInput) {
  const parsed = TransactionSchema.safeParse(input);
  if (!parsed.success) throw new TresorerieError(parsed.error.issues[0]?.message ?? "Opération invalide.");
  const d = parsed.data;
  if (d.idEvenement) {
    const [link] = await getDb()
      .select({ id: s.organisationEvenement.idEvenement })
      .from(s.organisationEvenement)
      .where(and(eq(s.organisationEvenement.idEvenement, d.idEvenement), eq(s.organisationEvenement.idOrganisation, orgId)))
      .limit(1);
    if (!link) throw new TresorerieError("Événement introuvable pour ton organisation.");
  }
  if (d.justificatif) {
    const m = JUSTIF.exec(d.justificatif);
    if (!m || `ensate-clubs/justificatifs/${m[2]}` !== dossierJustificatifs(orgId)) throw new TresorerieError("Justificatif invalide.");
  }
  return d;
}

const publicId = (justificatif: string) => justificatif.slice(justificatif.indexOf(":") + 1);

export async function creerTransaction(orgId: string, compteId: string, input: TransactionInput) {
  const d = await verifier(orgId, input);
  const [row] = await getDb()
    .insert(s.transaction)
    .values({ type: d.type, montant: d.montant.toFixed(2), libelle: d.libelle, categorie: d.categorie, dateOperation: d.dateOperation, idEvenement: d.idEvenement, justificatifId: d.justificatif, idOrganisation: orgId, idSaisiPar: compteId })
    .returning({ id: s.transaction.id });
  return row.id;
}

export async function modifierTransaction(orgId: string, id: string, input: TransactionInput) {
  const d = await verifier(orgId, input);
  const db = getDb();
  const [old] = await db.select().from(s.transaction).where(and(eq(s.transaction.id, id), eq(s.transaction.idOrganisation, orgId)));
  if (!old) throw new TresorerieError("Opération introuvable.");
  await db
    .update(s.transaction)
    .set({ type: d.type, montant: d.montant.toFixed(2), libelle: d.libelle, categorie: d.categorie, dateOperation: d.dateOperation, idEvenement: d.idEvenement, justificatifId: d.justificatif })
    .where(and(eq(s.transaction.id, id), eq(s.transaction.idOrganisation, orgId)));
  if (old.justificatifId && old.justificatifId !== d.justificatif) await supprimerJustificatif(publicId(old.justificatifId));
}

export async function supprimerTransaction(orgId: string, id: string) {
  const [row] = await getDb()
    .delete(s.transaction)
    .where(and(eq(s.transaction.id, id), eq(s.transaction.idOrganisation, orgId)))
    .returning({ justificatifId: s.transaction.justificatifId });
  if (!row) throw new TresorerieError("Opération introuvable.");
  if (row.justificatifId) await supprimerJustificatif(publicId(row.justificatifId));
}

/** Justificatif d'une opération de CETTE organisation : { format, publicId } ou null. */
export async function justificatifDe(orgId: string, id: string) {
  const [row] = await getDb()
    .select({ j: s.transaction.justificatifId })
    .from(s.transaction)
    .where(and(eq(s.transaction.id, id), eq(s.transaction.idOrganisation, orgId)))
    .limit(1);
  if (!row?.j) return null;
  return { format: row.j.slice(0, row.j.indexOf(":")), publicId: publicId(row.j) };
}

export type Filtres = { du?: string; au?: string; type?: "RECETTE" | "DEPENSE"; evenement?: string };

export async function listTransactions(orgId: string, f: Filtres = {}) {
  const conds = [eq(s.transaction.idOrganisation, orgId)];
  if (f.du && /^\d{4}-\d{2}-\d{2}$/.test(f.du)) conds.push(gte(s.transaction.dateOperation, f.du));
  if (f.au && /^\d{4}-\d{2}-\d{2}$/.test(f.au)) conds.push(lte(s.transaction.dateOperation, f.au));
  if (f.type === "RECETTE" || f.type === "DEPENSE") conds.push(eq(s.transaction.type, f.type));
  if (f.evenement && /^[0-9a-f-]{36}$/.test(f.evenement)) conds.push(eq(s.transaction.idEvenement, f.evenement));
  return getDb()
    .select({ t: s.transaction, evenement: s.evenement.titre })
    .from(s.transaction)
    .leftJoin(s.evenement, eq(s.evenement.id, s.transaction.idEvenement))
    .where(and(...conds))
    .orderBy(desc(s.transaction.dateOperation), desc(s.transaction.dateSaisie));
}

/** Solde, totaux et répartitions (BF-44). */
export async function synthese(orgId: string) {
  const db = getDb();
  const signe = sql<number>`sum(case when ${s.transaction.type} = 'RECETTE' then ${s.transaction.montant} else -${s.transaction.montant} end)`.mapWith(Number);
  const recettes = sql<number>`coalesce(sum(${s.transaction.montant}) filter (where ${s.transaction.type} = 'RECETTE'), 0)`.mapWith(Number);
  const depenses = sql<number>`coalesce(sum(${s.transaction.montant}) filter (where ${s.transaction.type} = 'DEPENSE'), 0)`.mapWith(Number);
  const [[tot], parCategorie, parEvenement] = await Promise.all([
    db.select({ recettes, depenses }).from(s.transaction).where(eq(s.transaction.idOrganisation, orgId)),
    db
      .select({ categorie: s.transaction.categorie, recettes, depenses })
      .from(s.transaction)
      .where(eq(s.transaction.idOrganisation, orgId))
      .groupBy(s.transaction.categorie),
    db
      .select({ id: s.evenement.id, titre: s.evenement.titre, solde: signe, recettes, depenses })
      .from(s.transaction)
      .innerJoin(s.evenement, eq(s.evenement.id, s.transaction.idEvenement))
      .where(eq(s.transaction.idOrganisation, orgId))
      .groupBy(s.evenement.id, s.evenement.titre),
  ]);
  return {
    recettes: tot.recettes,
    depenses: tot.depenses,
    solde: tot.recettes - tot.depenses,
    parCategorie: parCategorie.sort((a, b) => b.recettes + b.depenses - (a.recettes + a.depenses)),
    parEvenement: parEvenement.sort((a, b) => Math.abs(b.solde) - Math.abs(a.solde)),
  };
}

/**
 * Billetterie : pour chaque événement, total encaissé PAR CETTE organisation (ses propres paiements seulement, RG-21)
 * comparé à la recette « Billetterie » déjà saisie.
 */
export async function billetterie(orgId: string) {
  const db = getDb();
  const encaisse = await db
    .select({
      id: sql<string>`coalesce(${s.evenement.idParent}, ${s.evenement.id})`,
      total: sql<number>`sum(${s.inscription.montantPaye})`.mapWith(Number),
      paiements: sql<number>`count(*)`.mapWith(Number),
    })
    .from(s.inscription)
    .innerJoin(s.evenement, eq(s.evenement.id, s.inscription.idEvenement))
    .where(and(eq(s.inscription.idOrganisationEncaisse, orgId), isNotNull(s.inscription.datePaiement)))
    .groupBy(sql`coalesce(${s.evenement.idParent}, ${s.evenement.id})`);
  if (!encaisse.length) return [];
  const ids = encaisse.map((e) => e.id);
  const [evts, saisies] = await Promise.all([
    db.select({ id: s.evenement.id, titre: s.evenement.titre }).from(s.evenement).where(inArray(s.evenement.id, ids)),
    db
      .select({ id: s.transaction.id, idEvenement: s.transaction.idEvenement, montant: s.transaction.montant })
      .from(s.transaction)
      .where(and(eq(s.transaction.idOrganisation, orgId), eq(s.transaction.categorie, BILLETTERIE), eq(s.transaction.type, "RECETTE"), inArray(s.transaction.idEvenement, ids))),
  ]);
  return encaisse
    .filter((e) => e.total > 0)
    .map((e) => {
      const saisie = saisies.find((t) => t.idEvenement === e.id);
      return { idEvenement: e.id, titre: evts.find((x) => x.id === e.id)?.titre ?? "", encaisse: e.total, paiements: e.paiements, saisie: saisie ? Number(saisie.montant) : null };
    })
    .sort((a, b) => a.titre.localeCompare(b.titre));
}

/** Crée ou met à jour la recette « Billetterie » d'un événement avec le total encaissé par l'organisation. */
export async function synchroniserBilletterie(orgId: string, compteId: string, eventId: string) {
  const ligne = (await billetterie(orgId)).find((b) => b.idEvenement === eventId);
  if (!ligne) throw new TresorerieError("Aucun paiement encaissé par ton organisation pour cet événement.");
  const db = getDb();
  const [existante] = await db
    .select({ id: s.transaction.id })
    .from(s.transaction)
    .where(and(eq(s.transaction.idOrganisation, orgId), eq(s.transaction.idEvenement, eventId), eq(s.transaction.categorie, BILLETTERIE), eq(s.transaction.type, "RECETTE")))
    .orderBy(asc(s.transaction.dateSaisie))
    .limit(1);
  const montant = ligne.encaisse.toFixed(2);
  if (existante) {
    await db.update(s.transaction).set({ montant }).where(eq(s.transaction.id, existante.id));
  } else {
    await db.insert(s.transaction).values({
      type: "RECETTE",
      montant,
      libelle: `Billetterie · ${ligne.titre}`,
      categorie: BILLETTERIE,
      dateOperation: aujourdhui(), // jour à Tétouan, pas en UTC
      idEvenement: eventId,
      idOrganisation: orgId,
      idSaisiPar: compteId,
    });
  }
  return ligne;
}

/** Événements de l'organisation, pour lier une opération. */
export async function evenementsDeLOrganisation(orgId: string) {
  return getDb()
    .select({ id: s.evenement.id, titre: s.evenement.titre })
    .from(s.organisationEvenement)
    .innerJoin(s.evenement, eq(s.evenement.id, s.organisationEvenement.idEvenement))
    .where(and(eq(s.organisationEvenement.idOrganisation, orgId), inArray(s.evenement.statut, ["VALIDE", "PUBLIE", "TERMINE", "ANNULE"])))
    .orderBy(desc(s.evenement.dateMaj));
}
