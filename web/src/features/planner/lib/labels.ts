import type { PermitStatus, QuickSlot, Scene, ScheduleConflict, SceneMoment, WeatherDay } from '@/api/types';
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

// --- Plan de travail : 4 teintes, toujours avec un libellé écrit ----------------------
export type SceneKind = 'int-jour' | 'ext-jour' | 'int-nuit' | 'ext-nuit';

/** Aube et heure dorée comptent comme « jour » dans le plan de travail ; seule la nuit est « nuit ». */
export function sceneKind(s: Pick<Scene, 'setting' | 'moment'>): SceneKind {
  const night = s.moment === 'nuit';
  return s.setting === 'EXT' ? (night ? 'ext-nuit' : 'ext-jour') : night ? 'int-nuit' : 'int-jour';
}

export const SCENE_KIND_LABELS: Record<SceneKind, string> = {
  'int-jour': 'INT jour',
  'ext-jour': 'EXT jour',
  'int-nuit': 'INT nuit',
  'ext-nuit': 'EXT nuit',
};

/** Classes de la bande (fond, texte, filet gauche). Contraste AA dans les 4 cas. */
export const SCENE_KIND_CLASSES: Record<SceneKind, string> = {
  'ext-jour': 'bg-ext text-ink border-ink',
  'int-jour': 'bg-int text-ink border-muted-on-light',
  'ext-nuit': 'bg-ink text-paper border-gold',
  'int-nuit': 'bg-line-dark text-paper border-muted-on-dark',
};

/** Pastille de légende (même teinte que la bande) */
export const SCENE_KIND_SWATCH: Record<SceneKind, string> = {
  'ext-jour': 'bg-ext border-ink',
  'int-jour': 'bg-int border-muted-on-light',
  'ext-nuit': 'bg-ink border-gold',
  'int-nuit': 'bg-line-dark border-muted-on-dark',
};

/** Météo d'un jour en clair : « Pluie 90 % », « Vent 50 km/h », « Météo à revérifier »… */
export function weatherInWords(
  w: WeatherDay | undefined,
): { icon: IconName; text: string; tone: 'bad' | 'warn' | 'ok' | 'neutral' }[] {
  if (!w) return [{ icon: 'cloud', text: 'Météo non chargée', tone: 'neutral' }];
  if (w.forecast !== 'prevision' || w.rain_pct === null || w.wind_kmh === null || w.cloud_pct === null)
    return [{ icon: 'cloud', text: 'Météo à revérifier', tone: 'warn' }];
  const out: { icon: IconName; text: string; tone: 'bad' | 'warn' | 'ok' | 'neutral' }[] = [];
  if (w.rain_pct >= 40) out.push({ icon: 'rain', text: `Pluie ${w.rain_pct} %`, tone: 'bad' });
  if (w.wind_kmh >= 40) out.push({ icon: 'wind', text: `Vent ${w.wind_kmh} km/h`, tone: 'bad' });
  if (!out.length)
    out.push({
      icon: w.cloud_pct > 50 ? 'cloud' : 'sun',
      text: `${w.cloud_pct > 50 ? 'Couvert' : 'Sec'} · pluie ${w.rain_pct} %`,
      tone: 'ok',
    });
  return out;
}
