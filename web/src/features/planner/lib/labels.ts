import type { PermitStatus, QuickSlot, ScheduleConflict, SceneMoment } from '@/api/types';
import type { ChipTone, IconName } from '@/components/ui';

export const MOMENT_LABELS: Record<SceneMoment, string> = {
  jour: 'Jour',
  nuit: 'Nuit',
  aube: 'Aube',
  heure_doree: 'Heure dorée',
};
export const MOMENT_ICONS: Record<SceneMoment, IconName> = {
  jour: 'sun',
  nuit: 'moon',
  aube: 'sunrise',
  heure_doree: 'golden',
};

export const SETTING_LABELS = { INT: 'Intérieur', EXT: 'Extérieur' } as const;

export const PERMIT_LABELS: Record<PermitStatus, string> = {
  non_necessaire: 'Non nécessaire',
  a_demander: 'À demander',
  obtenue: 'Obtenue',
};
export const PERMIT_TONES: Record<PermitStatus, ChipTone> = {
  non_necessaire: 'neutral',
  a_demander: 'warn',
  obtenue: 'ok',
};

export const CONFLICT_ICONS: Record<ScheduleConflict['kind'], IconName> = {
  pluie: 'rain',
  vent: 'wind',
  lieu_ferme: 'door',
  jour_trop_long: 'clock',
  autorisation_manquante: 'doc',
  meteo_a_reverifier: 'cloud',
};
export const CONFLICT_TONES: Record<ScheduleConflict['kind'], ChipTone> = {
  pluie: 'bad',
  vent: 'bad',
  lieu_ferme: 'bad',
  jour_trop_long: 'warn',
  autorisation_manquante: 'warn',
  meteo_a_reverifier: 'warn',
};

export const VERDICT_LABELS: Record<QuickSlot['verdict'], string> = {
  recommande: 'Recommandé',
  plan_b: 'Plan B',
  a_eviter: 'À éviter',
};
export const VERDICT_TONES: Record<QuickSlot['verdict'], ChipTone> = {
  recommande: 'ok',
  plan_b: 'warn',
  a_eviter: 'bad',
};
export const VERDICT_ICONS: Record<QuickSlot['verdict'], IconName> = {
  recommande: 'check',
  plan_b: 'alert',
  a_eviter: 'x',
};

export const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
