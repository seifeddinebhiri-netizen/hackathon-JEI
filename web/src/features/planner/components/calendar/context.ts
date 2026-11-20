import { createContext, useContext } from 'react';
import type { Location, Project, Scene, ScheduledScene, WeatherDay } from '@/api/types';

export type CalendarCtx = {
  project: Project;
  sceneById: Map<string, Scene>;
  locationById: Map<string, Location>;
  scheduledById: Map<string, ScheduledScene>;
  weatherByDate: Map<string, WeatherDay>;
  windowDates: string[];
  /** Une scène est en cours de déplacement (affiche les zones de dépôt) */
  dragging: boolean;
  onMoveRequest: (sceneId: string) => void;
  /** Pose une scène à « HH:mm » le même jour (action « Décaler à… ») */
  onShift: (sceneId: string, date: string, hhmm: string) => void;
  /** Scène mise en surbrillance depuis la colonne « Votre scénario » */
  highlightScene: string | null;
};

export const CalendarContext = createContext<CalendarCtx | null>(null);

export function useCalendar(): CalendarCtx {
  const c = useContext(CalendarContext);
  if (!c) throw new Error('useCalendar doit être utilisé dans le calendrier');
  return c;
}

/** Dépôt sur la date (premier créneau libre) */
export const dayDroppableId = (date: string) => `jour:${date}`;
/** Dépôt sur la frise horaire (heure précise, pas de 15 min) */
export const timelineDroppableId = (date: string) => `frise:${date}`;
export const UNPLACED_ID = 'non-placees';

export function parseDropTarget(
  id: string | number | undefined,
): { kind: 'day' | 'timeline'; date: string } | { kind: 'unplaced' } | undefined {
  if (id === undefined) return undefined;
  const s = String(id);
  if (s === UNPLACED_ID) return { kind: 'unplaced' };
  if (s.startsWith('jour:')) return { kind: 'day', date: s.slice(5) };
  if (s.startsWith('frise:')) return { kind: 'timeline', date: s.slice(6) };
  return undefined;
}
