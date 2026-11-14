/**
 * Opérations PURES d'édition d'un planning (glisser-déposer, menu « Déplacer vers… », réordonner).
 * Chaque opération recalcule les horaires et les conflits des journées touchées avec layoutDay.
 */
import type { Project, Schedule, ShootingDay, WeatherDay } from '@/api/types';
import { layoutDay } from './rules';

export type WeatherByDate = Map<string, WeatherDay>;

type Ctx = { project: Pick<Project, 'scenes' | 'locations' | 'max_hours_per_day'>; weather?: WeatherByDate };

function relayout(day: ShootingDay, sceneIds: string[], ctx: Ctx): ShootingDay {
  return layoutDay({
    dateIso: day.date,
    sceneIds,
    project: ctx.project,
    weather: ctx.weather?.get(day.date) ?? day.weather,
    backup_note: day.backup_note,
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
 * Déplace une scène vers un jour (date ISO) ou la retire du planning (`null`).
 * La scène est ajoutée à la fin des scènes « jour » du jour d'arrivée.
 */
export function moveScene(schedule: Schedule, sceneId: string, toDate: string | null, ctx: Ctx): Schedule {
  const from = findScene(schedule, sceneId);
  if (from === toDate || (from === 'unplaced' && toDate === null)) return schedule;

  let days = schedule.days
    .map((d) => {
      if (d.date !== from) return d;
      const remaining = d.scenes.map((s) => s.scene_id).filter((id) => id !== sceneId);
      return remaining.length ? relayout(d, remaining, ctx) : null;
    })
    .filter((d): d is ShootingDay => d !== null);

  let unplaced = schedule.unplaced.filter((u) => u.scene_id !== sceneId);

  if (toDate === null) {
    unplaced = [...unplaced, { scene_id: sceneId, reason: 'Retirée du planning à la main.' }];
  } else {
    const target = days.find((d) => d.date === toDate);
    const ids = [...(target?.scenes.map((s) => s.scene_id) ?? []), sceneId];
    const base: ShootingDay = target ?? { date: toDate, location_ids: [], call_time: '', scenes: [] };
    const laid = relayout(base, ids, ctx);
    days = target ? days.map((d) => (d.date === toDate ? laid : d)) : [...days, laid];
  }
  return { ...schedule, days: sortDays(days), unplaced };
}

/** Réordonne les scènes d'un jour (ordre manuel des scènes « jour »). */
export function reorderDay(schedule: Schedule, date: string, orderedIds: string[], ctx: Ctx): Schedule {
  return {
    ...schedule,
    days: schedule.days.map((d) => (d.date === date ? relayout(d, orderedIds, ctx) : d)),
  };
}

/** Recalcule tous les jours (ex. après chargement de la météo à jour ou modification des lieux). */
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
