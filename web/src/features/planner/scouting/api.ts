import { z } from 'zod';
import { request } from '@/api/client';

export const categories = {
  cafe: 'Café',
  restaurant: 'Restaurant',
  park: 'Parc / jardin',
  beach: 'Plage',
  street: 'Rue résidentielle',
  building: 'Bâtiment',
  nature: 'Espace naturel',
} as const;
export type Category = keyof typeof categories;
export const candidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  categories: z.array(z.string()),
  source: z.literal('Geoapify / OpenStreetMap'),
  availability: z.literal('unverified'),
  fetched_at: z.string(),
});
export const searchSchema = z.object({
  region: z.string(),
  center_lat: z.number(),
  center_lon: z.number(),
  category: z.enum(['cafe', 'restaurant', 'park', 'beach', 'street', 'building', 'nature']),
  radius_km: z.number(),
  candidates: z.array(candidateSchema),
});
const hourSchema = z.object({
  time: z.string(),
  temperature_c: z.number().nullable(),
  wind_kmh: z.number().nullable(),
  precipitation_mm: z.number().nullable(),
  cloud_pct: z.number().nullable(),
  is_day: z.union([z.literal(0), z.literal(1)]).nullable(),
});
export const weatherSchema = z.object({
  location_id: z.string(),
  date: z.string(),
  status: z.enum(['available', 'unavailable']),
  reason: z.string().nullable(),
  timezone: z.string(),
  sunrise: z.string().nullable(),
  sunset: z.string().nullable(),
  hours: z.array(hourSchema),
  source: z.literal('Open-Meteo'),
  fetched_at: z.string(),
});
export const slotSchema = z.object({
  start: z.string(),
  end: z.string(),
  score: z.number().nullable(),
  verdict: z.enum(['favorable', 'a_verifier', 'defavorable', 'unavailable']),
  reasons: z.array(z.string()),
  weather: hourSchema,
});
export const evaluationSchema = z.object({
  location: candidateSchema,
  weather: weatherSchema,
  slots: z.array(slotSchema),
  ai_status: z.enum(['not_requested', 'available', 'unavailable']),
  ai_explanation: z.string().nullable(),
});
export const requirementsSchema = z
  .object({
    setting: z.enum(['INT', 'EXT', 'UNKNOWN']),
    moment: z.enum(['DAY', 'NIGHT', 'DAWN', 'DUSK', 'UNKNOWN']),
    max_wind_kmh: z.number().min(0).max(200),
    max_precipitation_mm: z.number().min(0).max(100),
    min_cloud_pct: z.number().min(0).max(100),
    max_cloud_pct: z.number().min(0).max(100),
    min_temperature_c: z.number().min(-60).max(60),
    max_temperature_c: z.number().min(-60).max(60),
  })
  .refine(
    (r) => r.min_cloud_pct <= r.max_cloud_pct && r.min_temperature_c <= r.max_temperature_c,
    'Les valeurs minimales doivent être inférieures aux maximales.',
  );
export type Candidate = z.infer<typeof candidateSchema>;
export type Weather = z.infer<typeof weatherSchema>;
export type Evaluation = z.infer<typeof evaluationSchema>;
export type Requirements = z.infer<typeof requirementsSchema>;
export type Slot = z.infer<typeof slotSchema>;
export type SearchResult = z.infer<typeof searchSchema>;
export const DEFAULT_REQUIREMENTS: Requirements = {
  setting: 'EXT',
  moment: 'DAY',
  max_wind_kmh: 25,
  max_precipitation_mm: 0.2,
  min_cloud_pct: 0,
  max_cloud_pct: 100,
  min_temperature_c: 5,
  max_temperature_c: 35,
};
export const searchLocations = (input: { region: string; category: Category; radius_km: number }) =>
  request('/locations/search', { query: input, schema: searchSchema, timeoutMs: 60_000 });
export const getLocationWeather = (id: string, date: string) =>
  request(`/locations/${encodeURIComponent(id)}/weather`, {
    query: { date },
    schema: weatherSchema,
    timeoutMs: 60_000,
  });
export const interpretScene = (text: string) =>
  request('/locations/interpret-scene', {
    method: 'POST',
    body: { text },
    timeoutMs: 90_000,
    schema: z.object({
      category: searchSchema.shape.category,
      keywords: z.array(z.string()),
      explanation: z.string(),
    }),
  });
export type EvaluationInput = {
  location_ids: string[];
  date: string;
  requirements: Requirements;
  scene_text: string;
  explain_with_ollama: boolean;
};
export const evaluateLocations = (input: EvaluationInput) =>
  request('/planning/evaluate-location', {
    method: 'POST',
    body: input,
    schema: z.array(evaluationSchema),
    timeoutMs: 120_000,
  });
