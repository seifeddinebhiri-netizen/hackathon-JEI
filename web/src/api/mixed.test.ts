import { describe, expect, it, vi } from 'vitest';
import { serverErrorMessage } from './client';
import type { Api } from './endpoints';
import { buildApi, unknownEndpoints } from './mixed';
import { list } from '@/lib/env';

/** Faux `Api` : chaque fonction renvoie l'origine (réel ou mock) pour vérifier l'aiguillage. */
function fakeApi(origin: 'reel' | 'mock'): Api {
  return new Proxy({} as Api, {
    get: (_t, name) => vi.fn(async () => `${origin}:${String(name)}`),
    has: () => true,
    ownKeys: () => [
      'searchFestivals',
      'getFestival',
      'getProject',
      'createSubtitleDraft',
      'getSubtitleDraft',
      'saveSubtitles',
      'getProjectPassport',
      'savePassport',
      'checkPassport',
      'verifyPassport',
      'verifyPassportPdf',
      'getPassportPdfUrl',
      'getAiTools',
      'resolveAiTool',
      'getAiToolRun',
    ],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
}

describe('mode mixte (VITE_REAL_ENDPOINTS)', () => {
  const real = fakeApi('reel');
  const mock = fakeApi('mock');

  it('envoie les fonctions listées au vrai backend, les autres aux mocks', async () => {
    const api = buildApi({ useMocks: true, realEndpoints: ['searchFestivals', 'getFestival'], real, mock });
    await expect(api.searchFestivals({})).resolves.toBe('reel:searchFestivals');
    await expect(api.getFestival('x')).resolves.toBe('reel:getFestival');
    await expect(api.getProject('p')).resolves.toBe('mock:getProject');
    await expect(api.getSubtitleDraft('p')).resolves.toBe('mock:getSubtitleDraft');
  });

  it('sous-titres : nommer une fonction rend les trois réelles (création, relecture, enregistrement)', async () => {
    const api = buildApi({ useMocks: true, realEndpoints: ['createSubtitleDraft'], real, mock });
    await expect(api.getSubtitleDraft('p')).resolves.toBe('reel:getSubtitleDraft');
    await expect(api.saveSubtitles('p', [])).resolves.toBe('reel:saveSubtitles');
    await expect(api.getProject('p')).resolves.toBe('mock:getProject');
  });

  it('Passeport IA : nommer une fonction rend réels le Passeport, le catalogue, la recherche et le PDF signé', async () => {
    const api = buildApi({ useMocks: true, realEndpoints: ['getPassportPdfUrl'], real, mock });
    for (const name of [
      'getProjectPassport',
      'savePassport',
      'checkPassport',
      'verifyPassport',
      'verifyPassportPdf',
      'getAiTools',
      'resolveAiTool',
      'getAiToolRun',
    ] as const) {
      await expect((api[name] as unknown as () => Promise<string>)()).resolves.toBe(`reel:${name}`);
    }
    // Le projet reste simulé tant qu'on ne le demande pas : voir .env.example (il doit exister en base).
    await expect(api.getProject('p')).resolves.toBe('mock:getProject');
  });

  it('sans mocks, tout passe par le vrai backend', async () => {
    const api = buildApi({ useMocks: false, realEndpoints: [], real, mock });
    await expect(api.getProject('p')).resolves.toBe('reel:getProject');
  });

  it('liste vide : tout reste simulé', async () => {
    const api = buildApi({ useMocks: true, realEndpoints: [], real, mock });
    await expect(api.searchFestivals({})).resolves.toBe('mock:searchFestivals');
  });

  it('lit la variable : virgules, espaces et cases vides', () => {
    expect(list(' searchFestivals, getFestival ,,')).toEqual(['searchFestivals', 'getFestival']);
    expect(list(undefined)).toEqual([]);
  });

  it('signale les noms inconnus', () => {
    const realApi = { searchFestivals: vi.fn() } as unknown as Api;
    expect(unknownEndpoints(['searchFestivals', 'searchFestival'], realApi)).toEqual(['searchFestival']);
  });
});

describe('message d’erreur du serveur', () => {
  it('lit { error: { code, message } } du backend FastAPI', () => {
    expect(
      serverErrorMessage({ error: { code: 'festival_not_found', message: 'Festival introuvable.' } }),
    ).toBe('Festival introuvable.');
  });
  it('lit aussi message et detail', () => {
    expect(serverErrorMessage({ message: 'A' })).toBe('A');
    expect(serverErrorMessage({ detail: 'B' })).toBe('B');
    expect(serverErrorMessage({ detail: [{ msg: 'x' }] })).toBeUndefined();
    expect(serverErrorMessage(null)).toBeUndefined();
  });
});
