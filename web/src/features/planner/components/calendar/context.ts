import { createContext, useContext } from 'react';
import type { Location, Project, Scene, ScheduledScene, WeatherDay } from '@/api/types';

export type CalendarCtx = {
  project: Project;
  sceneById: Map<string, Scene>;
  locationById: Map<string, Location>;
  scheduledById: Map<string, ScheduledScene>;
  weatherByDate: Map<string, WeatherDay>;
  windowDates: string[];
  onMoveRequest: (sceneId: string) => void;
};

export const CalendarContext = createContext<CalendarCtx | null>(null);

export function useCalendar(): CalendarCtx {
  const c = useContext(CalendarContext);
  if (!c) throw new Error('useCalendar doit être utilisé dans le calendrier');
  return c;
}

export const dayDroppableId = (date: string) => `jour:${date}`;
export const UNPLACED_ID = 'non-placees';
