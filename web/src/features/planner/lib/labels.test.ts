import { describe, expect, it } from 'vitest';
import type { Location, ScheduleConflict, WeatherDay } from '@/api/types';
import { conflictSentence, dayWeatherInWords, WIZARD_LOCATIONS_URL } from './labels';

const loc = { id: 'l', name: 'Médina', address: '', forbidden_days: [], permit: 'a_demander' } as Location;
const c = (kind: ScheduleConflict['kind']): ScheduleConflict => ({ kind, message: 'm' });
const weather = (rain: number, wind = 10): WeatherDay => ({
  date: '2026-11-22',
  rain_pct: rain,
  wind_kmh: wind,
  cloud_pct: 40,
  sunrise: '',
  sunset: '',
  golden_hour: { from: '', to: '' },
  forecast: 'prevision',
});
const jour = { moment: 'jour' as const };

describe('conflictSentence', () => {
  it('écrit chaque conflit en phrase simple, avec son action', () => {
    expect(conflictSentence(c('autorisation_manquante'), jour, loc)).toEqual({
      text: 'Autorisation de tournage à demander pour Médina.',
      action: { kind: 'link', label: 'Ouvrir l’étape Lieux', to: WIZARD_LOCATIONS_URL },
    });
    expect(conflictSentence(c('pluie'), jour, loc, { weather: weather(65) })).toEqual({
      text: 'Pluie probable (65 %) pendant cette scène en extérieur.',
      action: { kind: 'move', label: 'Déplacer vers…' },
    });
    expect(conflictSentence(c('vent'), jour, loc, { weather: weather(0, 50) }).text).toBe(
      'Vent fort prévu (50 km/h).',
    );
    expect(conflictSentence(c('lieu_ferme'), jour, loc).text).toBe('Médina est fermé ce jour-là.');
    expect(conflictSentence(c('jour_trop_long'), jour, loc, { maxHours: 8 }).text).toBe(
      'La journée dépasse 8 h de tournage.',
    );
    expect(conflictSentence(c('meteo_a_reverifier'), jour, loc)).toEqual({
      text: 'Météo pas encore disponible pour cette date : à revérifier quelques jours avant.',
    });
  });
});

describe('dayWeatherInWords', () => {
  it('dit ce que la pluie implique', () => {
    expect(dayWeatherInWords(weather(65), false)[0]).toMatchObject({
      text: 'Pluie probable (65 %), pas de gêne : tout est en intérieur',
      tone: 'ok',
    });
    expect(dayWeatherInWords(weather(65), true)[0]).toMatchObject({
      text: 'Pluie probable (65 %) : risque pour les scènes en extérieur',
      tone: 'bad',
    });
    expect(dayWeatherInWords(weather(11), true)[0].text).toBe('Sec · pluie 11 %');
  });
});
