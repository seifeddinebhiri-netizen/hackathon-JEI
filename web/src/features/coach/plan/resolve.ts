import type { Calibration, PlanShot, ShotChoices, ShotIntent, ShotTargets, Timeline } from '@/api/types';
import { CHOICE_KEYS, choicesOf, computeTargets, effectiveIntent } from './computeTargets';
import { recomputeTimeline, timelinesEqual } from './timeline';

export type ResolvedShot = {
  /** Le plan réellement utilisé : la proposition de l'IA + les mots modifiés. */
  intent: ShotIntent;
  /** Champs dont la valeur diffère de la proposition de l'IA. */
  edited: (keyof ShotChoices)[];
  /**
   * Cibles chiffrées. Plan non modifié : celles du serveur. Plan modifié : recalculées ici avec la
   * calibration. `null` si elles ne peuvent pas être recalculées (calibration absente ou d'une autre
   * version) : il faut alors se reconnecter une fois.
   */
  targets: ShotTargets | null;
};

export function resolveShot(
  shot: PlanShot,
  overrides: Partial<ShotChoices> | undefined,
  calibration: Calibration | undefined,
  specCalibrationVersion: string,
): ResolvedShot {
  const intent = effectiveIntent(shot.intent, overrides);
  const edited = CHOICE_KEYS.filter((k) => intent[k] !== shot.intent[k]);
  if (edited.length === 0) return { intent, edited, targets: shot.targets };
  const usable = calibration && calibration.version === specCalibrationVersion;
  return { intent, edited, targets: usable ? computeTargets(choicesOf(intent), calibration) : null };
}

/** Enregistre (ou retire) une modification : une valeur égale à la proposition de l'IA n'est pas une modification. */
export function withOverride<K extends keyof ShotChoices>(
  overrides: Partial<ShotChoices> | undefined,
  original: ShotChoices,
  key: K,
  value: ShotChoices[K],
): Partial<ShotChoices> {
  const next = { ...overrides };
  if (value === original[key]) delete next[key];
  else next[key] = value;
  return next;
}

export type ResolvedTimeline = {
  /** La chronologie réellement utilisée ; null si ses chiffres ne peuvent pas être recalculés. */
  timeline: Timeline | null;
  /** Modifiée par l'utilisateur par rapport à la proposition de l'IA. */
  edited: boolean;
};

/**
 * Chronologie d'un plan en mouvement. Non modifiée : celle du serveur. Modifiée : ses chiffres sont
 * recalculés avec la calibration ; sans calibration (ou d'une autre version), pas de chiffres inventés.
 */
export function resolveTimeline(
  shot: PlanShot,
  edited: Timeline | undefined,
  calibration: Calibration | undefined,
  specCalibrationVersion: string,
): ResolvedTimeline | null {
  const ai = shot.timeline;
  if (!ai) return null;
  if (!edited || timelinesEqual(edited, ai)) return { timeline: ai, edited: false };
  const usable = calibration && calibration.version === specCalibrationVersion;
  return { timeline: usable ? recomputeTimeline(edited, calibration) : null, edited: true };
}
