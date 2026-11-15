import { z } from 'zod';
import { request } from '@/api/client';

export const sceneSchema = z.object({
  number: z.number().int().positive(),
  heading: z.string().min(1),
  setting: z.enum(['INT', 'EXT', 'UNKNOWN']),
  time_of_day: z.enum(['DAY', 'NIGHT', 'DAWN', 'DUSK', 'UNKNOWN']),
  location: z.string(),
  summary: z.string(),
  characters: z.array(z.string()),
  props: z.array(z.string()),
  technical_requirements: z.array(z.string()),
  production_challenges: z.array(z.string()),
  missing_information: z.array(z.string()),
  inferences: z.array(z.string()),
  suggestions: z.array(z.string()),
});
export const analysisSchema = z.object({
  title: z.string(),
  status: z.literal('Brouillon IA : à valider'),
  simulated: z.boolean(),
  scenes: z.array(sceneSchema).min(1),
  characters: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string(),
      scenes: z.array(z.number().int().positive()),
      production_observations: z.array(z.string()),
    }),
  ),
});
export type Analysis = z.infer<typeof analysisSchema>;
export type AnalyzedScene = z.infer<typeof sceneSchema>;
export const inputSchema = z.object({
  title: z.string().trim().min(1, 'Indique un titre.').max(200),
  content: z.string().trim().min(30, 'Écris au moins 30 caractères.').max(100_000),
});

// Deliberately bypasses legacy planner mocks. A failed AI call never becomes a demo.
export function analyzeScenario(input: { title: string; content: string }) {
  return request('/scenarios/analyze', {
    method: 'POST',
    body: input,
    schema: analysisSchema,
    timeoutMs: 190_000,
  });
}
