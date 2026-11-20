import { addMinutes, parseISO } from 'date-fns';
import type {
  Location,
  PermitStatus,
  QuickSlot,
  Scene,
  ScheduleConflict,
  SceneMoment,
  WeatherDay,
} from '@/api/types';
import type { ChipTone, IconName } from '@/components/ui';
import { formatHourFr } from '@/lib/format';
import { isRainy, isWeatherKnown, isWindy, lightBand, toHHMM } from './rules';

export const MOMENT_LABELS: Record<SceneMoment, string> = {
  jour: 'Jour',
  nuit: 'Nuit',
  aube: 'Lever du soleil',
  heure_doree: 'Lumière du soir',
};
export const MOMENT_ICONS: Record<SceneMoment, IconName> = {
  jour: 'sun',
  nuit: 'moon',
  aube: 'sunrise',
  heure_doree: 'golden',
};

export const SETTING_LABELS = { INT: 'Intérieur', EXT: 'Extérieur' } as const;

/** Moment en clair, pour un scénariste (étiquettes sous l'intitulé). */
export const MOMENT_TAGS: Record<SceneMoment, string> = {
  jour: 'Jour',
  nuit: 'Nuit',
  aube: 'Lever du soleil',
  heure_doree: 'Lumière du soir',
};

/** Moment tel qu'on l'écrit dans un en-tête de scène (« — JOUR », « — SOIR »). */
export const MOMENT_SCRIPT: Record<SceneMoment, string> = {
  jour: 'jour',
  nuit: 'nuit',
  aube: 'aube',
  heure_doree: 'soir',
};

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
  lumiere_non_respectee: 'golden',
};
export const CONFLICT_TONES: Record<ScheduleConflict['kind'], ChipTone> = {
  pluie: 'bad',
  vent: 'bad',
  lieu_ferme: 'bad',
  jour_trop_long: 'warn',
  autorisation_manquante: 'warn',
  meteo_a_reverifier: 'warn',
  lumiere_non_respectee: 'warn',
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

/**
 * Classes du bloc de scène (fond, texte, filet gauche). INT bleu-gris, EXT ambre, texte blanc (AA) ;
 * la nuit garde la teinte et se distingue par un filet gauche plus sombre.
 */
export const SCENE_KIND_CLASSES: Record<SceneKind, string> = {
  'ext-jour': 'bg-scene-ext text-white border-scene-ext',
  'int-jour': 'bg-scene-int text-white border-scene-int',
  'ext-nuit': 'bg-scene-ext text-white border-scene-ext-night',
  'int-nuit': 'bg-scene-int text-white border-scene-int-night',
};

/** Pastille de légende (même teinte que le bloc) */
export const SCENE_KIND_SWATCH: Record<SceneKind, string> = {
  'ext-jour': 'bg-scene-ext border-scene-ext',
  'int-jour': 'bg-scene-int border-scene-int',
  'ext-nuit': 'bg-scene-ext border-scene-ext-night',
  'int-nuit': 'bg-scene-int border-scene-int-night',
};

/** Couleur de pastille par décor intérieur / extérieur (étiquettes, légende). */
export const SETTING_SWATCH = { INT: 'bg-scene-int', EXT: 'bg-scene-ext' } as const;

// --- Conflits en phrases simples --------------------------------------------------------
export type ConflictAction =
  | { kind: 'link'; label: string; to: string }
  | { kind: 'move'; label: string }
  | { kind: 'shift'; label: string; hhmm: string };

export type ConflictSentence = { text: string; action?: ConflictAction };

/** Étape « Lieux » de l'assistant */
export const WIZARD_LOCATIONS_URL = '/planner/projet?etape=3';

const MOVE: ConflictAction = { kind: 'move', label: 'Déplacer vers…' };

/** Arrondi au quart d'heure supérieur, en « HH:mm ». */
function ceilQuarter(d: Date): string {
  const r = new Date(d);
  r.setSeconds(0, 0);
  const m = r.getMinutes();
  return toHHMM(addMinutes(r, (15 - (m % 15)) % 15));
}

/**
 * Un conflit en une phrase simple, avec l'action qui le règle.
 * `ctx` (facultatif) apporte les chiffres du jour : date, météo, maximum d'heures.
 */
export function conflictSentence(
  conflict: ScheduleConflict,
  scene: Pick<Scene, 'moment'>,
  location: Location | undefined,
  ctx: { date?: string; weather?: WeatherDay; maxHours?: number } = {},
): ConflictSentence {
  const place = location?.name ?? 'ce lieu';
  const w = ctx.weather;
  switch (conflict.kind) {
    case 'autorisation_manquante':
      return {
        text: `Autorisation de tournage à demander pour ${place}.`,
        action: { kind: 'link', label: 'Ouvrir l’étape Lieux', to: WIZARD_LOCATIONS_URL },
      };
    case 'pluie':
      return {
        text: `Pluie probable${w?.rain_pct != null ? ` (${w.rain_pct} %)` : ''} pendant cette scène en extérieur.`,
        action: MOVE,
      };
    case 'vent':
      return { text: `Vent fort prévu${w?.wind_kmh != null ? ` (${w.wind_kmh} km/h)` : ''}.`, action: MOVE };
    case 'lieu_ferme':
      return { text: `${place} est fermé ce jour-là.`, action: MOVE };
    case 'jour_trop_long':
      return {
        text: ctx.maxHours
          ? `La journée dépasse ${ctx.maxHours} h de tournage.`
          : 'La journée dépasse le maximum d’heures de tournage.',
        action: MOVE,
      };
    case 'meteo_a_reverifier':
      return { text: 'Météo pas encore disponible pour cette date : à revérifier quelques jours avant.' };
    case 'lumiere_non_respectee': {
      const band = ctx.date ? lightBand(scene.moment, ctx.date, location) : null;
      if (!band || !ctx.date) return { text: conflict.message };
      const hhmm = ceilQuarter(band.start);
      return {
        text: conflict.message,
        action: {
          kind: 'shift',
          label: `Décaler à ${formatHourFr(parseISO(`${ctx.date}T${hhmm}:00`))}`,
          hhmm,
        },
      };
    }
    default:
      return { text: (conflict as ScheduleConflict).message };
  }
}

type WeatherWords = { icon: IconName; text: string; tone: 'bad' | 'warn' | 'ok' | 'neutral' };

/**
 * Météo d'un jour de tournage, dite par ce qu'elle implique pour les scènes :
 * pluie ou vent sans scène en extérieur → pas de gêne ; avec de l'extérieur → risque (ton « bad »).
 */
export function dayWeatherInWords(w: WeatherDay | undefined, hasExterior: boolean): WeatherWords[] {
  if (!isWeatherKnown(w)) return weatherInWords(w);
  const out: WeatherWords[] = [];
  if (isRainy(w))
    out.push(
      hasExterior
        ? {
            icon: 'rain',
            text: `Pluie probable (${w.rain_pct} %) : risque pour les scènes en extérieur`,
            tone: 'bad',
          }
        : {
            icon: 'rain',
            text: `Pluie probable (${w.rain_pct} %), pas de gêne : tout est en intérieur`,
            tone: 'ok',
          },
    );
  if (isWindy(w))
    out.push(
      hasExterior
        ? {
            icon: 'wind',
            text: `Vent fort (${w.wind_kmh} km/h) : risque pour les scènes en extérieur`,
            tone: 'bad',
          }
        : {
            icon: 'wind',
            text: `Vent fort (${w.wind_kmh} km/h), pas de gêne : tout est en intérieur`,
            tone: 'ok',
          },
    );
  return out.length ? out : weatherInWords(w);
}

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
