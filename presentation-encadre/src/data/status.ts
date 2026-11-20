/** Statut d'une fonctionnalité affiché en façade (badges RÉALISÉ / EN COURS / PROCHAINEMENT). */
export type Status = 'fait' | 'en-cours' | 'prochainement';

export const STATUS_LABEL: Record<Status, string> = {
  fait: 'Réalisé',
  'en-cours': 'En cours',
  prochainement: 'Prochainement',
};
