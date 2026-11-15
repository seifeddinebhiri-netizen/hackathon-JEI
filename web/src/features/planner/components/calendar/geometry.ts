/**
 * Géométrie de la frise horaire du calendrier.
 * Chaque jour a sa plage, zoomée sur ses scènes (`dayRange`) ; pendant un glisser-déposer,
 * toutes les frises passent sur la plage pleine 6 h → 24 h (`FULL_RANGE`) pour pouvoir déposer n'importe où.
 */
import { parseISO } from 'date-fns';
import type { Location, ShootingDay } from '@/api/types';
import { sunInfo } from '@/lib/sun';
import { locationCoords } from '../../lib/rules';

export type HourRange = { from: number; to: number };

export const MIN_HOUR = 6;
export const MAX_HOUR = 24;
export const FULL_RANGE: HourRange = { from: MIN_HOUR, to: MAX_HOUR };
export const STEP_MIN = 15;
/** Marge autour des scènes, et amplitude minimale affichée */
const MARGIN_H = 2;
const MIN_SPAN_H = 8;

/** Heure décimale locale d'un instant ISO ou d'une Date. */
export function hourOf(d: string | Date): number {
  const x = typeof d === 'string' ? parseISO(d) : d;
  return x.getHours() + x.getMinutes() / 60;
}

/** Fin d'une scène en heure décimale (minuit = 24, pas 0). */
export function endHourOf(startIso: string, endIso: string): number {
  const h = hourOf(endIso);
  return h === 0 && parseISO(endIso).getDate() !== parseISO(startIso).getDate() ? 24 : h;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Plage d'un jour : de (début de la 1re scène − 2 h) à (fin de la dernière + 2 h),
 * arrondie aux heures paires, bornée à 6 h–24 h, avec au moins 8 h d'amplitude.
 */
export function dayRange(day: Pick<ShootingDay, 'scenes'>): HourRange {
  if (!day.scenes.length) return { from: 8, to: 16 };
  const first = Math.min(...day.scenes.map((s) => hourOf(s.start)));
  const last = Math.max(...day.scenes.map((s) => endHourOf(s.start, s.end)));
  let from = clamp(Math.floor((first - MARGIN_H) / 2) * 2, MIN_HOUR, MAX_HOUR);
  let to = clamp(Math.ceil((last + MARGIN_H) / 2) * 2, MIN_HOUR, MAX_HOUR);
  // Élargir des deux côtés à tour de rôle jusqu'à 8 h, sans sortir de 6 h–24 h
  while (to - from < MIN_SPAN_H) {
    if (to < MAX_HOUR) to += 2;
    if (to - from < MIN_SPAN_H && from > MIN_HOUR) from -= 2;
  }
  return { from, to };
}

/** Position en % sur la frise (bornée à 0-100). */
export function pct(h: number, r: HourRange): number {
  return clamp(((h - r.from) / (r.to - r.from)) * 100, 0, 100);
}

/** Graduations : toutes les heures sur une plage de 8 h, sinon toutes les 2 h. */
export function axisHours(r: HourRange): number[] {
  const step = r.to - r.from <= 8 ? 1 : 2;
  const out: number[] = [];
  for (let h = r.from; h <= r.to; h += step) out.push(h);
  return out;
}

/** Heure arrondie au pas de 15 min, bornée à la frise, en « HH:mm ». */
export function snapToHHMM(h: number, durationH: number, r: HourRange): string {
  const clamped = Math.min(Math.max(h, r.from), r.to - Math.max(0.25, durationH));
  const q = Math.round((clamped * 60) / STEP_MIN) * STEP_MIN;
  return `${String(Math.floor(q / 60)).padStart(2, '0')}:${String(q % 60).padStart(2, '0')}`;
}

export type SunBand = { kind: 'nuit' | 'aube' | 'heure_doree'; from: number; to: number };

/** Bandes de lumière : nuit, aube, lumière du soir (suncalc, coordonnées du lieu du jour), coupées à la plage. */
export function sunBands(dateIso: string, location: Location | undefined, r: HourRange): SunBand[] {
  const { lat, lon } = locationCoords(location);
  const s = sunInfo(parseISO(dateIso), lat, lon);
  const bands: SunBand[] = [
    { kind: 'nuit', from: r.from, to: hourOf(s.dawn) },
    { kind: 'aube', from: hourOf(s.dawn), to: hourOf(s.goldenMorning.to) },
    { kind: 'heure_doree', from: hourOf(s.goldenEvening.from), to: hourOf(s.dusk) },
    { kind: 'nuit', from: hourOf(s.dusk), to: r.to },
  ];
  return bands
    .map((b) => ({ ...b, from: clamp(b.from, r.from, r.to), to: clamp(b.to, r.from, r.to) }))
    .filter((b) => b.to > b.from);
}

/** Lever et coucher du soleil du jour (pour les libellés sous la bande de lumière). */
export function sunMarks(dateIso: string, location: Location | undefined): { sunrise: Date; sunset: Date } {
  const { lat, lon } = locationCoords(location);
  const s = sunInfo(parseISO(dateIso), lat, lon);
  return { sunrise: s.sunrise, sunset: s.sunset };
}

/**
 * Place des libellés centrés sur leur position (px) sans chevauchement ni débordement :
 * un libellé qui en toucherait un autre passe sur la ligne suivante.
 */
export function placeLabels(
  items: { x: number; width: number }[],
  containerWidth: number,
  gap = 12,
): { left: number; row: number }[] {
  const rowsEnd: number[] = [];
  return items.map(({ x, width }) => {
    const left = clamp(x - width / 2, 0, Math.max(0, containerWidth - width));
    let row = rowsEnd.findIndex((end) => end + gap <= left);
    if (row < 0) {
      row = rowsEnd.length;
      rowsEnd.push(0);
    }
    rowsEnd[row] = left + width;
    return { left, row };
  });
}

/** Bande de lumière : le fond est le jour (or pâle), la nuit en encre, la lumière du soir en or. */
export const DAY_LIGHT_CLASS = 'bg-gold-soft';
export const LIGHT_CLASSES: Partial<Record<SunBand['kind'], string>> = {
  nuit: 'bg-ink',
  heure_doree: 'bg-gold',
};
