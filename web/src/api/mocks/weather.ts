/**
 * Météo SIMULÉE et déterministe (même date → même météo), pour la démo uniquement.
 * - Prévision connue jusqu'à FORECAST_HORIZON_DAYS jours après aujourd'hui ;
 * - au-delà : forecast = 'hors_horizon' et rain_pct / wind_kmh / cloud_pct = null (« Météo à revérifier »).
 * Lever / coucher / heure dorée : vrais calculs astronomiques (suncalc).
 */
import { addDays, differenceInCalendarDays, eachDayOfInterval, formatISO, parseISO, startOfDay } from 'date-fns';
import type { WeatherDay } from '@/api/types';
import { isoDay } from '@/lib/format';
import { sunInfo } from '@/lib/sun';
import { FORECAST_HORIZON_DAYS } from '@/features/planner/lib/rules';

/** Jours de pluie / vent forcés (décalage depuis aujourd'hui) pour que la démo montre les replis INT. */
const RAINY_OFFSETS = new Set([7, 8, 12]);
const WINDY_OFFSETS = new Set([10]);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function mockWeatherDay(date: Date, lat: number, lon: number, today: Date = new Date()): WeatherDay {
  const dateIso = isoDay(date);
  const offset = differenceInCalendarDays(date, startOfDay(today));
  const sun = sunInfo(date, lat, lon);
  const base = {
    date: dateIso,
    sunrise: formatISO(sun.sunrise),
    sunset: formatISO(sun.sunset),
    golden_hour: { from: formatISO(sun.goldenEvening.from), to: formatISO(sun.goldenEvening.to) },
  };
  if (offset < 0 || offset > FORECAST_HORIZON_DAYS) {
    return { ...base, rain_pct: null, wind_kmh: null, cloud_pct: null, forecast: 'hors_horizon' };
  }
  const r = hash(`${dateIso}:${lat.toFixed(2)}`);
  const rain = RAINY_OFFSETS.has(offset) ? 60 + Math.round(r * 30) : Math.round(r * 30);
  const wind = WINDY_OFFSETS.has(offset) ? 45 + Math.round(r * 15) : 8 + Math.round(r * 22);
  const cloud = Math.min(100, Math.round(rain * 1.1 + r * 25));
  return { ...base, rain_pct: rain, wind_kmh: wind, cloud_pct: cloud, forecast: 'prevision' };
}

export function mockWeatherRange(from: string, to: string, lat: number, lon: number): WeatherDay[] {
  const start = parseISO(from);
  const end = parseISO(to);
  if (end < start) return [];
  return eachDayOfInterval({ start, end }).map((d) => mockWeatherDay(d, lat, lon));
}

export function demoDate(offsetDays: number): string {
  return isoDay(addDays(new Date(), offsetDays));
}
