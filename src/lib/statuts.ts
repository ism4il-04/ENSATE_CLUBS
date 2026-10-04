// Libellés et couleurs des statuts (événements et inscriptions).
export const STATUT_EVENEMENT = {
  BROUILLON: { label: "Brouillon", cls: "bg-surface-2 text-muted", group: "TODO" },
  EN_ATTENTE: { label: "En attente du coordinateur", cls: "bg-sky/12 text-sky", group: "WAIT" },
  MODIF_DEMANDEE: { label: "Modification demandée", cls: "bg-amber/12 text-amber", group: "TODO" },
  VALIDE: { label: "Validé · à publier", cls: "border border-accent text-accent", group: "TODO" },
  REFUSE: { label: "Refusé", cls: "bg-danger/12 text-danger", group: "DONE" },
  PUBLIE: { label: "Publié", cls: "bg-accent text-ink", group: "PUB" },
  ANNULE: { label: "Annulé", cls: "bg-surface-2 text-danger", group: "DONE" },
  TERMINE: { label: "Terminé", cls: "border border-line-strong text-muted", group: "DONE" },
} as const;
export type StatutEvenement = keyof typeof STATUT_EVENEMENT;

export const STATUT_INSCRIPTION = {
  PRE_INSCRITE: { label: "Pré-inscrit", cls: "bg-amber/14 text-amber" },
  CONFIRMEE: { label: "Confirmé", cls: "bg-accent/14 text-accent" },
  LISTE_ATTENTE: { label: "Liste d'attente", cls: "bg-sky/14 text-sky" },
  ANNULEE: { label: "Annulé", cls: "bg-surface-2 text-muted" },
} as const;
