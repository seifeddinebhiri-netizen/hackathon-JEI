import { describe, expect, it } from 'vitest';
import { passportWithReturn, safeReturnPath } from './retour';

describe('retour après le Passeport', () => {
  it('accepte un chemin du Kit Festival', () => {
    expect(safeReturnPath('/festival/dossiers/vienna-shorts/declaration-ia')).toBe(
      '/festival/dossiers/vienna-shorts/declaration-ia',
    );
    expect(passportWithReturn('/festival/dossiers/a/declaration-ia')).toBe(
      '/passeport?retour=%2Ffestival%2Fdossiers%2Fa%2Fdeclaration-ia',
    );
  });
  it('refuse toute autre destination', () => {
    for (const bad of [
      'https://exemple.invalid',
      '//exemple.invalid',
      '/planner',
      'festival/x',
      '/festival/\\evil',
      null,
    ]) {
      expect(safeReturnPath(bad)).toBeNull();
    }
  });
});
