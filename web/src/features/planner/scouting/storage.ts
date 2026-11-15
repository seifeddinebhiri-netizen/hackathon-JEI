import { z } from 'zod';
import { candidateSchema, requirementsSchema, slotSchema } from './api';

export const SCOUTING_KEY = 'encadre-scouting-v1';
export const choiceSchema = z.object({
  scene_id: z.string(),
  scene_number: z.string(),
  scene_heading: z.string(),
  date: z.string(),
  location: candidateSchema,
  slot: slotSchema,
  requirements: requirementsSchema,
  confirmed_at: z.string(),
  timezone: z.string(),
});
export type ScoutChoice = z.infer<typeof choiceSchema>;
export function readChoices(): ScoutChoice[] {
  try {
    return z
      .array(choiceSchema)
      .max(50)
      .parse(JSON.parse(sessionStorage.getItem(SCOUTING_KEY) ?? '[]'));
  } catch {
    return [];
  }
}
export function saveChoice(choice: ScoutChoice) {
  const choices = [...readChoices().filter((c) => c.scene_id !== choice.scene_id), choice].slice(-50);
  sessionStorage.setItem(SCOUTING_KEY, JSON.stringify(choices));
}
