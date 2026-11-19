import { describe, expect, it } from 'vitest';
import type { Calibration, ShotChoices, ShotTargets } from '@/api/types';
import fixture from './fixtures/targets_cases.json';
import { choicesOf, computeTargets, effectiveIntent } from './computeTargets';

const calibration = fixture.calibration as unknown as Calibration;
const cases = fixture.cases as unknown as { intent: ShotChoices; targets: ShotTargets }[];

/** Compare récursivement avec une tolérance (les nombres viennent de Python). */
function expectSame(actual: unknown, expected: unknown, where: string) {
  if (typeof expected === 'number') return expect(actual as number, where).toBeCloseTo(expected, 9);
  if (expected && typeof expected === 'object') {
    for (const [k, v] of Object.entries(expected))
      expectSame((actual as Record<string, unknown>)[k], v, `${where}.${k}`);
    return;
  }
  expect(actual, where).toEqual(expected);
}

describe('computeTargets : même résultat que le backend (Python)', () => {
  it('le jeu d’essai couvre toutes les valeurs de chaque champ', () => {
    expect(cases.length).toBeGreaterThan(60);
    for (const field of calibration.vocabulary) {
      const seen = new Set(cases.map((c) => c.intent[field.key]));
      for (const o of field.options) expect(seen.has(o.value as never), `${field.key}:${o.value}`).toBe(true);
    }
  });

  it.each(cases.map((c, i) => [i, c] as const))('cas %i', (i, c) => {
    expectSame(computeTargets(c.intent, calibration), c.targets, `cas ${i}`);
  });
});

describe('modifications de l’utilisateur', () => {
  const base = cases[0].intent;
  it('changer « hauteur de la caméra » change les chiffres du tangage, sans toucher au reste', () => {
    const before = computeTargets(base, calibration);
    const after = computeTargets({ ...base, camera_angle: 'low' }, calibration);
    expect(after.pitch_deg).not.toEqual(before.pitch_deg);
    expect(after.pitch_deg!.min).toBeGreaterThan(0); // contre-plongée : la caméra regarde vers le haut
    expect(after.luma).toEqual(before.luma);
  });

  it('plan en mouvement : tout est suivi comme dans un plan fixe, seul le tremblement est écarté', () => {
    const fixed = computeTargets({ ...base, movement: 'static' }, calibration);
    expect(fixed.shake_max).not.toBeNull();
    for (const movement of ['pan', 'tilt', 'tracking'] as const) {
      const t = computeTargets({ ...base, movement }, calibration);
      // la chronologie fait varier les cibles ; chaque passage a les mêmes contrôles qu'un plan fixe
      expect({ ...t, shake_max: null }).toEqual({ ...fixed, shake_max: null });
      expect(t.shake_max, movement).toBeNull(); // la rotation voulue d'un panoramique n'est pas un tremblement
    }
  });

  it('sans sujet : plus de position ni d’espace au-dessus de la tête', () => {
    const t = computeTargets({ ...base, subject_kind: 'none' }, calibration);
    expect(t.center_x).toBeNull();
    expect(t.headroom).toBeNull();
  });

  it('effectiveIntent applique les mots modifiés et garde les textes de l’IA', () => {
    const intent = { ...base, label_fr: 'Plan', why_fr: 'Parce que', rule_ids: ['R-008'], advice_fr: [] };
    const merged = effectiveIntent(intent, { size: 'WS' });
    expect(merged.size).toBe('WS');
    expect(merged.why_fr).toBe('Parce que');
    expect(choicesOf(merged)).not.toHaveProperty('why_fr');
  });
});
