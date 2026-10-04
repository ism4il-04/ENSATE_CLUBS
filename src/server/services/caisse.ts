import "server-only";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/server/db";
import { withTx, type Tx } from "@/server/db/tx";
import { newTicketToken } from "./inscriptions";

export type CaisseErreur =
  | "INTROUVABLE"
  | "EVENEMENT_COMPLET"
  | "TARIF_INVALIDE"
  | "STATUT_INVALIDE"
  | "PAIEMENT_AUTRE_ORGANISATION"
  | "PLACES_MEMBRES_EPUISEES"
  | "ETUDIANT_INTROUVABLE"
  | "DEJA_INSCRIT";

export class CaisseError extends Error {
  constructor(public code: CaisseErreur) {
    super(code);
  }
}

async function lockEvent(tx: Tx, eventId: string) {
  const [evt] = await tx.select().from(s.evenement).where(eq(s.evenement.id, eventId)).for("update");
  if (!evt) throw new CaisseError("INTROUVABLE");
  const [{ publics, membres }] = await tx
    .select({
      publics: sql<number>`count(*) filter (where ${s.inscription.statut} = 'CONFIRMEE' and ${s.inscription.source} <> 'MEMBRE')`.mapWith(Number),
      membres: sql<number>`count(*) filter (where ${s.inscription.statut} = 'CONFIRMEE' and ${s.inscription.source} = 'MEMBRE')`.mapWith(Number),
    })
    .from(s.inscription)
    .where(eq(s.inscription.idEvenement, eventId));
  const placesPubliques = evt.capacite === null ? Infinity : evt.capacite - evt.placesMembres;
  return { evt, publics, membres, placeLibre: publics < placesPubliques };
}

async function getInscription(tx: Tx, eventId: string, inscriptionId: string) {
  const [ins] = await tx
    .select()
    .from(s.inscription)
    .where(and(eq(s.inscription.id, inscriptionId), eq(s.inscription.idEvenement, eventId)));
  if (!ins) throw new CaisseError("INTROUVABLE");
  return ins;
}

/** Marque payé avec le tarif choisi par l'organisation (RG-13, RG-18, RG-32, RG-33). */
export async function marquerPaye(p: { eventId: string; inscriptionId: string; tarifId: string; orgId: string }) {
  return withTx(async (tx) => {
    const { evt, publics, placeLibre } = await lockEvent(tx, p.eventId);
    if (evt.statut !== "PUBLIE") throw new CaisseError("STATUT_INVALIDE");
    const ins = await getInscription(tx, p.eventId, p.inscriptionId);
    if (ins.statut !== "PRE_INSCRITE") throw new CaisseError("STATUT_INVALIDE");
    const [tarif] = await tx.select().from(s.tarif).where(and(eq(s.tarif.id, p.tarifId), eq(s.tarif.idEvenement, p.eventId)));
    if (!tarif) throw new CaisseError("TARIF_INVALIDE");
    if (!placeLibre) throw new CaisseError("EVENEMENT_COMPLET");
    await tx
      .update(s.inscription)
      .set({ statut: "CONFIRMEE", idTarif: tarif.id, montantPaye: tarif.prix, datePaiement: new Date(), idOrganisationEncaisse: p.orgId })
      .where(eq(s.inscription.id, ins.id));
    // RG-26 : ce paiement prend-il la dernière place publique ?
    const complet = ins.source !== "MEMBRE" && evt.capacite !== null && publics + 1 >= evt.capacite - evt.placesMembres;
    return { montant: Number(tarif.prix), tarif: tarif.libelle, complet };
  });
}

/** Annule un paiement saisi par erreur : seule l'organisation qui a encaissé. */
export async function annulerPaiement(p: { eventId: string; inscriptionId: string; orgId: string }) {
  return withTx(async (tx) => {
    await lockEvent(tx, p.eventId);
    const ins = await getInscription(tx, p.eventId, p.inscriptionId);
    if (!ins.datePaiement) throw new CaisseError("STATUT_INVALIDE");
    if (ins.idOrganisationEncaisse !== p.orgId) throw new CaisseError("PAIEMENT_AUTRE_ORGANISATION");
    await tx
      .update(s.inscription)
      .set({ statut: "PRE_INSCRITE", idTarif: null, montantPaye: null, datePaiement: null, idOrganisationEncaisse: null })
      .where(eq(s.inscription.id, ins.id));
  });
}

/** Annulation par l'organisation (RG-17) : une inscription payée ne peut être annulée que par l'organisation qui a encaissé. */
export async function annulerParOrganisation(p: { eventId: string; inscriptionId: string; orgId: string; compteId: string }) {
  return withTx(async (tx) => {
    const { evt } = await lockEvent(tx, p.eventId);
    const ins = await getInscription(tx, p.eventId, p.inscriptionId);
    if (ins.statut === "ANNULEE") throw new CaisseError("STATUT_INVALIDE");
    if (ins.datePaiement && ins.idOrganisationEncaisse !== p.orgId) throw new CaisseError("PAIEMENT_AUTRE_ORGANISATION");
    await tx.update(s.inscription).set({ statut: "ANNULEE", dateAnnulation: new Date(), idAnnulePar: p.compteId }).where(eq(s.inscription.id, ins.id));
    if (evt.gratuit && ins.statut === "CONFIRMEE" && ins.source !== "MEMBRE") {
      const [next] = await tx
        .select({ id: s.inscription.id })
        .from(s.inscription)
        .where(and(eq(s.inscription.idEvenement, evt.id), eq(s.inscription.statut, "LISTE_ATTENTE")))
        .orderBy(asc(s.inscription.dateInscription))
        .limit(1);
      if (next) {
        await tx.update(s.inscription).set({ statut: "CONFIRMEE" }).where(eq(s.inscription.id, next.id));
        return { promu: next.id };
      }
    }
    return { promu: null };
  });
}

/** Attribue une place membre à un étudiant déjà inscrit sur la plateforme (RG-29). */
export async function attribuerPlaceMembre(p: { eventId: string; compteId: string }) {
  return withTx(async (tx) => {
    const { evt, membres } = await lockEvent(tx, p.eventId);
    if (evt.statut !== "PUBLIE") throw new CaisseError("STATUT_INVALIDE");
    if (membres >= evt.placesMembres) throw new CaisseError("PLACES_MEMBRES_EPUISEES");
    const [compte] = await tx.select().from(s.compte).where(and(eq(s.compte.id, p.compteId), eq(s.compte.statut, "ACTIF")));
    if (!compte || (compte.role !== "ETUDIANT" && compte.role !== "EXTERNE")) throw new CaisseError("ETUDIANT_INTROUVABLE");
    const [existing] = await tx.select().from(s.inscription).where(and(eq(s.inscription.idEvenement, evt.id), eq(s.inscription.idCompte, compte.id)));
    if (existing && existing.statut !== "ANNULEE" && existing.statut !== "PRE_INSCRITE") throw new CaisseError("DEJA_INSCRIT");
    const values = {
      statut: "CONFIRMEE" as const,
      source: "MEMBRE" as const,
      idTarif: null,
      montantPaye: null,
      datePaiement: null,
      idOrganisationEncaisse: null,
      dateAnnulation: null,
      idAnnulePar: null,
    };
    if (existing) await tx.update(s.inscription).set(values).where(eq(s.inscription.id, existing.id));
    else await tx.insert(s.inscription).values({ ...values, idEvenement: evt.id, idCompte: compte.id, tokenBillet: newTicketToken() });
  });
}

/** Retrouve l'inscription correspondant au QR d'un billet, uniquement pour cet événement (BF-39). */
export async function trouverParBillet(eventId: string, token: string) {
  const t = token.trim().split("/").pop() ?? "";
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(t)) return null;
  const [row] = await getDb()
    .select({ id: s.inscription.id })
    .from(s.inscription)
    .where(and(eq(s.inscription.tokenBillet, t), eq(s.inscription.idEvenement, eventId)))
    .limit(1);
  return row?.id ?? null;
}

/** Recherche d'étudiants pour attribuer une place membre (3 caractères minimum, 10 résultats). */
export async function chercherEtudiants(q: string) {
  const term = q.trim();
  if (term.length < 3) return [];
  const like = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
  return getDb()
    .select({ id: s.compte.id, email: s.compte.email, prenom: s.personne.prenom, nom: s.personne.nom })
    .from(s.compte)
    .innerJoin(s.personne, eq(s.personne.idCompte, s.compte.id))
    .where(
      and(
        eq(s.compte.statut, "ACTIF"),
        inArray(s.compte.role, ["ETUDIANT", "EXTERNE"]),
        or(ilike(s.compte.email, like), ilike(s.personne.nom, like), ilike(s.personne.prenom, like), ilike(sql`${s.personne.prenom} || ' ' || ${s.personne.nom}`, like)),
      ),
    )
    .limit(10);
}

/** Liste des inscrits vue par une organisation (RG-21 : montants des autres organisations masqués ; RG-30 : téléphone si exigé). */
export async function listInscrits(eventId: string, viewerOrgId: string | null) {
  const db = getDb();
  const [evt] = await db.select().from(s.evenement).where(eq(s.evenement.id, eventId));
  if (!evt) throw new CaisseError("INTROUVABLE");
  const [rows, tarifs, creneaux, orgs] = await Promise.all([
    db
      .select({ ins: s.inscription, email: s.compte.email, role: s.compte.role, prenom: s.personne.prenom, nom: s.personne.nom, telephone: s.personne.telephone, organisme: s.personne.organisme })
      .from(s.inscription)
      .innerJoin(s.compte, eq(s.compte.id, s.inscription.idCompte))
      .leftJoin(s.personne, eq(s.personne.idCompte, s.inscription.idCompte))
      .where(eq(s.inscription.idEvenement, eventId))
      .orderBy(asc(s.inscription.dateInscription)),
    db.select().from(s.tarif).where(eq(s.tarif.idEvenement, eventId)).orderBy(asc(s.tarif.ordre)),
    db.select().from(s.creneau).where(eq(s.creneau.idEvenement, eventId)).orderBy(asc(s.creneau.debut)),
    db.select({ id: s.organisation.id, nom: s.organisation.nom }).from(s.organisation),
  ]);
  const presences = rows.length ? await db.select().from(s.presence).where(inArray(s.presence.idInscription, rows.map((r) => r.ins.id))) : [];
  const list = rows.map(({ ins, email, role, prenom, nom, telephone, organisme }) => {
    const mine = !!ins.idOrganisationEncaisse && ins.idOrganisationEncaisse === viewerOrgId;
    return {
      id: ins.id,
      nom: [prenom, nom].filter(Boolean).join(" ") || email,
      email,
      externe: role === "EXTERNE",
      organisme: role === "EXTERNE" ? organisme : null,
      telephone: evt.telephoneRequis ? telephone : null,
      source: ins.source,
      statut: ins.statut,
      paye: !!ins.datePaiement,
      encaisseParMoi: mine,
      encaissePar: ins.idOrganisationEncaisse ? (orgs.find((o) => o.id === ins.idOrganisationEncaisse)?.nom ?? null) : null,
      tarif: mine ? (tarifs.find((t) => t.id === ins.idTarif)?.libelle ?? null) : null,
      montant: mine && ins.montantPaye !== null ? Number(ins.montantPaye) : null,
      presences: creneaux.map((c) => presences.some((p) => p.idInscription === ins.id && p.idCreneau === c.id)),
    };
  });
  const stats = {
    confirmesPublics: list.filter((r) => r.statut === "CONFIRMEE" && r.source !== "MEMBRE").length,
    pre: list.filter((r) => r.statut === "PRE_INSCRITE").length,
    attente: list.filter((r) => r.statut === "LISTE_ATTENTE").length,
    membres: list.filter((r) => r.statut === "CONFIRMEE" && r.source === "MEMBRE").length,
    encaisse: list.reduce((a, r) => a + (r.montant ?? 0), 0),
  };
  return { evt, list, tarifs: tarifs.map((t) => ({ id: t.id, libelle: t.libelle, prix: Number(t.prix), affiche: t.affiche })), creneaux, stats };
}

