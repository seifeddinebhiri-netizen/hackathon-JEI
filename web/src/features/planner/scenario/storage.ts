import { z } from 'zod';
import { analysisSchema } from './api';

export const SESSION_KEY = 'encadre-scenario-v1';
export const HANDOFF_KEY = 'encadre-scenario-handoff-v1';
export const sessionSchema = z.object({
  title: z.string(),
  content: z.string(),
  analysis: analysisSchema.nullable(),
  confirmed: z.boolean(),
});
export type ScenarioSession = z.infer<typeof sessionSchema>;
export const EMPTY: ScenarioSession = { title: '', content: '', analysis: null, confirmed: false };
export function readSession(): ScenarioSession {
  try {
    return sessionSchema.parse(JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null'));
  } catch {
    return EMPTY;
  }
}
