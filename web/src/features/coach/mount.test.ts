import { beforeEach, describe, expect, it } from 'vitest';
import {
  clampTilt,
  correctPitch,
  DEFAULT_MOUNT,
  describeTilt,
  loadMount,
  MOUNT_TILT,
  saveMount,
} from './mount';

describe('montage du téléphone sur une vraie caméra', () => {
  it('seul le téléphone : l’angle n’est pas corrigé, même si une inclinaison traîne', () => {
    expect(correctPitch(10, { kind: 'phone', tiltDeg: 5 })).toBe(10);
  });

  it('téléphone qui regarde plus haut que la caméra (+) : l’angle de la caméra est plus bas', () => {
    expect(correctPitch(10, { kind: 'above', tiltDeg: 3 })).toBe(7);
    expect(correctPitch(2, { kind: 'below', tiltDeg: -1.5 })).toBe(3.5);
  });

  it('l’inclinaison est bornée et arrondie au pas du curseur', () => {
    expect(clampTilt(99)).toBe(MOUNT_TILT.max);
    expect(clampTilt(-99)).toBe(MOUNT_TILT.min);
    expect(clampTilt(1.26)).toBe(1.5);
    expect(clampTilt(Number.NaN)).toBe(0);
  });

  it('phrases en français', () => {
    expect(describeTilt(0)).toBe('parallèle à la caméra');
    expect(describeTilt(2)).toBe('2° plus haut que la caméra');
    expect(describeTilt(-1.5)).toBe('1,5° plus bas que la caméra');
  });

  describe('mémorisation', () => {
    beforeEach(() => localStorage.clear());
    it('aller-retour, et valeur par défaut si rien ou contenu invalide', () => {
      expect(loadMount()).toEqual(DEFAULT_MOUNT);
      saveMount({ kind: 'above', tiltDeg: 2.5 });
      expect(loadMount()).toEqual({ kind: 'above', tiltDeg: 2.5 });
      localStorage.setItem('pp-coach-mount-v1', JSON.stringify({ kind: 'sur-le-toit', tiltDeg: 3 }));
      expect(loadMount()).toEqual(DEFAULT_MOUNT);
      localStorage.setItem('pp-coach-mount-v1', '{pas du json');
      expect(loadMount()).toEqual(DEFAULT_MOUNT);
    });
  });
});
