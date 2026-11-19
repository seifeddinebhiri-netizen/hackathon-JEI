/**
 * Mode mixte : avec les mocks, les fonctions listées dans VITE_REAL_ENDPOINTS passent
 * quand même par le vrai backend (ex. searchFestivals,getFestival). Les autres restent simulées.
 */
import type { Api } from './endpoints';

/**
 * Fonctions qui vont ensemble : en nommer une rend les autres réelles aussi. Sans cela, un
 * brouillon de sous-titres créé par le vrai backend serait relu dans le mock (et remplacé par
 * le brouillon d'exemple au rechargement).
 */
export const ENDPOINT_GROUPS: readonly (readonly (keyof Api)[])[] = [
  ['createSubtitleDraft', 'getSubtitleDraft', 'saveSubtitles'],
];

export function expandGroups(names: readonly string[]): string[] {
  const out = new Set(names);
  for (const group of ENDPOINT_GROUPS) if (group.some((n) => out.has(n))) for (const n of group) out.add(n);
  return [...out];
}

export function buildApi(opts: {
  useMocks: boolean;
  realEndpoints: readonly string[];
  real: Api;
  mock: Api;
}): Api {
  if (!opts.useMocks) return opts.real;
  const names = new Set(expandGroups(opts.realEndpoints));
  const api = { ...opts.mock };
  for (const key of Object.keys(opts.real) as (keyof Api)[]) {
    if (names.has(key)) (api as Record<keyof Api, unknown>)[key] = opts.real[key];
  }
  return api;
}

/** Noms inconnus de VITE_REAL_ENDPOINTS (faute de frappe) : signalés en développement. */
export function unknownEndpoints(realEndpoints: readonly string[], real: Api): string[] {
  return realEndpoints.filter((n) => !(n in real));
}
