import { z } from 'zod';
import type { ShotSpecRequest } from '@/api/types';

export const MOODS = [
  'Tendue',
  'Mélancolique',
  'Joyeuse',
  'Intime',
  'Mystérieuse',
  'Solennelle',
  'Nostalgique',
  'Étouffante',
  'Apaisée',
  'Comique',
];
export const STYLES = ['Documentaire', 'Naturaliste', 'Onirique', 'Brut', 'Stylisé', 'Intimiste'];

/** Durée saisie (« 10 », « 7,5 ») en secondes, entre 2 et 120 ; null si elle est invalide. */
export function parseDuration(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n >= 2 && n <= 120 ? n : null;
}

export const schema = z
  .object({
    description: z
      .string()
      .trim()
      .min(10, 'Décris la scène en une ou deux phrases (10 caractères minimum).')
      .max(2000, '2000 caractères au maximum.'),
    setting: z.enum(['unknown', 'INT', 'EXT']),
    moment: z.enum(['', 'jour', 'nuit', 'aube', 'heure_doree']),
    location: z.string().trim().max(200),
    characters: z.string().trim().max(400),
    mood: z.array(z.string()).max(5, '5 ambiances au maximum.'),
    moodOther: z.string().trim().max(40, '40 caractères au maximum.'),
    visual_style: z.string().trim().max(120),
    intention: z.string().trim().max(400, '400 caractères au maximum.'),
    light: z.string().trim().max(200),
    support: z.enum(['unknown', 'handheld', 'tripod']),
    motion: z.enum(['unknown', 'fixed', 'moving']),
    duration: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.motion === 'moving' && parseDuration(v.duration) === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration'],
        message: 'Indique la durée estimée de la scène, entre 2 et 120 secondes.',
      });
    }
  });
export type Values = z.infer<typeof schema>;

export const EMPTY: Values = {
  description: '',
  setting: 'unknown',
  moment: '',
  location: '',
  characters: '',
  mood: [],
  moodOther: '',
  visual_style: '',
  intention: '',
  light: '',
  support: 'unknown',
  motion: 'unknown',
  duration: '',
};

/** Le formulaire devient la demande envoyée à l'IA : seuls les champs remplis partent. */
export function toRequest(v: Values, sceneId?: string): ShotSpecRequest {
  const characters = v.characters
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 8);
  const mood = [...v.mood, ...(v.moodOther ? [v.moodOther] : [])].slice(0, 5);
  return {
    description: v.description,
    ...(sceneId ? { scene_id: sceneId } : {}),
    ...(v.setting !== 'unknown' ? { setting: v.setting } : {}),
    ...(v.moment ? { moment: v.moment } : {}),
    ...(v.location ? { location: v.location } : {}),
    ...(characters.length ? { characters } : {}),
    ...(mood.length ? { mood } : {}),
    ...(v.visual_style ? { visual_style: v.visual_style } : {}),
    ...(v.intention ? { intention: v.intention } : {}),
    ...(v.light ? { light: v.light } : {}),
    ...(v.support !== 'unknown' ? { support: v.support } : {}),
    ...(v.motion !== 'unknown' ? { motion: v.motion } : {}),
    // La durée ne concerne que les plans en mouvement : un plan fixe n'en a pas besoin.
    ...(v.motion === 'moving' && parseDuration(v.duration) !== null
      ? { duration_s: parseDuration(v.duration)! }
      : {}),
  };
}

export function fromRequest(r: ShotSpecRequest | undefined): Values {
  if (!r) return EMPTY;
  return {
    ...EMPTY,
    description: r.description,
    setting:
      r.setting === 'INT' || r.setting === 'interior'
        ? 'INT'
        : r.setting === 'EXT' || r.setting === 'exterior'
          ? 'EXT'
          : 'unknown',
    moment: r.moment ?? '',
    location: r.location ?? '',
    characters: (r.characters ?? []).join(', '),
    mood: (r.mood ?? []).filter((m) => MOODS.includes(m)),
    moodOther: (r.mood ?? []).find((m) => !MOODS.includes(m)) ?? '',
    visual_style: r.visual_style ?? '',
    intention: r.intention ?? '',
    light: r.light ?? '',
    support: r.support ?? 'unknown',
    motion: r.motion ?? 'unknown',
    duration: r.duration_s !== undefined ? String(r.duration_s).replace('.', ',') : '',
  };
}
