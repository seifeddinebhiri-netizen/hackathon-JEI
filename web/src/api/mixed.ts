/**
 * Mode mixte : avec les mocks, les fonctions listées dans VITE_REAL_ENDPOINTS passent
 * quand même par le vrai backend (ex. searchFestivals,getFestival). Les autres restent simulées.
 */
import type { Api } from './endpoints';

export function buildApi(opts: {
  useMocks: boolean;
  realEndpoints: readonly string[];
  real: Api;
  mock: Api;
}): Api {
  if (!opts.useMocks) return opts.real;
  const names = new Set(opts.realEndpoints);
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
