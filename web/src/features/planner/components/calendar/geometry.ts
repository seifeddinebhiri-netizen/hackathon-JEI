/** Géométrie de la frise horaire du calendrier : 06 h → 24 h. */
import { parseISO } from 'date-fns';
import type { Location } from '@/api/types';
import { sunInfo } from '@/lib/sun';
import { locationCoords } from '../../lib/rules';

export const T0 = 6;
export const T1 = 24;
export const SPAN = T1 - T0;
export const STEP_MIN = 15;

/** Heure décimale locale d'un instant ISO ou d'une Date. */
export function hourOf(d: string | Date): number {
  const x = typeof d === 'string' ? parseISO(d) : d;
  return x.getHours() + x.getMinutes() / 60;
}

/** Position en % sur la frise (bornée à 0-100). */
export function pct(h: number): number {
  return Math.min(100, Math.max(0, ((h - T0) / SPAN) * 100));
}

/** Heure arrondie au pas de 15 min, bornée à la frise, en « HH:mm ». */
export function snapToHHMM(h: number, durationH = 0): string {
  const clamped = Math.min(Math.max(h, T0), T1 - Math.max(0.25, durationH));
  const q = Math.round((clamped * 60) / STEP_MIN) * STEP_MIN;
  return `${String(Math.floor(q / 60)).padStart(2, '0')}:${String(q % 60).padStart(2, '0')}`;
}

export type SunBand = { kind: 'nuit' | 'aube' | 'heure_doree'; from: number; to: number; label: string };

/** Bandes de fond : nuit, aube, heure dorée (suncalc, coordonnées du lieu du jour). */
export function sunBands(dateIso: string, location: Location | undefined): SunBand[] {
  const { lat, lon } = locationCoords(location);
  const s = sunInfo(parseISO(dateIso), lat, lon);
  const bands: SunBand[] = [
    { kind: 'nuit', from: T0, to: hourOf(s.dawn), label: 'nuit' },
    { kind: 'aube', from: hourOf(s.dawn), to: hourOf(s.goldenMorning.to), label: 'aube' },
    { kind: 'heure_doree', from: hourOf(s.goldenEvening.from), to: hourOf(s.dusk), label: 'h. dorée' },
    { kind: 'nuit', from: hourOf(s.dusk), to: T1, label: 'nuit' },
  ];
  return bands.filter((b) => b.to > b.from);
}

export const AXIS_HOURS = Array.from({ length: SPAN / 2 + 1 }, (_, i) => T0 + i * 2);
