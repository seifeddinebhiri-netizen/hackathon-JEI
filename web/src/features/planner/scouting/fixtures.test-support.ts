import type { Candidate, Evaluation, Slot, Weather } from './api';

// Provider fixtures for automated tests only. Never imported by application code.
export const PLACE: Candidate = {
  id: 'a'.repeat(24),
  name: 'Café réel de test',
  address: 'Adresse du fournisseur',
  lat: 36.8,
  lon: 10.1,
  categories: ['catering.cafe'],
  source: 'Geoapify / OpenStreetMap',
  availability: 'unverified',
  fetched_at: '2026-11-15T00:00:00Z',
};
export const WEATHER: Weather = {
  location_id: PLACE.id,
  date: '2026-11-16',
  status: 'available',
  reason: null,
  timezone: 'Africa/Tunis',
  sunrise: '2026-11-16T05:00:00Z',
  sunset: '2026-11-16T17:00:00Z',
  fetched_at: '2026-11-15T00:00:00Z',
  source: 'Open-Meteo',
  hours: [
    {
      time: '2026-11-16T09:00:00Z',
      temperature_c: 20,
      wind_kmh: 10,
      precipitation_mm: 0,
      cloud_pct: 20,
      is_day: 1,
    },
  ],
};
export const SLOT: Slot = {
  start: WEATHER.hours[0].time,
  end: '2026-11-16T10:00:00Z',
  score: 100,
  verdict: 'favorable',
  reasons: ['Seuils respectés ; autorisation non vérifiée.'],
  weather: WEATHER.hours[0],
};
export const EVALUATION: Evaluation = {
  location: PLACE,
  weather: WEATHER,
  slots: [SLOT],
  ai_status: 'not_requested',
  ai_explanation: null,
};
