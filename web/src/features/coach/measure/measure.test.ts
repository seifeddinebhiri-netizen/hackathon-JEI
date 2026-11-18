import { describe, expect, it } from 'vitest';
import { analyzeRgba } from './imageStats';
import {
  compare,
  INITIAL_SMOOTHED,
  NO_MEASUREMENTS,
  smoothReading,
  TURN_GREEN_AFTER_MS,
  TURN_RED_AFTER_MS,
  type Measurements,
} from './compare';
import { faceMetrics, HEAD_TOP_OVER_FACE, pickMainFace } from './face';
import { rollPitch, ShakeMeter, smoothVec, toScreenFrame, upFromEuler } from './orientation';
import { SAMPLE_TARGETS } from './targets';

const near = (a: number, b: number, d = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(d);

describe('inclinaison', () => {
  it('téléphone debout et droit : horizon droit, caméra à l’horizontale', () => {
    const r = rollPitch(upFromEuler(90, 0));
    near(r.roll, 0);
    near(r.pitch, 0);
  });

  it('haut du téléphone vers l’arrière (beta > 90) : la caméra regarde vers le haut', () => {
    near(rollPitch(upFromEuler(100, 0)).pitch, 10);
    near(rollPitch(upFromEuler(80, 0)).pitch, -10);
  });

  it('à plat sur une table : caméra vers le bas, inclinaison d’horizon non valide', () => {
    const r = rollPitch(upFromEuler(0, 0));
    near(r.pitch, -90);
    expect(r.rollValid).toBe(false);
  });

  it('téléphone tourné vers la gauche de 10° : roll = +10', () => {
    const phi = (10 * Math.PI) / 180;
    near(rollPitch({ x: Math.sin(phi), y: Math.cos(phi), z: 0 }).roll, 10);
    near(rollPitch({ x: -Math.sin(phi), y: Math.cos(phi), z: 0 }).roll, -10);
  });

  it('paysage : un téléphone tourné de 90° vers la gauche et tenu droit a un horizon droit', () => {
    const up = { x: 1, y: 0, z: 0 }; // le haut du monde est le côté droit de l'écran naturel
    near(rollPitch(up, 90).roll, 0);
    near(toScreenFrame(up, 90).up, 1);
    near(rollPitch({ x: -1, y: 0, z: 0 }, 270).roll, 0);
    near(rollPitch({ x: 0, y: -1, z: 0 }, 180).roll, 0);
  });

  it('le lissage garde un vecteur unitaire et rapproche de la nouvelle valeur', () => {
    const a = { x: 0, y: 1, z: 0 };
    const b = { x: 1, y: 0, z: 0 };
    const s = smoothVec(a, b, 0.5);
    near(Math.hypot(s.x, s.y, s.z), 1);
    expect(s.x).toBeGreaterThan(0);
    expect(smoothVec(null, b, 0.5)).toBe(b);
  });

  it('tremblement : nul à l’arrêt, plus élevé en mouvement, null sans mesure', () => {
    const calm = new ShakeMeter();
    expect(calm.rms()).toBeNull();
    for (let t = 0; t < 1000; t += 50) calm.push(t, 0);
    expect(calm.rms()).toBe(0);
    const shaky = new ShakeMeter();
    for (let t = 0; t < 1000; t += 50) shaky.push(t, 20);
    near(shaky.rms()!, (20 * Math.PI) / 180);
  });
});

/** Image synthétique w×h : f(x, y) donne [r, g, b]. */
function image(w: number, h: number, f: (x: number, y: number) => [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = f(x, y);
      d.set([r, g, b, 255], (y * w + x) * 4);
    }
  return d;
}

describe('analyse de l’image', () => {
  it('gris moyen : luminosité ~0,5, aucun contraste, couleurs neutres', () => {
    const s = analyzeRgba(
      image(8, 8, () => [128, 128, 128]),
      8,
      8,
    );
    near(s.luma, 128 / 255, 0.01);
    expect(s.contrast).toBe(0);
    near(s.warmth, 0, 0.01);
    expect(s.clipHigh).toBe(0);
  });

  it('moitié noire, moitié blanche : fort contraste, parties brûlée et bouchée', () => {
    const s = analyzeRgba(
      image(8, 8, (x) => (x < 4 ? [0, 0, 0] : [255, 255, 255])),
      8,
      8,
    );
    expect(s.contrast).toBeGreaterThan(0.9);
    near(s.clipHigh, 0.5);
    near(s.clipLow, 0.5);
  });

  it('dominante orange = chaud (> 0), dominante bleue = froid (< 0)', () => {
    expect(
      analyzeRgba(
        image(4, 4, () => [220, 140, 60]),
        4,
        4,
      ).warmth,
    ).toBeGreaterThan(0.5);
    expect(
      analyzeRgba(
        image(4, 4, () => [60, 140, 220]),
        4,
        4,
      ).warmth,
    ).toBeLessThan(-0.5);
  });

  it('contre-jour : visage sombre devant un fond clair', () => {
    const face = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    const s = analyzeRgba(
      image(8, 8, (x, y) => (x >= 2 && x < 6 && y >= 2 && y < 6 ? [40, 40, 40] : [230, 230, 230])),
      8,
      8,
      face,
    );
    expect(s.backgroundLuma! / s.faceLuma!).toBeGreaterThan(4);
  });

  it('sans visage : pas de mesure de contre-jour', () => {
    const s = analyzeRgba(
      image(4, 4, () => [100, 100, 100]),
      4,
      4,
    );
    expect(s.faceLuma).toBeNull();
    expect(s.backgroundLuma).toBeNull();
  });
});

describe('visage', () => {
  it('position, hauteur et espace estimé au-dessus de la tête', () => {
    const m = faceMetrics({ x: 0.3, y: 0.3, w: 0.2, h: 0.2 });
    near(m.centerX, 0.4);
    near(m.centerY, 0.4);
    near(m.height, 0.2);
    near(m.headroom, 0.3 - HEAD_TOP_OVER_FACE * 0.2);
    expect(faceMetrics({ x: 0.3, y: 0, w: 0.2, h: 0.2 }).headroom).toBe(0);
  });

  it('le visage principal est le plus grand', () => {
    expect(pickMainFace([])).toBeNull();
    const big = { x: 0, y: 0, w: 0.3, h: 0.3 };
    expect(pickMainFace([{ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, big])).toBe(big);
  });
});

const GOOD: Measurements = {
  roll: 0.5,
  pitch: 1,
  shake: 0.02,
  luma: 0.45,
  contrast: 0.2,
  warmth: 0,
  clipHigh: 0,
  clipLow: 0,
  face: { centerX: 1 / 3, centerY: 0.4, height: 0.2, headroom: 0.1 },
  backlightRatio: 1.1,
};

describe('comparaison aux cibles', () => {
  it('tout est dans les cibles : tout est vert, seule la taille n’est pas mesurée', () => {
    const { readings, unmeasured } = compare(SAMPLE_TARGETS, GOOD);
    expect(Object.values(readings).every((r) => r.ok)).toBe(true);
    expect([...unmeasured]).toEqual(['size']);
  });

  it('sans aucune mesure : rien n’est présenté comme bon', () => {
    const { unmeasured } = compare(SAMPLE_TARGETS, NO_MEASUREMENTS);
    expect(unmeasured.size).toBe(9);
  });

  it('caméra trop basse de 7° : « angle » rouge, variante « up », valeur 5 (cible -4)', () => {
    const { readings } = compare(SAMPLE_TARGETS, { ...GOOD, pitch: -9 });
    expect(readings.angle).toEqual({ ok: false, variant: 'up', amount: 5 });
    expect(compare(SAMPLE_TARGETS, { ...GOOD, pitch: 12 }).readings.angle).toEqual({
      ok: false,
      variant: 'down',
      amount: 8,
    });
  });

  it('horizon : corriger vers la droite si le téléphone est tourné à gauche, et inversement', () => {
    expect(compare(SAMPLE_TARGETS, { ...GOOD, roll: 6 }).readings.horizon).toEqual({
      ok: false,
      variant: 'right',
      amount: 4,
    });
    expect(compare(SAMPLE_TARGETS, { ...GOOD, roll: -6 }).readings.horizon).toEqual({
      ok: false,
      variant: 'left',
      amount: 4,
    });
  });

  it('position : visage trop à droite -> « right », trop à gauche -> « left »', () => {
    const at = (centerX: number) =>
      compare(SAMPLE_TARGETS, { ...GOOD, face: { ...GOOD.face!, centerX } }).readings.position;
    expect(at(0.7)).toMatchObject({ ok: false, variant: 'right' });
    expect(at(0.05)).toMatchObject({ ok: false, variant: 'left' });
  });

  it('espace au-dessus de la tête : trop peu / trop', () => {
    const at = (headroom: number) =>
      compare(SAMPLE_TARGETS, { ...GOOD, face: { ...GOOD.face!, headroom } }).readings.headroom;
    expect(at(0)).toMatchObject({ ok: false, variant: 'little' });
    expect(at(0.3)).toMatchObject({ ok: false, variant: 'much' });
  });

  it('lumière : trop sombre / trop claire', () => {
    expect(compare(SAMPLE_TARGETS, { ...GOOD, luma: 0.2 }).readings.light).toEqual({
      ok: false,
      variant: 'dark',
      amount: 15,
    });
    expect(compare(SAMPLE_TARGETS, { ...GOOD, luma: 0.8 }).readings.light).toEqual({
      ok: false,
      variant: 'bright',
      amount: 20,
    });
  });

  it('contraste : trop faible / trop fort (cible 0,15 à 0,30)', () => {
    expect(compare(SAMPLE_TARGETS, { ...GOOD, contrast: 0.05 }).readings.contrast).toEqual({
      ok: false,
      variant: 'low',
      amount: 10,
    });
    expect(compare(SAMPLE_TARGETS, { ...GOOD, contrast: 0.5 }).readings.contrast).toEqual({
      ok: false,
      variant: 'high',
      amount: 20,
    });
    expect(compare(SAMPLE_TARGETS, { ...GOOD, contrast: null }).unmeasured.has('contrast')).toBe(true);
  });

  it('contre-jour et tremblement', () => {
    expect(compare(SAMPLE_TARGETS, { ...GOOD, backlightRatio: 4 }).readings.backlight).toEqual({
      ok: false,
      variant: 'on',
      amount: 4,
    });
    expect(compare(SAMPLE_TARGETS, { ...GOOD, shake: 0.5 }).readings.steady).toMatchObject({
      ok: false,
      variant: 'shaky',
    });
  });

  it('sans visage : position, tête et contre-jour sont non mesurés, le reste continue', () => {
    const { unmeasured } = compare(SAMPLE_TARGETS, { ...GOOD, face: null, backlightRatio: null });
    expect([...unmeasured].sort()).toEqual(['backlight', 'headroom', 'position', 'size']);
  });
});

describe('plan en mouvement', () => {
  const moving = {
    ...SAMPLE_TARGETS,
    pitch_deg: null,
    subject_h: null,
    center_x: null,
    headroom: null,
    shake_max: null,
  };

  it('angle, taille, position, tête et tremblement sont « sans objet » ; le reste est surveillé', () => {
    const { readings, unmeasured, notApplicable } = compare(moving, {
      ...GOOD,
      roll: 6,
      luma: 0.2,
      pitch: 40,
      shake: 5,
    });
    expect([...notApplicable].sort()).toEqual(['angle', 'headroom', 'position', 'size', 'steady']);
    expect(unmeasured.size).toBe(0);
    expect(readings.angle).toEqual({ ok: true }); // la caméra bouge exprès : aucune consigne
    expect(readings.steady).toEqual({ ok: true });
    expect(readings.horizon).toMatchObject({ ok: false, variant: 'right' }); // l'horizon reste surveillé
    expect(readings.light).toMatchObject({ ok: false, variant: 'dark' });
  });

  it('sans sujet (plan de décor) : taille, position et tête sans objet', () => {
    const { notApplicable } = compare(
      { ...SAMPLE_TARGETS, subject_h: null, center_x: null, headroom: null },
      GOOD,
    );
    expect([...notApplicable].sort()).toEqual(['headroom', 'position', 'size']);
  });

  it('contre-jour voulu (silhouette) : sans objet', () => {
    expect(
      compare({ ...SAMPLE_TARGETS, backlight_ratio_max: null }, GOOD).notApplicable.has('backlight'),
    ).toBe(true);
  });
});

describe('anti-clignotement', () => {
  const red = { ok: false as const, variant: 'up', amount: 5 };
  it('un voyant ne passe au rouge qu’après un moment, puis suit la valeur', () => {
    let s = smoothReading(INITIAL_SMOOTHED, red, 1000);
    expect(s.shown.ok).toBe(true);
    s = smoothReading(s, red, 1000 + TURN_RED_AFTER_MS - 1);
    expect(s.shown.ok).toBe(true);
    s = smoothReading(s, red, 1000 + TURN_RED_AFTER_MS);
    expect(s.shown).toEqual(red);
    s = smoothReading(s, { ...red, amount: 7 }, 3000);
    expect(s.shown).toEqual({ ok: false, variant: 'up', amount: 7 });
  });

  it('un bref écart ne change rien, et le retour au vert est plus rapide', () => {
    let s = smoothReading(INITIAL_SMOOTHED, red, 0);
    s = smoothReading(s, { ok: true }, 200); // le problème a disparu avant d'être affiché
    expect(s).toEqual(INITIAL_SMOOTHED);
    s = { shown: red, candidateSince: null };
    s = smoothReading(s, { ok: true }, 5000);
    expect(s.shown).toEqual(red);
    s = smoothReading(s, { ok: true }, 5000 + TURN_GREEN_AFTER_MS);
    expect(s.shown).toEqual({ ok: true });
  });
});
