/**
 * Opérations PURES d'édition d'un planning (glisser-déposer, frise horaire, « Déplacer vers… »,
 * actions sur les conflits). Les horaires déjà posés sont CONSERVÉS : seule la scène déplacée
 * reçoit un nouvel horaire. Les conflits sont recalculés par les règles de rules.ts.
 */
import { addMinutes, parseISO } from 'date-fns';
import type {
  Location,
  Project,
  Scene,
  Schedule,
  ScheduleConflict,
  ShootingDay,
  WeatherDay,
} from '@/api/types';
import {
  anchoredSlot,
  atTime,
  CHANGEOVER_MIN,
  DEFAULT_DAY_START,
  finalizeDay,
  layoutDay,
  type DayEntry,
  type Slot,
} from './rules';

export type WeatherByDate = Map<string, WeatherDay>;

type Ctx = {
  project: Pick<Project, 'scenes' | 'locations' | 'max_hours_per_day'>;
  weather?: WeatherByDate;
  /** Jours de la période de tournage (pour les suggestions) */
  windowDates?: string[];
};

const durationMin = (s: Scene) => Math.max(0.25, s.estimated_hours) * 60;

function sceneMap(ctx: Ctx) {
  return new Map(ctx.project.scenes.map((s) => [s.id, s]));
}

/** Scènes d'un jour avec leurs horaires actuels. */
function entriesOf(day: ShootingDay | undefined, ctx: Ctx): DayEntry[] {
  if (!day) return [];
  const byId = sceneMap(ctx);
  return day.scenes
    .map((s) => {
      const scene = byId.get(s.scene_id);
      return scene ? { scene, slot: { start: parseISO(s.start), end: parseISO(s.end) } } : null;
    })
    .filter((e): e is DayEntry => e !== null);
}

function evaluate(date: string, entries: DayEntry[], ctx: Ctx, base?: ShootingDay): ShootingDay | null {
  if (!entries.length) return null;
  return finalizeDay({
    dateIso: date,
    entries,
    project: ctx.project,
    weather: ctx.weather?.get(date) ?? base?.weather,
    backup_note: base?.backup_note,
  });
}

function sortDays(days: ShootingDay[]): ShootingDay[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

/** Où est la scène ? date du jour, 'unplaced', ou undefined (absente du planning). */
export function findScene(schedule: Schedule, sceneId: string): string | 'unplaced' | undefined {
  const d = schedule.days.find((x) => x.scenes.some((s) => s.scene_id === sceneId));
  if (d) return d.date;
  if (schedule.unplaced.some((u) => u.scene_id === sceneId)) return 'unplaced';
  return undefined;
}

/**
 * Horaire proposé pour une scène ajoutée à un jour, sans toucher aux autres :
 * aube / heure dorée / nuit calées sur le soleil ; « jour » dans le premier créneau libre
 * à partir de 08:00 (ou de l'ouverture du lieu), avec 30 min de battement.
 */
export function placeInDay(
  entries: DayEntry[],
  scene: Scene,
  dateIso: string,
  location: Location | undefined,
): Slot {
  const anchored = anchoredSlot(scene, dateIso, location);
  if (anchored) return anchored;
  const dur = durationMin(scene);
  let cursor = atTime(dateIso, DEFAULT_DAY_START);
  if (location?.access_hours) {
    const open = atTime(dateIso, location.access_hours.from);
    if (open > cursor) cursor = open;
  }
  const busy = [...entries].sort((a, b) => a.slot.start.getTime() - b.slot.start.getTime());
  for (const e of busy) {
    const end = addMinutes(cursor, dur);
    if (addMinutes(end, CHANGEOVER_MIN) <= e.slot.start) break;
    const after = addMinutes(e.slot.end, CHANGEOVER_MIN);
    if (after > cursor) cursor = after;
  }
  return { start: cursor, end: addMinutes(cursor, dur) };
}

function removeFrom(schedule: Schedule, sceneId: string, ctx: Ctx): Schedule {
  const days = schedule.days
    .map((d) => {
      if (!d.scenes.some((s) => s.scene_id === sceneId)) return d;
      return evaluate(
        d.date,
        entriesOf(d, ctx).filter((e) => e.scene.id !== sceneId),
        ctx,
        d,
      );
    })
    .filter((d): d is ShootingDay => d !== null);
  return { ...schedule, days, unplaced: schedule.unplaced.filter((u) => u.scene_id !== sceneId) };
}

/**
 * Déplace une scène vers un jour (premier créneau libre) ou la retire du planning (`null`).
 * Les autres scènes gardent leurs horaires.
 */
export function moveScene(schedule: Schedule, sceneId: string, toDate: string | null, ctx: Ctx): Schedule {
  const from = findScene(schedule, sceneId);
  if (from === toDate || (from === 'unplaced' && toDate === null)) return schedule;
  const scene = sceneMap(ctx).get(sceneId);
  if (!scene) return schedule;

  const base = removeFrom(schedule, sceneId, ctx);
  if (toDate === null) {
    return {
      ...base,
      unplaced: [...base.unplaced, { scene_id: sceneId, reason: 'Retirée du planning à la main.' }],
    };
  }
  const target = base.days.find((d) => d.date === toDate);
  const entries = entriesOf(target, ctx);
  const loc = ctx.project.locations.find((l) => l.id === scene.location_id);
  const slot = placeInDay(entries, scene, toDate, loc);
  const day = evaluate(toDate, [...entries, { scene, slot }], ctx, target)!;
  const days = target ? base.days.map((d) => (d.date === toDate ? day : d)) : [...base.days, day];
  return { ...base, days: sortDays(days) };
}

export type TimeMoveResult = { schedule: Schedule } | { error: 'chevauchement'; withSceneId: string };

/** Pose une scène à une heure précise (« HH:mm ») sur un jour ; refuse si elle chevauche une autre scène. */
export function moveSceneToTime(
  schedule: Schedule,
  sceneId: string,
  toDate: string,
  startHHMM: string,
  ctx: Ctx,
): TimeMoveResult {
  const scene = sceneMap(ctx).get(sceneId);
  if (!scene) return { schedule };
  const base = removeFrom(schedule, sceneId, ctx);
  const target = base.days.find((d) => d.date === toDate);
  const entries = entriesOf(target, ctx);
  const start = atTime(toDate, startHHMM);
  const slot = { start, end: addMinutes(start, durationMin(scene)) };
  const clash = entries.find((e) => e.slot.start < slot.end && e.slot.end > slot.start);
  if (clash) return { error: 'chevauchement', withSceneId: clash.scene.id };
  const day = evaluate(toDate, [...entries, { scene, slot }], ctx, target)!;
  const days = target ? base.days.map((d) => (d.date === toDate ? day : d)) : [...base.days, day];
  return { schedule: { ...base, days: sortDays(days) } };
}

/** Recalcule tous les conflits sans toucher aux horaires (ex. après « Marquer comme obtenue »). */
export function reevaluateAll(schedule: Schedule, ctx: Ctx): Schedule {
  return {
    ...schedule,
    days: schedule.days.map((d) => evaluate(d.date, entriesOf(d, ctx), ctx, d) ?? d),
  };
}

function relayout(day: ShootingDay, sceneIds: string[], ctx: Ctx): ShootingDay {
  return layoutDay({
    dateIso: day.date,
    sceneIds,
    project: ctx.project,
    weather: ctx.weather?.get(day.date) ?? day.weather,
    backup_note: day.backup_note,
  });
}

/** Réordonne les scènes d'un jour (feuille de service) : les scènes « jour » sont reposées à la suite. */
export function reorderDay(schedule: Schedule, date: string, orderedIds: string[], ctx: Ctx): Schedule {
  return {
    ...schedule,
    days: schedule.days.map((d) => (d.date === date ? relayout(d, orderedIds, ctx) : d)),
  };
}

/** Recalcule entièrement tous les jours (horaires compris). */
export function relayoutAll(schedule: Schedule, ctx: Ctx): Schedule {
  return {
    ...schedule,
    days: schedule.days.map((d) =>
      relayout(
        d,
        d.scenes.map((s) => s.scene_id),
        ctx,
      ),
    ),
  };
}

/** Modifie l'heure de rendez-vous d'un jour (recalculée si les scènes du jour changent). */
export function setCallTime(schedule: Schedule, date: string, callTime: string): Schedule {
  return {
    ...schedule,
    days: schedule.days.map((d) => (d.date === date ? { ...d, call_time: callTime } : d)),
  };
}

/** Scènes du projet absentes du planning (ajoutées après la génération). */
export function scenesNotInSchedule(schedule: Schedule, project: Pick<Project, 'scenes'>): string[] {
  return project.scenes.map((s) => s.id).filter((id) => findScene(schedule, id) === undefined);
}

// --- Conflits regroupés -----------------------------------------------------------

export type ConflictGroup = {
  key: string;
  kind: ScheduleConflict['kind'];
  locationId?: string;
  /** Jour concerné, pour les conflits propres à une journée (pluie, vent, lieu fermé, journée trop longue) */
  date?: string;
  sceneIds: string[];
  /** Un message représentatif */
  message: string;
};

const DAY_KINDS: ScheduleConflict['kind'][] = ['pluie', 'vent', 'lieu_ferme', 'jour_trop_long'];
/** Conflits à éviter quand on cherche un autre jour */
export const SEVERE_KINDS: ScheduleConflict['kind'][] = ['pluie', 'vent', 'lieu_ferme', 'jour_trop_long'];

/**
 * Regroupe les conflits par cause et par lieu (et par jour pour les causes propres à une journée).
 * Ex. « Médina : autorisation à demander · 3 scènes ».
 */
export function groupConflicts(schedule: Schedule, project: Pick<Project, 'scenes'>): ConflictGroup[] {
  const byId = new Map(project.scenes.map((s) => [s.id, s]));
  const groups = new Map<string, ConflictGroup>();
  for (const d of schedule.days) {
    for (const s of d.scenes) {
      const scene = byId.get(s.scene_id);
      for (const c of s.conflicts) {
        const loc = scene?.location_id;
        const key =
          c.kind === 'meteo_a_reverifier'
            ? c.kind
            : DAY_KINDS.includes(c.kind)
              ? `${c.kind}|${loc}|${d.date}`
              : `${c.kind}|${loc}`;
        const g = groups.get(key) ?? {
          key,
          kind: c.kind,
          locationId: c.kind === 'meteo_a_reverifier' ? undefined : loc,
          date: DAY_KINDS.includes(c.kind) ? d.date : undefined,
          sceneIds: [],
          message: c.message,
        };
        if (!g.sceneIds.includes(s.scene_id)) g.sceneIds.push(s.scene_id);
        groups.set(key, g);
      }
    }
  }
  const order: ScheduleConflict['kind'][] = [
    'lieu_ferme',
    'pluie',
    'vent',
    'jour_trop_long',
    'autorisation_manquante',
    'meteo_a_reverifier',
    'lumiere_non_respectee',
  ];
  return [...groups.values()].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (a.date ?? '').localeCompare(b.date ?? ''),
  );
}

/**
 * Jour où déplacer ces scènes pour supprimer le conflit, selon les règles existantes :
 * le premier jour de la période où, une fois déplacées, elles n'ont ni ce conflit ni un conflit grave.
 */
export function suggestMove(
  schedule: Schedule,
  sceneIds: string[],
  kind: ScheduleConflict['kind'],
  ctx: Ctx,
): string | undefined {
  const current = new Set(sceneIds.map((id) => findScene(schedule, id)));
  for (const date of ctx.windowDates ?? []) {
    if (current.has(date)) continue;
    const next = sceneIds.reduce((s, id) => moveScene(s, id, date, ctx), schedule);
    const day = next.days.find((d) => d.date === date);
    if (!day) continue;
    const ok = sceneIds.every((id) => {
      const sc = day.scenes.find((x) => x.scene_id === id);
      return sc && !sc.conflicts.some((c) => c.kind === kind || SEVERE_KINDS.includes(c.kind));
    });
    // La journée d'arrivée ne doit pas devenir trop longue pour les scènes déjà là
    const harmless = !day.scenes.some(
      (x) => !sceneIds.includes(x.scene_id) && x.conflicts.some((c) => c.kind === 'jour_trop_long'),
    );
    if (ok && harmless) return date;
  }
  return undefined;
}
