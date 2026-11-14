/**
 * Règles de planification PURES, partagées par :
 *  - le planning simulé (api/mocks/scheduler.ts),
 *  - le calendrier (recalcul des horaires et conflits après un glisser-déposer).
 * Aucune dépendance à React ni à l'API.
 */
import { addMinutes, format, formatISO, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type {
  Location,
  Project,
  Scene,
  ScheduleConflict,
  ScheduledScene,
  ShootingDay,
  WeatherDay,
} from '@/api/types';
import { sunInfo, TUNIS } from '@/lib/sun';

export const RAIN_THRESHOLD_PCT = 40;
export const WIND_THRESHOLD_KMH = 40;
export const FORECAST_HORIZON_DAYS = 14;
/** Battement entre deux scènes (installation, changement de décor). */
export const CHANGEOVER_MIN = 30;
/** Rendez-vous avant la première scène. */
export const CALL_BEFORE_MIN = 60;
/** Début par défaut d'une journée de tournage « jour ». */
export const DEFAULT_DAY_START = '08:00';

export const CONFLICT_LABELS: Record<ScheduleConflict['kind'], string> = {
  pluie: 'Pluie prévue',
  vent: 'Vent fort',
  lieu_ferme: 'Lieu fermé',
  jour_trop_long: 'Journée trop longue',
  autorisation_manquante: 'Autorisation à demander',
  meteo_a_reverifier: 'Météo à revérifier',
};

// --- Utilitaires de temps ----------------------------------------------------
export function atTime(dateIso: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = parseISO(dateIso);
  d.setHours(h, m, 0, 0);
  return d;
}
export function toHHMM(d: Date): string {
  return format(d, 'HH:mm');
}
function roundTo15(d: Date, mode: 'floor' | 'ceil' = 'floor'): Date {
  const r = new Date(d);
  const m = r.getMinutes();
  const q = mode === 'floor' ? Math.floor(m / 15) * 15 : Math.ceil(m / 15) * 15;
  r.setMinutes(q, 0, 0);
  return r;
}
function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000;
}
function iso(d: Date): string {
  return formatISO(d);
}

// --- Météo et lieux ------------------------------------------------------------
export function weekdayFr(dateIso: string): string {
  return format(parseISO(dateIso), 'EEEE', { locale: fr });
}

/** forbidden_days accepte des dates ISO ("2026-11-21") ou des jours de semaine ("vendredi"). */
export function isForbiddenDay(location: Location | undefined, dateIso: string): boolean {
  if (!location) return false;
  const wd = weekdayFr(dateIso);
  return location.forbidden_days.some(
    (f) => f.trim().toLowerCase() === dateIso || f.trim().toLowerCase() === wd,
  );
}

/** Météo dont la prévision est connue : les trois valeurs sont non nulles. */
export type KnownWeatherDay = WeatherDay & { rain_pct: number; wind_kmh: number; cloud_pct: number };

export function isWeatherKnown(w: WeatherDay | undefined): w is KnownWeatherDay {
  return (
    !!w && w.forecast === 'prevision' && w.rain_pct !== null && w.wind_kmh !== null && w.cloud_pct !== null
  );
}
export function isRainy(w: WeatherDay | undefined): boolean {
  return isWeatherKnown(w) && w.rain_pct >= RAIN_THRESHOLD_PCT;
}
export function isWindy(w: WeatherDay | undefined): boolean {
  return isWeatherKnown(w) && w.wind_kmh >= WIND_THRESHOLD_KMH;
}
/** Jour « sec » : prévision connue, sans pluie ni vent fort. */
export function isDry(w: WeatherDay | undefined): boolean {
  return isWeatherKnown(w) && !isRainy(w) && !isWindy(w);
}

export function locationCoords(loc: Location | undefined): { lat: number; lon: number } {
  return loc?.lat !== undefined && loc?.lon !== undefined ? { lat: loc.lat, lon: loc.lon } : TUNIS;
}

// --- Horaires d'une scène ------------------------------------------------------
type Slot = { start: Date; end: Date };

/** Horaire « ancré » sur le soleil pour aube / heure dorée / nuit ; null pour « jour ». */
export function anchoredSlot(scene: Scene, dateIso: string, loc: Location | undefined): Slot | null {
  const { lat, lon } = locationCoords(loc);
  const sun = sunInfo(parseISO(dateIso), lat, lon);
  const dur = Math.max(0.25, scene.estimated_hours) * 60;
  switch (scene.moment) {
    case 'aube': {
      const start = roundTo15(sun.dawn, 'floor');
      return { start, end: addMinutes(start, dur) };
    }
    case 'heure_doree': {
      // La scène se termine au coucher du soleil (+10 min de lumière résiduelle).
      const end = roundTo15(addMinutes(sun.sunset, 10), 'ceil');
      return { start: addMinutes(end, -dur), end };
    }
    case 'nuit': {
      const start = roundTo15(addMinutes(sun.dusk, 15), 'ceil');
      return { start, end: addMinutes(start, dur) };
    }
    default:
      return null;
  }
}

// --- Conflits ------------------------------------------------------------------
export function sceneConflicts(args: {
  scene: Scene;
  slot: Slot;
  dateIso: string;
  location: Location | undefined;
  weather: WeatherDay | undefined;
}): ScheduleConflict[] {
  const { scene, slot, dateIso, location, weather } = args;
  const out: ScheduleConflict[] = [];

  if (scene.setting === 'EXT') {
    if (!isWeatherKnown(weather)) {
      out.push({
        kind: 'meteo_a_reverifier',
        message: `Prévision pas encore disponible (au-delà de ${FORECAST_HORIZON_DAYS} jours) : météo à revérifier.`,
      });
    } else {
      if (isRainy(weather))
        out.push({
          kind: 'pluie',
          message: `Pluie prévue (${weather.rain_pct} %) sur une scène extérieure.`,
        });
      if (isWindy(weather))
        out.push({ kind: 'vent', message: `Vent fort prévu (${weather.wind_kmh} km/h).` });
    }
  }

  if (location) {
    if (isForbiddenDay(location, dateIso)) {
      out.push({
        kind: 'lieu_ferme',
        message: `${location.name} n'est pas accessible ce jour-là (${weekdayFr(dateIso)}).`,
      });
    } else if (location.access_hours) {
      const from = atTime(dateIso, location.access_hours.from);
      const to = atTime(dateIso, location.access_hours.to);
      if (slot.start < from || slot.end > to) {
        out.push({
          kind: 'lieu_ferme',
          message: `${location.name} est accessible de ${location.access_hours.from} à ${location.access_hours.to}.`,
        });
      }
    }
    if (location.permit === 'a_demander') {
      out.push({
        kind: 'autorisation_manquante',
        message: `Autorisation de tournage encore à demander pour ${location.name}.`,
      });
    }
  }
  return out;
}

// --- Mise en page d'une journée ------------------------------------------------
export type DayLayoutInput = {
  dateIso: string;
  sceneIds: string[];
  project: Pick<Project, 'scenes' | 'locations' | 'max_hours_per_day'>;
  weather?: WeatherDay;
  backup_note?: string;
};

/**
 * Calcule les horaires, l'heure de rendez-vous et les conflits d'une journée.
 * - scènes aube / heure dorée / nuit : calées sur le soleil (suncalc) ;
 * - scènes jour : à la suite, à partir de 08:00 (ou de l'ouverture du lieu), avec 30 min de battement ;
 * - l'ordre manuel de `sceneIds` est respecté pour les scènes « jour ».
 */
export function layoutDay(input: DayLayoutInput): ShootingDay {
  const { dateIso, sceneIds, project, weather } = input;
  const byId = new Map(project.scenes.map((s) => [s.id, s]));
  const locById = new Map(project.locations.map((l) => [l.id, l]));
  const scenes = sceneIds.map((id) => byId.get(id)).filter((s): s is Scene => !!s);

  const slots = new Map<string, Slot>();
  // 1. Scènes ancrées sur le soleil
  for (const s of scenes) {
    const a = anchoredSlot(s, dateIso, locById.get(s.location_id));
    if (a) slots.set(s.id, a);
  }
  // 2. Scènes « jour » à la suite
  const dawnSlots = [...slots.values()].filter((sl) => sl.start.getHours() < 9);
  let cursor = atTime(dateIso, DEFAULT_DAY_START);
  for (const sl of dawnSlots) if (sl.end > cursor) cursor = addMinutes(sl.end, CHANGEOVER_MIN);
  for (const s of scenes) {
    if (slots.has(s.id)) continue;
    const loc = locById.get(s.location_id);
    if (loc?.access_hours) {
      const open = atTime(dateIso, loc.access_hours.from);
      if (cursor < open) cursor = open;
    }
    const start = cursor;
    const end = addMinutes(start, Math.max(0.25, s.estimated_hours) * 60);
    slots.set(s.id, { start, end });
    cursor = addMinutes(end, CHANGEOVER_MIN);
  }

  // 3. Tri chronologique, conflits, durée de la journée
  const ordered = scenes
    .map((s) => ({ scene: s, slot: slots.get(s.id)! }))
    .sort((a, b) => a.slot.start.getTime() - b.slot.start.getTime());

  const first = ordered[0]?.slot.start ?? atTime(dateIso, DEFAULT_DAY_START);
  const call = addMinutes(first, -CALL_BEFORE_MIN);
  const totalHours = scenes.reduce((n, s) => n + s.estimated_hours, 0);
  const last = ordered.reduce((d, o) => (o.slot.end > d ? o.slot.end : d), first);
  // Amplitude = du rendez-vous à la fin de la dernière scène
  const span = hoursBetween(call, last);
  const tooLong = totalHours > project.max_hours_per_day;
  const spanTooLong = span > project.max_hours_per_day + 4;

  let cumulative = 0;
  const scheduled: ScheduledScene[] = ordered.map(({ scene, slot }, i) => {
    cumulative += scene.estimated_hours;
    const conflicts = sceneConflicts({
      scene,
      slot,
      dateIso,
      location: locById.get(scene.location_id),
      weather,
    });
    if ((tooLong && cumulative > project.max_hours_per_day) || (spanTooLong && i === ordered.length - 1)) {
      conflicts.push({
        kind: 'jour_trop_long',
        message: tooLong
          ? `La journée dépasse le maximum de ${project.max_hours_per_day} h de tournage (${round1(totalHours)} h prévues).`
          : `Amplitude de ${round1(span)} h entre le rendez-vous et la dernière scène.`,
      });
    }
    return { scene_id: scene.id, start: iso(slot.start), end: iso(slot.end), conflicts };
  });

  return {
    date: dateIso,
    location_ids: [...new Set(scenes.map((s) => s.location_id))],
    call_time: toHHMM(call),
    scenes: scheduled,
    weather,
    backup_note: input.backup_note,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Total des conflits d'un planning, par type. */
export function countConflicts(days: ShootingDay[]): {
  total: number;
  byKind: Partial<Record<ScheduleConflict['kind'], number>>;
} {
  const byKind: Partial<Record<ScheduleConflict['kind'], number>> = {};
  let total = 0;
  for (const d of days)
    for (const s of d.scenes)
      for (const c of s.conflicts) {
        byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
        total++;
      }
  return { total, byKind };
}
