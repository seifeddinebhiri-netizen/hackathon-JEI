import { format, parseISO } from 'date-fns';
import type { Scene, ScheduledScene } from '@/api/types';

/** « 08 h » ou « 10 h 30 » */
export function shortTime(isoStr: string): string {
  const d = parseISO(isoStr);
  const m = format(d, 'mm');
  return `${format(d, 'HH')} h${m === '00' ? '' : ` ${m}`}`;
}

export function timeRange(s: ScheduledScene): string {
  return `${shortTime(s.start)}–${shortTime(s.end)}`;
}

/** Texte complet d'une scène : « INT · Sc. 1 · Amira ouvre le café · 08 h–10 h » */
export function sceneLine(scene: Scene, scheduled?: ScheduledScene): string {
  const parts = [scene.setting, `Sc. ${scene.number}`, scene.title || 'Sans titre'];
  if (scheduled) parts.push(timeRange(scheduled));
  return parts.join(' · ');
}
