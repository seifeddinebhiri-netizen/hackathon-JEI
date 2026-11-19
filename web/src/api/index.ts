/**
 * Point d'entrée unique de la couche données.
 * VITE_USE_MOCKS=true → tout passe par mocks/handlers.ts ;
 * VITE_USE_MOCKS=false → endpoints.ts (FastAPI), sauf les fonctions de NOT_IN_BACKEND_YET.
 * Les deux respectent le type `Api` : aucun écran ne change quand on bascule.
 */
import { env } from '@/lib/env';
import * as real from './endpoints';
import { mockApi } from './mocks/handlers';
import { getDb } from './mocks/db';
import type { Api } from './endpoints';

/**
 * Fonctions qui n'ont pas encore de route dans le backend : elles restent simulées même
 * avec VITE_USE_MOCKS=false. Retirer une ligne dès que la route existe côté FastAPI.
 */
export const NOT_IN_BACKEND_YET = [
  'geocode',
  'quickSlots',
  'generateSchedule',
  'getAiTools',
  'getProjectPassport',
  'savePassport',
  'checkPassport',
  'getPassportPdfUrl',
  'signC2pa',
  'verifyPassport',
  'searchFestivals',
  'getSubtitleDraft',
  'saveSubtitles',
  'getSynopsisFeedback',
  'getPublicFilm',
] as const satisfies readonly (keyof Api)[];

const realApi: Api = {
  createProject: real.createProject,
  getProject: real.getProject,
  updateProject: real.updateProject,
  deleteProject: real.deleteProject,
  parseScreenplay: real.parseScreenplay,
  geocode: real.geocode,
  suggestLocations: real.suggestLocations,
  suggestScenes: real.suggestScenes,
  quickSlots: real.quickSlots,
  generateSchedule: real.generateSchedule,
  getWeather: real.getWeather,
  getAiTools: real.getAiTools,
  getProjectPassport: real.getProjectPassport,
  savePassport: real.savePassport,
  checkPassport: real.checkPassport,
  getPassportPdfUrl: real.getPassportPdfUrl,
  signC2pa: real.signC2pa,
  verifyPassport: real.verifyPassport,
  searchFestivals: real.searchFestivals,
  getSubtitleDraft: real.getSubtitleDraft,
  saveSubtitles: real.saveSubtitles,
  getSynopsisFeedback: real.getSynopsisFeedback,
  getPublicFilm: real.getPublicFilm,
  previewCallsheets: real.previewCallsheets,
  sendCallsheets: real.sendCallsheets,
};

/** Backend pour ce qui existe, simulation pour le reste. */
export function mixedApi(backend: Api, mocks: Api): Api {
  const api: Api = { ...backend };
  for (const name of NOT_IN_BACKEND_YET) {
    (api as Record<keyof Api, unknown>)[name] = mocks[name];
  }
  // Le plan de travail simulé lit le projet dans la base simulée : on lui donne d'abord le
  // vrai projet du backend, sinon il répond « introuvable ».
  if ((NOT_IN_BACKEND_YET as readonly string[]).includes('generateSchedule')) {
    api.generateSchedule = async (req) => {
      getDb().projects[req.project_id] = await backend.getProject(req.project_id);
      return mocks.generateSchedule(req);
    };
  }
  return api;
}

/** Mode démo, sauf le découpage du scénario qui passe par le vrai backend (VITE_REAL_PARSE). */
export function demoApi(mocks: Api, realParse: boolean): Api {
  return realParse ? { ...mocks, parseScreenplay: real.parseScreenplay } : mocks;
}

export const api: Api = env.useMocks ? demoApi(mockApi, env.realParse) : mixedApi(realApi, mockApi);
export const usingMocks = env.useMocks;
/** Repli si le serveur de découpage est injoignable : seulement en mode démo. */
export const demoParseFallback = env.useMocks && env.realParse ? mockApi.parseScreenplay : undefined;

export type { Api } from './endpoints';
export * from './types';
export { ApiError, isApiError } from './client';
