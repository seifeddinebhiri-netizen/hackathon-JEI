import type { CheckId, Reading, Readings } from '../checks';
import type { FaceMetrics } from './face';
import type { Targets } from './targets';

/** Tout ce que le téléphone mesure. `null` = non mesurable pour l'instant. */
export type Measurements = {
  roll: number | null;
  pitch: number | null;
  shake: number | null;
  luma: number | null;
  contrast: number | null;
  warmth: number | null;
  clipHigh: number | null;
  clipLow: number | null;
  face: FaceMetrics | null;
  /** Luminosité du fond / luminosité du visage (> 1 : visage plus sombre que le fond). */
  backlightRatio: number | null;
};

export const NO_MEASUREMENTS: Measurements = {
  roll: null,
  pitch: null,
  shake: null,
  luma: null,
  contrast: null,
  warmth: null,
  clipHigh: null,
  clipLow: null,
  face: null,
  backlightRatio: null,
};

const OK: Reading = { ok: true };
const bad = (variant: string, amount: number): Reading => (amount >= 1 ? { ok: false, variant, amount } : OK);
const pct = (v: number) => Math.round(v * 100);

/**
 * Compare les mesures aux cibles : un résultat par contrôle (vert, ou rouge avec la variante de
 * consigne et le nombre à corriger). Les contrôles sans mesure sont listés dans `unmeasured` et
 * jamais présentés comme « bons ».
 */
export type Comparison = {
  readings: Readings;
  /** Pas de mesure pour l'instant (visage absent, capteur indisponible...). */
  unmeasured: Set<CheckId>;
  /** Sans objet pour ce plan (plan en mouvement, pas de sujet...) : rien à vérifier. */
  notApplicable: Set<CheckId>;
};

export function compare(t: Targets, m: Measurements): Comparison {
  const readings: Record<CheckId, Reading> = {
    horizon: OK,
    angle: OK,
    size: OK,
    position: OK,
    headroom: OK,
    light: OK,
    contrast: OK,
    backlight: OK,
    steady: OK,
  }; // fmt: skip
  const unmeasured = new Set<CheckId>();
  const notApplicable = new Set<CheckId>();
  // Taille du sujet : demande la pose du corps, pas encore de modèle.
  (t.subject_h ? unmeasured : notApplicable).add('size');

  // Horizon : la valeur absolue de l'inclinaison doit tomber dans [min, max].
  if (m.roll === null) unmeasured.add('horizon');
  else {
    const abs = Math.abs(m.roll);
    const excess =
      abs > t.roll_abs_deg.max
        ? -(abs - t.roll_abs_deg.max)
        : abs < t.roll_abs_deg.min
          ? t.roll_abs_deg.min - abs
          : 0;
    // roll > 0 : téléphone tourné à gauche -> corriger vers la droite (et inversement).
    const towardRight = m.roll >= 0 === excess < 0;
    readings.horizon = bad(towardRight ? 'right' : 'left', Math.round(Math.abs(excess)));
  }

  // Angle : tangage dans [min, max].
  if (!t.pitch_deg) notApplicable.add('angle');
  else if (m.pitch === null) unmeasured.add('angle');
  else if (m.pitch < t.pitch_deg.min) readings.angle = bad('up', Math.round(t.pitch_deg.min - m.pitch));
  else if (m.pitch > t.pitch_deg.max) readings.angle = bad('down', Math.round(m.pitch - t.pitch_deg.max));

  // Position : centre du visage sur la ligne de tiers visée.
  if (!t.center_x) notApplicable.add('position');
  else if (!m.face) unmeasured.add('position');
  else if (m.face.centerX < t.center_x.min)
    readings.position = bad('left', pct(t.center_x.min - m.face.centerX));
  else if (m.face.centerX > t.center_x.max)
    readings.position = bad('right', pct(m.face.centerX - t.center_x.max));

  // Espace au-dessus de la tête.
  if (!t.headroom) notApplicable.add('headroom');
  else if (!m.face) unmeasured.add('headroom');
  else if (m.face.headroom < t.headroom.min)
    readings.headroom = bad('little', pct(t.headroom.min - m.face.headroom));
  else if (m.face.headroom > t.headroom.max)
    readings.headroom = bad('much', pct(m.face.headroom - t.headroom.max));

  // Lumière : luminosité moyenne.
  if (m.luma === null) unmeasured.add('light');
  else if (m.luma < t.luma.min) readings.light = bad('dark', pct(t.luma.min - m.luma));
  else if (m.luma > t.luma.max) readings.light = bad('bright', pct(m.luma - t.luma.max));

  // Contraste : écart entre les zones les plus sombres et les plus claires.
  if (m.contrast === null) unmeasured.add('contrast');
  else if (m.contrast < t.contrast.min) readings.contrast = bad('low', pct(t.contrast.min - m.contrast));
  else if (m.contrast > t.contrast.max) readings.contrast = bad('high', pct(m.contrast - t.contrast.max));

  // Contre-jour : le fond est plus clair que le visage au-delà du rapport toléré.
  if (t.backlight_ratio_max === null)
    notApplicable.add('backlight'); // contre-jour voulu
  else if (m.backlightRatio === null) unmeasured.add('backlight');
  else if (m.backlightRatio > t.backlight_ratio_max)
    readings.backlight = bad('on', Math.round(m.backlightRatio));

  // Stabilité : vitesse de rotation efficace.
  if (t.shake_max === null) notApplicable.add('steady');
  else if (m.shake === null) unmeasured.add('steady');
  else if (m.shake > t.shake_max) readings.steady = { ok: false, variant: 'shaky', amount: 0 };

  return { readings, unmeasured, notApplicable };
}

/** Anti-clignotement : un voyant ne change d'état qu'après avoir tenu un moment. */
export const TURN_RED_AFTER_MS = 600;
export const TURN_GREEN_AFTER_MS = 300;

export type Smoothed = { shown: Reading; candidateSince: number | null };
export const INITIAL_SMOOTHED: Smoothed = { shown: OK, candidateSince: null };

const sameKind = (a: Reading, b: Reading) =>
  a.ok === b.ok && (a.ok || (b !== OK && !b.ok && a.variant === b.variant));

/** Fait évoluer l'état affiché d'un voyant vers la mesure brute, avec délai et sans clignoter. */
export function smoothReading(state: Smoothed, raw: Reading, nowMs: number): Smoothed {
  if (sameKind(state.shown, raw)) {
    // Même état : on suit simplement la valeur (le nombre de la consigne peut bouger).
    return { shown: raw, candidateSince: null };
  }
  const since = state.candidateSince ?? nowMs;
  const wait = raw.ok ? TURN_GREEN_AFTER_MS : TURN_RED_AFTER_MS;
  return nowMs - since >= wait
    ? { shown: raw, candidateSince: null }
    : { shown: state.shown, candidateSince: since };
}
