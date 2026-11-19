import { z } from 'zod';
import { calibrationSchema, shotChoicesShape, shotSpecSchema, timelineSchema } from '@/api/schemas';
import type { Calibration, ShotChoices, ShotSpec, ShotSpecRequest, Timeline } from '@/api/types';

/**
 * Sauvegarde LOCALE (dans le téléphone) du plan et de la calibration : le Coach marche hors ligne
 * une fois le plan généré. Le plan est rangé par utilisateur pour qu'un autre compte sur le même
 * téléphone ne le voie pas. Rien n'est envoyé au serveur.
 */
export const NOTE_MAX = 300;

export type StoredPlan = {
  request: ShotSpecRequest;
  spec: ShotSpec;
  /** Mots modifiés par l'utilisateur, par plan (identifiant du plan → champs changés). */
  overrides: Record<string, Partial<ShotChoices>>;
  /** Notes de l'utilisateur sur un plan en mouvement (identifiant du plan → texte). */
  notes: Record<string, string>;
  /** Chronologie d'un plan en mouvement modifiée par l'utilisateur (identifiant du plan → chronologie). */
  timelines: Record<string, Timeline>;
  savedAt: string;
};

const planKey = (userId: string) => `pp-coach-plan-v1:${userId}`;
const CALIBRATION_KEY = 'pp-coach-calibration-v1';
const choicesPartial = z.object(shotChoicesShape).partial();

export function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // stockage indisponible ou contenu corrompu
  }
}

export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* plein ou bloqué (navigation privée) : le plan reste en mémoire pour cette session */
  }
}

/** Valide un plan lu dans le stockage : null si le contenu est invalide ou corrompu. */
export function parseStoredPlan(value: unknown): StoredPlan | null {
  const raw = value as Partial<StoredPlan> | null;
  if (!raw || typeof raw !== 'object') return null;
  const spec = shotSpecSchema.safeParse(raw.spec);
  if (!spec.success) return null;
  const overrides: StoredPlan['overrides'] = {};
  const stored = raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {};
  for (const shot of spec.data.shots) {
    const parsed = choicesPartial.safeParse(stored[shot.id]);
    if (parsed.success && Object.keys(parsed.data).length > 0) overrides[shot.id] = parsed.data;
  }
  const notes: StoredPlan['notes'] = {};
  const storedNotes = raw.notes && typeof raw.notes === 'object' ? raw.notes : {};
  for (const shot of spec.data.shots) {
    const note = storedNotes[shot.id];
    if (typeof note === 'string' && note.trim()) notes[shot.id] = note.slice(0, NOTE_MAX);
  }
  const timelines: StoredPlan['timelines'] = {};
  const storedTimelines = raw.timelines && typeof raw.timelines === 'object' ? raw.timelines : {};
  for (const shot of spec.data.shots) {
    if (!shot.timeline) continue;
    const parsed = timelineSchema.safeParse(storedTimelines[shot.id]);
    if (parsed.success) timelines[shot.id] = parsed.data;
  }
  return {
    request: raw.request && typeof raw.request.description === 'string' ? raw.request : { description: '' },
    spec: spec.data,
    overrides,
    notes,
    timelines,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '',
  };
}

export const loadPlan = (userId: string): StoredPlan | null => parseStoredPlan(read(planKey(userId)));

export const savePlan = (userId: string, plan: StoredPlan): void => write(planKey(userId), plan);

export function clearPlan(userId: string): void {
  try {
    localStorage.removeItem(planKey(userId));
  } catch {
    /* rien à faire */
  }
}

export function loadCalibration(): Calibration | null {
  const parsed = calibrationSchema.safeParse(read(CALIBRATION_KEY));
  return parsed.success ? parsed.data : null;
}

export const saveCalibration = (cal: Calibration): void => write(CALIBRATION_KEY, cal);
