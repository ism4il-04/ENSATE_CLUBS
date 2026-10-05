// Messages des erreurs métier, communs à l'interface web (Server Actions) et à l'API /api/v1.

export const MESSAGES_INSCRIPTION: Record<string, string> = {
  NON_AUTHENTIFIE: "Connecte-toi pour t'inscrire.",
  INTROUVABLE: "Cet événement n'est plus disponible.",
  PROGRAMME_SANS_INSCRIPTION: "Inscris-toi aux activités du programme, une par une.",
  INSCRIPTION_STAND_UNIQUEMENT: "L'inscription se fait au stand du club.",
  INSCRIPTIONS_FERMEES: "Les inscriptions en ligne sont fermées.",
  RESERVE_ETUDIANTS_ENSA: "Cet événement est réservé aux étudiants de l'ENSA.",
  TELEPHONE_REQUIS: "Entre un numéro marocain valide, par exemple 06 12 34 56 78.",
  DEJA_INSCRIT: "Tu es déjà inscrit à cet événement.",
  EVENEMENT_COMPLET: "Il n'y a plus de place pour cet événement.",
  ACCES_REFUSE: "Ce compte ne peut pas s'inscrire aux événements.",
  ANNULATION_APRES_PAIEMENT: "Ton inscription est payée : contacte le club pour l'annuler.",
  ERREUR: "Une erreur est survenue. Réessaie.",
};

export const MESSAGES_CAISSE: Record<string, string> = {
  INTROUVABLE: "Inscription introuvable.",
  EVENEMENT_COMPLET: "Complet : toutes les places publiques sont confirmées.",
  TARIF_INVALIDE: "Choisis d'abord un tarif.",
  STATUT_INVALIDE: "Cette inscription a déjà changé : actualise la page.",
  PAIEMENT_AUTRE_ORGANISATION: "Ce paiement a été encaissé par une autre organisation.",
  PLACES_MEMBRES_EPUISEES: "Toutes les places membres sont attribuées.",
  ETUDIANT_INTROUVABLE: "Étudiant introuvable.",
  DEJA_INSCRIT: "Cet étudiant est déjà inscrit.",
};

export const MESSAGES_CHECKIN: Record<string, string> = {
  DEJA_PRESENT: "Ce billet a déjà été scanné pour ce créneau.",
  NON_CONFIRMEE: "Inscription non confirmée (paiement non enregistré).",
  BILLET_INVALIDE: "Ce billet ne correspond pas à cet événement.",
  CRENEAU_HORS_JOUR: "Ce créneau n'a pas lieu aujourd'hui.",
  EVENEMENT_ANNULE: "Cet événement a été annulé : aucune entrée n'est validée.",
};
