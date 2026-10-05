// Informations légales affichées dans /mentions-legales, /confidentialite et /conditions.
// ⚠️ À COMPLÉTER avant la mise en service publique : les champs vides s'affichent « à compléter ».
// Rien ici n'est secret : ces informations sont publiques par nature.

export const LEGAL = {
  /** Date de la dernière mise à jour des textes (AAAA-MM-JJ). */
  miseAJour: "2026-10-05",

  /** Qui publie le site et répond des données (responsable du traitement, loi 09-08). */
  editeur: {
    nom: "", // ex. « École Nationale des Sciences Appliquées de Tétouan — Université Abdelmalek Essaâdi »
    adresse: "", // adresse postale complète
    email: "", // adresse de contact pour les questions et l'exercice des droits
    responsablePublication: "", // nom et fonction
  },

  /** Déclaration ou autorisation auprès de la CNDP (www.cndp.ma) : numéro de récépissé, une fois obtenu. */
  cndp: "",

  /** Hébergement et prestataires techniques (sous-traitants). */
  hebergeur: {
    nom: "Vercel Inc.",
    adresse: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    site: "https://vercel.com",
  },
  prestataires: [
    { nom: "Neon (Databricks)", role: "Base de données (serveurs en Union européenne, Francfort)", site: "https://neon.tech" },
    { nom: "Google", role: "Connexion avec un compte Google", site: "https://policies.google.com/privacy" },
    { nom: "Cloudinary", role: "Stockage des images (affiches, logos) et des justificatifs de trésorerie (privés)", site: "https://cloudinary.com/privacy" },
    { nom: "Resend", role: "Envoi des emails de la plateforme", site: "https://resend.com/legal/privacy-policy" },
  ],
} as const;

export const ACOMPLETER = "[à compléter]";
export const val = (v: string) => v.trim() || ACOMPLETER;
