import type { NumRange, ShotTargets } from '@/api/types';

/** Cibles chiffrées d'un plan : le type de l'API (mêmes noms que `ShotTargets` du backend). */
export type Range = NumRange;
export type Targets = ShotTargets;

/**
 * ÉCHANTILLON en attendant le branchement du vrai shot spec : plan moyen, sujet sur le tiers
 * gauche, à hauteur des yeux, horizon droit, exposition équilibrée, contre-jour à éviter,
 * à main levée. Valeurs recopiées des tables v0 du backend (services/calibration.py), donc des
 * réglages de départ à calibrer, pas des faits sourcés.
 */
export const SAMPLE_TARGETS: Targets = {
  roll_abs_deg: { min: 0, max: 2 },
  pitch_deg: { min: -4, max: 4 },
  subject_h: { min: 0.3, max: 0.45 },
  center_x: { min: 1 / 3 - 0.06, max: 1 / 3 + 0.06 },
  center_y: null,
  headroom: { min: 0.06, max: 0.14 },
  luma: { min: 0.35, max: 0.6 },
  contrast: { min: 0.15, max: 0.3 },
  backlight_ratio_max: 1.5,
  sun_offset_abs_deg: null,
  shake_max: 0.12,
};
