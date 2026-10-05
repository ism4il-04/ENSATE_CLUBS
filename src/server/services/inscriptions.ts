import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { schema as s } from "@/server/db";
import { withTx, type Tx } from "@/server/db/tx";
import type { Role } from "@/auth";

export type InscriptionErreur =
  | "INTROUVABLE"
  | "PROGRAMME_SANS_INSCRIPTION"
  | "INSCRIPTION_STAND_UNIQUEMENT"
  | "INSCRIPTIONS_FERMEES"
  | "RESERVE_ETUDIANTS_ENSA"
  | "TELEPHONE_REQUIS"
  | "DEJA_INSCRIT"
  | "EVENEMENT_COMPLET"
  | "ACCES_REFUSE"
  | "ANNULATION_APRES_PAIEMENT";

export class InscriptionError extends Error {
  constructor(public code: InscriptionErreur) {
    super(code);
  }
}

export const newTicketToken = () => randomBytes(32).toString("base64url"); // RG-20

const PHONE_RE = /^(?:0[5-7]\d{8}|212[5-7]\d{8})$/;
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!PHONE_RE.test(digits)) return null;
  const local = digits.startsWith("212") ? "0" + digits.slice(3) : digits;
  return local.replace(/(\d{2})(?=\d)/g, "$1 ").trim(); // « 06 12 34 56 78 »
}

/** Verrouille l'événement puis compte les confirmés publics (hors places membres). */
async function lockAndCount(tx: Tx, eventId: string) {
  const [evt] = await tx.select().from(s.evenement).where(eq(s.evenement.id, eventId)).for("update");
  if (!evt) throw new InscriptionError("INTROUVABLE");
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(s.inscription)
    .where(and(eq(s.inscription.idEvenement, eventId), eq(s.inscription.statut, "CONFIRMEE"), ne(s.inscription.source, "MEMBRE")));
  const placesPubliques = evt.capacite === null ? Infinity : evt.capacite - evt.placesMembres;
  return { evt, confirmes: n, libre: n < placesPubliques };
}

/**
 * Inscription en ligne ou au stand (RG-11, RG-12, RG-14, RG-16, RG-28, RG-31).
 * Gratuit : CONFIRMEE / LISTE_ATTENTE / complet. Payant : PRE_INSCRITE (ne bloque aucune place).
 */
export async function inscrire(opts: {
  compteId: string;
  role: Role;
  eventId: string;
  source: "EN_LIGNE" | "STAND";
  telephone?: string | null;
  sessionStandId?: string | null;
}) {
  if (opts.role !== "ETUDIANT" && opts.role !== "EXTERNE") throw new InscriptionError("ACCES_REFUSE");

  return withTx(async (tx) => {
    const { evt, libre } = await lockAndCount(tx, opts.eventId);
    if (evt.statut !== "PUBLIE") throw new InscriptionError("INTROUVABLE");
    if (evt.structure === "PROGRAMME" || evt.modeInscription === "AUCUNE") throw new InscriptionError("PROGRAMME_SANS_INSCRIPTION");
    if (opts.role === "EXTERNE" && !evt.ouvertExternes) throw new InscriptionError("RESERVE_ETUDIANTS_ENSA");
    if (opts.source === "EN_LIGNE") {
      if (evt.modeInscription === "STAND") throw new InscriptionError("INSCRIPTION_STAND_UNIQUEMENT");
      if (!evt.inscriptionsOuvertes) throw new InscriptionError("INSCRIPTIONS_FERMEES");
    }

    const [existing] = await tx
      .select()
      .from(s.inscription)
      .where(and(eq(s.inscription.idEvenement, evt.id), eq(s.inscription.idCompte, opts.compteId)));
    if (existing && existing.statut !== "ANNULEE") throw new InscriptionError("DEJA_INSCRIT");

    // RG-28 : téléphone obligatoire, enregistré dans le profil.
    if (evt.telephoneRequis) {
      const [p] = await tx.select({ tel: s.personne.telephone }).from(s.personne).where(eq(s.personne.idCompte, opts.compteId));
      if (!p?.tel) {
        const tel = opts.telephone ? normalizePhone(opts.telephone) : null;
        if (!tel) throw new InscriptionError("TELEPHONE_REQUIS");
        await tx.update(s.personne).set({ telephone: tel }).where(eq(s.personne.idCompte, opts.compteId));
      }
    }

    let statut: "CONFIRMEE" | "LISTE_ATTENTE" | "PRE_INSCRITE";
    if (evt.gratuit) {
      if (libre) statut = "CONFIRMEE";
      else if (evt.listeAttenteActive) statut = "LISTE_ATTENTE";
      else throw new InscriptionError("EVENEMENT_COMPLET");
    } else {
      if (!libre) throw new InscriptionError("EVENEMENT_COMPLET");
      statut = "PRE_INSCRITE";
    }

    const values = {
      statut,
      source: opts.source,
      dateInscription: new Date(),
      dateAnnulation: null,
      idAnnulePar: null,
      idTarif: null,
      montantPaye: null,
      datePaiement: null,
      idOrganisationEncaisse: null,
      idSessionStand: opts.sessionStandId ?? null,
    };
    // Une réinscription réactive la ligne existante (docs/06 · INSCRIPTION).
    const [row] = existing
      ? await tx.update(s.inscription).set(values).where(eq(s.inscription.id, existing.id)).returning()
      : await tx
          .insert(s.inscription)
          .values({ ...values, idEvenement: evt.id, idCompte: opts.compteId, tokenBillet: newTicketToken() })
          .returning();
    return { inscription: row, evenement: evt };
  });
}

/** Annulation par l'étudiant : impossible après paiement (RG-17). Promotion de la liste d'attente. */
export async function annulerParEtudiant(compteId: string, inscriptionId: string) {
  return withTx(async (tx) => {
    const [ins] = await tx
      .select()
      .from(s.inscription)
      .where(and(eq(s.inscription.id, inscriptionId), eq(s.inscription.idCompte, compteId)));
    if (!ins || ins.statut === "ANNULEE") throw new InscriptionError("INTROUVABLE");
    if (ins.datePaiement) throw new InscriptionError("ANNULATION_APRES_PAIEMENT");

    await lockAndCount(tx, ins.idEvenement);
    await tx
      .update(s.inscription)
      .set({ statut: "ANNULEE", dateAnnulation: new Date(), idAnnulePar: compteId })
      .where(eq(s.inscription.id, ins.id));

    let promu: string | null = null;
    if (ins.statut === "CONFIRMEE") {
      const { evt, libre } = await lockAndCount(tx, ins.idEvenement);
      if (evt.gratuit && libre) {
        const [next] = await tx
          .select({ id: s.inscription.id })
          .from(s.inscription)
          .where(and(eq(s.inscription.idEvenement, evt.id), eq(s.inscription.statut, "LISTE_ATTENTE")))
          .orderBy(asc(s.inscription.dateInscription))
          .limit(1);
        if (next) {
          await tx.update(s.inscription).set({ statut: "CONFIRMEE" }).where(eq(s.inscription.id, next.id));
          promu = next.id;
        }
      }
    }
    return { idEvenement: ins.idEvenement, promu };
  });
}
