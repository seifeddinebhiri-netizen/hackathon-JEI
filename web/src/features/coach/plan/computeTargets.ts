import { shotChoicesShape } from '@/api/schemas';
import type { Calibration, NumRange, ShotChoices, ShotIntent, ShotTargets } from '@/api/types';

/**
 * « Mots → nombres », exactement comme `compute_targets` du backend (backend/app/services/calibration.py).
 * Quand l'utilisateur change un mot du plan, le téléphone recalcule les cibles ici, sans réseau,
 * avec les tables de `GET /calibration` mises en cache. Le test `computeTargets.test.ts` compare
 * ce calcul aux résultats Python (fixtures/targets_cases.json).
 */
const range = ([min, max]: [number, number]): NumRange => ({ min, max });

export function computeTargets(c: ShotChoices, cal: Calibration): ShotTargets {
  const t = cal.tables;
  // Tout est suivi, y compris dans un plan en mouvement (la chronologie fait varier les cibles).
  // Seul le tremblement est écarté quand la caméra bouge exprès.
  const moving = cal.rules.moving.includes(c.movement);
  const hasSubject = !cal.rules.no_subject.includes(c.subject_kind);
  const hasHead = cal.rules.has_head.includes(c.subject_kind);
  const centerX = t.center_x[c.subject_position];
  const sun = t.sun_offset_abs[c.sun_relative];
  return {
    roll_abs_deg: range(t.roll_abs[c.tilt]),
    pitch_deg: range(t.pitch[c.camera_angle]),
    subject_h: hasSubject ? range(t.subject_h[c.size]) : null,
    center_x: hasSubject ? { min: centerX - cal.third_tol, max: centerX + cal.third_tol } : null,
    center_y: null,
    headroom: hasHead ? range(t.headroom[c.size]) : null,
    luma: range(t.luma[c.exposure]),
    contrast: range(t.contrast[c.light_contrast]),
    backlight_ratio_max: t.backlight_ratio_max[c.backlight] ?? null,
    sun_offset_abs_deg: sun ? range(sun) : null,
    shake_max: moving ? null : t.shake_max[c.stability],
  };
}

export const CHOICE_KEYS = Object.keys(shotChoicesShape) as (keyof ShotChoices)[];

/** Extrait les champs à choix fermé d'un plan (sans les textes). */
export function choicesOf(intent: ShotChoices): ShotChoices {
  return Object.fromEntries(CHOICE_KEYS.map((k) => [k, intent[k]])) as ShotChoices;
}

/** Le plan réellement utilisé : la proposition de l'IA + les mots modifiés par l'utilisateur. */
export function effectiveIntent(intent: ShotIntent, overrides: Partial<ShotChoices> | undefined): ShotIntent {
  return { ...intent, ...overrides };
}
