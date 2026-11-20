import { conflictSentence, type ConflictSentence } from '../../lib/labels';
import { useCalendar } from './context';
import { dayRange, FULL_RANGE, type HourRange } from './geometry';
import type { ShootingDay } from '@/api/types';

/** Conflits d'une scène planifiée, en phrases simples avec leur action (voir `conflictSentence`). */
export function useSceneSentences(sceneId: string): (ConflictSentence & { key: string })[] {
  const { sceneById, scheduledById, locationById, weatherByDate, project } = useCalendar();
  const scene = sceneById.get(sceneId);
  const scheduled = scheduledById.get(sceneId);
  if (!scene || !scheduled) return [];
  const date = scheduled.start.slice(0, 10);
  const location = locationById.get(scene.location_id);
  return scheduled.conflicts.map((c) => ({
    key: c.kind,
    ...conflictSentence(c, scene, location, {
      date,
      weather: weatherByDate.get(date),
      maxHours: project.max_hours_per_day,
    }),
  }));
}

/** Plage affichée : zoomée sur le jour, ou pleine (6 h–24 h) pendant un glisser-déposer. */
export function useDayRange(day: ShootingDay): HourRange {
  const { dragging } = useCalendar();
  return dragging ? FULL_RANGE : dayRange(day);
}
