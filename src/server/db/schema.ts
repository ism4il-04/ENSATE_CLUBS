// Schéma de la base (V1 + débuts de V2). Référence : docs/06_Database.md
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  index,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

// ---------------------------------------------------------------- enums

export const roleCompte = pgEnum("role_compte", ["ETUDIANT", "EXTERNE", "ORGANISATION", "COORDINATEUR", "ADMIN"]);
export const statutCompte = pgEnum("statut_compte", ["ACTIF", "SUSPENDU"]);
export const typeOrganisation = pgEnum("type_organisation", ["CLUB", "ASSOCIATION"]);
export const statutOrganisation = pgEnum("statut_organisation", ["ACTIVE", "INACTIVE"]);
export const typeLieu = pgEnum("type_lieu", ["SALLE", "AMPHI", "SALLE_LECTURE", "ECOLE_ENTIERE", "AUTRE"]);
export const structureEvenement = pgEnum("structure_evenement", ["SIMPLE", "PROGRAMME", "SOUS_EVENEMENT"]);
export const categorieEvenement = pgEnum("categorie_evenement", [
  "CONFERENCE", "FORMATION", "ATELIER", "COMPETITION", "CULTUREL", "SPORTIF", "SOIREE", "SORTIE", "AUTRE",
]);
export const modeInscription = pgEnum("mode_inscription", ["AUCUNE", "STAND", "EN_LIGNE"]);
export const statutEvenement = pgEnum("statut_evenement", [
  "BROUILLON", "EN_ATTENTE", "MODIF_DEMANDEE", "VALIDE", "REFUSE", "PUBLIE", "ANNULE", "TERMINE",
]);
export const roleOrganisateur = pgEnum("role_organisateur", ["PRINCIPAL", "PARTENAIRE"]);
export const typeDecision = pgEnum("type_decision", ["VALIDE", "REFUSE", "MODIF_DEMANDEE"]);
export const typeMedia = pgEnum("type_media", ["AFFICHE", "PLANNING", "PHOTO"]);
export const statutInscription = pgEnum("statut_inscription", ["PRE_INSCRITE", "CONFIRMEE", "LISTE_ATTENTE", "ANNULEE"]);
export const sourceInscription = pgEnum("source_inscription", ["EN_LIGNE", "STAND", "MEMBRE"]);
export const typeTransaction = pgEnum("type_transaction", ["RECETTE", "DEPENSE"]);

// ---------------------------------------------------------------- comptes

export const compte = pgTable("compte", {
  id: uuid("id_compte").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // toujours en minuscules
  googleSub: text("google_sub").unique(), // NULL = compte créé par le staff, jamais connecté
  role: roleCompte("role").notNull(),
  statut: statutCompte("statut").notNull().default("ACTIF"),
  dateCreation: ts("date_creation").notNull().defaultNow(),
  derniereConnexion: ts("derniere_connexion"),
  // NULL = créé automatiquement à la première connexion Google (RG-01)
  idCreateur: uuid("id_createur").references((): AnyPgColumn => compte.id),
});

export const personne = pgTable("personne", {
  idCompte: uuid("id_compte").primaryKey().references(() => compte.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  photoUrl: text("photo_url"),
  telephone: text("telephone"),
  niveau: text("niveau"),
  organisme: text("organisme"), // facultatif, pour les externes
});

export const organisation = pgTable("organisation", {
  id: uuid("id_organisation").primaryKey().defaultRandom(),
  type: typeOrganisation("type").notNull(),
  nom: text("nom").notNull().unique(),
  sigle: text("sigle"),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  couvertureUrl: text("couverture_url"),
  couleur: text("couleur").notNull().default("#C6F24E"),
  emailContact: text("email_contact"),
  telephoneContact: text("telephone_contact"),
  instagram: text("instagram"),
  linkedin: text("linkedin"),
  statut: statutOrganisation("statut").notNull().default("ACTIVE"),
  dateCreation: ts("date_creation").notNull().defaultNow(),
  idCompte: uuid("id_compte").notNull().unique().references(() => compte.id),
});

// ---------------------------------------------------------------- lieux & événements

export const lieu = pgTable("lieu", {
  id: uuid("id_lieu").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  nom: text("nom").notNull(),
  type: typeLieu("type").notNull(),
  etage: smallint("etage"),
  capacite: integer("capacite"),
  actif: boolean("actif").notNull().default(true),
});

export const evenement = pgTable(
  "evenement",
  {
    id: uuid("id_evenement").primaryKey().defaultRandom(),
    structure: structureEvenement("structure").notNull(),
    titre: text("titre").notNull(),
    slug: text("slug").notNull().unique(),
    categorie: categorieEvenement("categorie").notNull(),
    descriptionCourte: text("description_courte"),
    description: text("description"),
    afficheUrl: text("affiche_url"),
    couleur: text("couleur").notNull().default("#B79CFF"), // couleur de l'affiche de repli
    capacite: integer("capacite"), // NULL = illimitée
    placesMembres: integer("places_membres").notNull().default(0),
    gratuit: boolean("gratuit").notNull().default(true),
    ouvertExternes: boolean("ouvert_externes").notNull().default(false),
    telephoneRequis: boolean("telephone_requis").notNull().default(false),
    modeInscription: modeInscription("mode_inscription").notNull().default("EN_LIGNE"),
    inscriptionsOuvertes: boolean("inscriptions_ouvertes").notNull().default(false),
    listeAttenteActive: boolean("liste_attente_active").notNull().default(false),
    statut: statutEvenement("statut").notNull().default("BROUILLON"),
    dateCreation: ts("date_creation").notNull().defaultNow(),
    dateMaj: ts("date_maj").notNull().defaultNow(),
    idParent: uuid("id_parent").references((): AnyPgColumn => evenement.id),
    idCreateur: uuid("id_createur").notNull().references(() => compte.id),
  },
  (t) => [
    index("evenement_statut_idx").on(t.statut),
    index("evenement_parent_idx").on(t.idParent),
    check("evenement_capacite_chk", sql`${t.capacite} IS NULL OR ${t.capacite} > 0`),
    check(
      "evenement_places_membres_chk",
      sql`${t.placesMembres} >= 0 AND (${t.capacite} IS NULL OR ${t.placesMembres} <= ${t.capacite})`,
    ),
    check("evenement_parent_chk", sql`(${t.structure} = 'SOUS_EVENEMENT') = (${t.idParent} IS NOT NULL)`),
    check("evenement_programme_chk", sql`${t.structure} <> 'PROGRAMME' OR ${t.modeInscription} = 'AUCUNE'`),
  ],
);

export const tarif = pgTable(
  "tarif",
  {
    id: uuid("id_tarif").primaryKey().defaultRandom(),
    libelle: text("libelle").notNull(),
    prix: numeric("prix", { precision: 8, scale: 2 }).notNull(),
    affiche: boolean("affiche").notNull().default(true), // false = tarif spécial (« Bureau »…)
    ordre: smallint("ordre").notNull().default(0),
    idEvenement: uuid("id_evenement").notNull().references(() => evenement.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("tarif_evenement_libelle_uq").on(t.idEvenement, t.libelle),
    check("tarif_prix_chk", sql`${t.prix} >= 0`),
  ],
);

export const organisationEvenement = pgTable(
  "organisation_evenement",
  {
    idEvenement: uuid("id_evenement").notNull().references(() => evenement.id, { onDelete: "cascade" }),
    idOrganisation: uuid("id_organisation").notNull().references(() => organisation.id),
    role: roleOrganisateur("role").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.idEvenement, t.idOrganisation] }),
    uniqueIndex("un_principal_par_evenement").on(t.idEvenement).where(sql`${t.role} = 'PRINCIPAL'`),
    index("orgevt_organisation_idx").on(t.idOrganisation),
  ],
);

export const creneau = pgTable(
  "creneau",
  {
    id: uuid("id_creneau").primaryKey().defaultRandom(),
    debut: ts("debut").notNull(),
    fin: ts("fin").notNull(),
    libelle: text("libelle"),
    idEvenement: uuid("id_evenement").notNull().references(() => evenement.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("creneau_evenement_idx").on(t.idEvenement, t.debut),
    index("creneau_debut_idx").on(t.debut),
    check("creneau_fin_chk", sql`${t.fin} > ${t.debut}`),
  ],
);

export const creneauLieu = pgTable(
  "creneau_lieu",
  {
    idCreneau: uuid("id_creneau").notNull().references(() => creneau.id, { onDelete: "cascade" }),
    idLieu: uuid("id_lieu").notNull().references(() => lieu.id),
    precision: text("precision"),
  },
  (t) => [primaryKey({ columns: [t.idCreneau, t.idLieu] })],
);

export const decision = pgTable(
  "decision",
  {
    id: uuid("id_decision").primaryKey().defaultRandom(),
    decision: typeDecision("decision").notNull(),
    commentaire: text("commentaire"),
    dateDecision: ts("date_decision").notNull().defaultNow(),
    idEvenement: uuid("id_evenement").notNull().references(() => evenement.id, { onDelete: "cascade" }),
    idCoordinateur: uuid("id_coordinateur").notNull().references(() => compte.id),
  },
  (t) => [check("decision_commentaire_chk", sql`${t.decision} = 'VALIDE' OR ${t.commentaire} IS NOT NULL`)],
);

export const media = pgTable("media", {
  id: uuid("id_media").primaryKey().defaultRandom(),
  type: typeMedia("type").notNull(),
  url: text("url").notNull(),
  texteAlternatif: text("texte_alternatif"),
  ordre: smallint("ordre").notNull().default(0),
  idEvenement: uuid("id_evenement").notNull().references(() => evenement.id, { onDelete: "cascade" }),
  idCreneau: uuid("id_creneau").references(() => creneau.id, { onDelete: "set null" }),
});

// ---------------------------------------------------------------- inscriptions

export const sessionStand = pgTable("session_stand", {
  id: uuid("id_session").primaryKey().defaultRandom(),
  secret: text("secret").notNull(), // 32 octets aléatoires (base64url), jamais renvoyé au client
  dateOuverture: ts("date_ouverture").notNull().defaultNow(),
  dateExpiration: ts("date_expiration").notNull(),
  actif: boolean("actif").notNull().default(true),
  idEvenement: uuid("id_evenement").notNull().references(() => evenement.id),
  idOrganisation: uuid("id_organisation").notNull().references(() => organisation.id),
  idOuvreur: uuid("id_ouvreur").notNull().references(() => compte.id),
});

export const inscription = pgTable(
  "inscription",
  {
    id: uuid("id_inscription").primaryKey().defaultRandom(),
    statut: statutInscription("statut").notNull(),
    source: sourceInscription("source").notNull(),
    tokenBillet: text("token_billet").notNull().unique(),
    montantPaye: numeric("montant_paye", { precision: 8, scale: 2 }),
    datePaiement: ts("date_paiement"),
    dateInscription: ts("date_inscription").notNull().defaultNow(),
    dateAnnulation: ts("date_annulation"),
    idEvenement: uuid("id_evenement").notNull().references(() => evenement.id),
    idCompte: uuid("id_compte").notNull().references(() => compte.id),
    idTarif: uuid("id_tarif").references(() => tarif.id), // choisi par le club à l'encaissement (RG-32)
    idOrganisationEncaisse: uuid("id_organisation_encaisse").references(() => organisation.id),
    idSessionStand: uuid("id_session_stand").references(() => sessionStand.id),
    idAnnulePar: uuid("id_annule_par").references(() => compte.id),
  },
  (t) => [
    uniqueIndex("inscription_evenement_compte_uq").on(t.idEvenement, t.idCompte),
    index("inscription_evenement_statut_idx").on(t.idEvenement, t.statut),
    index("inscription_compte_idx").on(t.idCompte),
    check(
      "inscription_paiement_chk",
      sql`(${t.datePaiement} IS NULL) = (${t.montantPaye} IS NULL) AND (${t.datePaiement} IS NULL) = (${t.idOrganisationEncaisse} IS NULL)`,
    ),
  ],
);

export const presence = pgTable(
  "presence",
  {
    idInscription: uuid("id_inscription").notNull().references(() => inscription.id),
    idCreneau: uuid("id_creneau").notNull().references(() => creneau.id),
    dateCheckin: ts("date_checkin").notNull().defaultNow(),
    idScanneur: uuid("id_scanneur").notNull().references(() => compte.id),
  },
  (t) => [primaryKey({ columns: [t.idInscription, t.idCreneau] })],
);

// ---------------------------------------------------------------- V2 : suivi et annonces

/** Organisations suivies par un participant (BF-17) : email à chaque nouvel événement publié. */
export const suiviOrganisation = pgTable(
  "suivi_organisation",
  {
    idCompte: uuid("id_compte").notNull().references(() => compte.id, { onDelete: "cascade" }),
    idOrganisation: uuid("id_organisation").notNull().references(() => organisation.id, { onDelete: "cascade" }),
    notificationsActives: boolean("notifications_actives").notNull().default(true),
    dateSuivi: ts("date_suivi").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.idCompte, t.idOrganisation] }), index("suivi_organisation_idx").on(t.idOrganisation)],
);

/** Annonce envoyée par une organisation aux inscrits d'un événement (BF-45), gardée pour l'historique. */
export const annonce = pgTable(
  "annonce",
  {
    id: uuid("id_annonce").primaryKey().defaultRandom(),
    titre: text("titre").notNull(),
    contenu: text("contenu").notNull(),
    cible: text("cible").notNull().default("TOUS"), // CONFIRMES | INSCRITS | TOUS
    destinataires: integer("destinataires").notNull(),
    datePublication: ts("date_publication").notNull().defaultNow(),
    idEvenement: uuid("id_evenement").notNull().references(() => evenement.id, { onDelete: "cascade" }),
    idOrganisation: uuid("id_organisation").notNull().references(() => organisation.id),
    idAuteur: uuid("id_auteur").notNull().references(() => compte.id),
  },
  (t) => [index("annonce_evenement_idx").on(t.idEvenement, t.datePublication)],
);

// ---------------------------------------------------------------- V2 : trésorerie (RG-21)
// Lue et écrite UNIQUEMENT via src/server/services/tresorerie.ts, derrière requireFinance().

export const transaction = pgTable(
  "transaction",
  {
    id: uuid("id_transaction").primaryKey().defaultRandom(),
    type: typeTransaction("type").notNull(),
    montant: numeric("montant", { precision: 10, scale: 2 }).notNull(),
    libelle: text("libelle").notNull(),
    categorie: text("categorie").notNull(),
    dateOperation: date("date_operation").notNull(),
    justificatifId: text("justificatif_id"), // « format:public_id » d'un fichier Cloudinary authenticated, jamais une URL
    dateSaisie: ts("date_saisie").notNull().defaultNow(),
    idOrganisation: uuid("id_organisation").notNull().references(() => organisation.id),
    idEvenement: uuid("id_evenement").references(() => evenement.id),
    idSaisiPar: uuid("id_saisi_par").notNull().references(() => compte.id),
  },
  (t) => [check("transaction_montant_chk", sql`${t.montant} > 0`), index("transaction_org_date_idx").on(t.idOrganisation, t.dateOperation)],
);

/** Périodes bloquées par le coordinateur (BF-67) : examens, vacances. Un club ne peut pas y soumettre de créneau. */
export const periodeBloquee = pgTable(
  "periode_bloquee",
  {
    id: uuid("id_periode").primaryKey().defaultRandom(),
    libelle: text("libelle").notNull(),
    debut: date("debut").notNull(),
    fin: date("fin").notNull(),
    motif: text("motif"),
    dateCreation: ts("date_creation").notNull().defaultNow(),
    idCreateur: uuid("id_createur").notNull().references(() => compte.id),
  },
  (t) => [check("periode_dates_chk", sql`${t.debut} <= ${t.fin}`), index("periode_fin_idx").on(t.fin)],
);
