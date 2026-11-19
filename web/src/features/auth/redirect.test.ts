import { describe, expect, it } from 'vitest';
import { loginPath, safeNext } from './redirect';

describe('?suite= : seulement des chemins internes', () => {
  it.each([
    ['/planner/calendrier', '/planner/calendrier'],
    ['/festival/dossiers?onglet=2#piece', '/festival/dossiers?onglet=2#piece'],
    ['/planner/jour/2026-11-21', '/planner/jour/2026-11-21'],
  ])('garde %s', (raw, expected) => expect(safeNext(raw)).toBe(expected));

  it.each([
    [null],
    [''],
    ['https://pirate.example/'],
    ['//pirate.example/x'],
    ['/\\pirate.example'],
    ['\\\\pirate.example'],
    ['javascript:alert(1)'],
    ['planner'],
    ['/projet\n//pirate.example'],
    ['/connexion?suite=/projet'],
    ['/nouveau-mot-de-passe'],
    [`/${'a'.repeat(3000)}`],
  ])('refuse %j', (raw) => expect(safeNext(raw)).toBe('/projet'));

  it('construit l’adresse de connexion', () => {
    expect(loginPath('/planner/calendrier?vue=mois')).toBe(
      '/connexion?suite=%2Fplanner%2Fcalendrier%3Fvue%3Dmois',
    );
    expect(loginPath('/projet')).toBe('/connexion');
    expect(loginPath('https://pirate.example')).toBe('/connexion');
    expect(loginPath()).toBe('/connexion');
  });
});
