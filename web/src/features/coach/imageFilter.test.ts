import { describe, expect, it, vi } from 'vitest';
import { ADJUST_FIELDS, createFilterPipeline, isNeutral, NEUTRAL } from './imageFilter';

describe('retouche de l’image', () => {
  it('l’état neutre ne change rien', () => {
    expect(isNeutral(NEUTRAL)).toBe(true);
    expect(isNeutral({ ...NEUTRAL, contrast: 1.1 })).toBe(false);
  });

  it('chaque curseur contient la valeur neutre et a un pas utilisable', () => {
    for (const f of ADJUST_FIELDS) {
      expect(NEUTRAL[f.key], f.key).toBeGreaterThanOrEqual(f.min);
      expect(NEUTRAL[f.key], f.key).toBeLessThanOrEqual(f.max);
      expect(f.step).toBeGreaterThan(0);
    }
  });

  it('sans WebGL, aucune retouche n’est créée (l’appli reste sur la caméra directe)', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    expect(createFilterPipeline(document.createElement('video'), canvas, () => NEUTRAL)).toBeNull();
  });
});

import { applyAdjustRgba } from './imageFilter';
import { analyzeRgba } from './measure/imageStats';

const px = (r: number, g: number, b: number) => new Uint8ClampedArray([r, g, b, 255]);

describe('mesure de l’image retouchée (même formule que l’affichage)', () => {
  it('sans réglage, les pixels ne changent pas', () => {
    const d = px(120, 80, 200);
    applyAdjustRgba(d, NEUTRAL);
    expect([...d]).toEqual([120, 80, 200, 255]);
  });

  it('+1 IL double la lumière (limité à 255)', () => {
    const d = px(60, 100, 200);
    applyAdjustRgba(d, { ...NEUTRAL, exposure: 1 });
    expect([...d]).toEqual([120, 200, 255, 255]);
  });

  it('saturation 0 : gris ; chaleur +1 : plus de rouge, moins de bleu', () => {
    const gray = px(200, 100, 50);
    applyAdjustRgba(gray, { ...NEUTRAL, saturation: 0 });
    expect(gray[0]).toBe(gray[1]);
    expect(gray[1]).toBe(gray[2]);
    const warm = px(100, 100, 100);
    applyAdjustRgba(warm, { ...NEUTRAL, temperature: 1 });
    expect(warm[0]).toBeGreaterThan(warm[2]);
  });

  it('régler le contraste fait bouger la mesure : la consigne peut donc disparaître', () => {
    const w = 8;
    const make = () => {
      const d = new Uint8ClampedArray(w * w * 4);
      for (let i = 0; i < w * w; i++) d.set(i % 2 ? [140, 140, 140, 255] : [110, 110, 110, 255], i * 4);
      return d;
    };
    const flat = make();
    const before = analyzeRgba(flat, w, w).contrast;
    applyAdjustRgba(flat, { ...NEUTRAL, contrast: 1.5 });
    expect(analyzeRgba(flat, w, w).contrast).toBeGreaterThan(before * 1.3);
  });
});
