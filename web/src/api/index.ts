/**
 * Point d'entrée unique de la couche données.
 * VITE_USE_MOCKS=true → mocks/handlers.ts, sauf le Coach si VITE_REAL_COACH, les fonctions
 * listées dans VITE_REAL_ENDPOINTS (mode mixte) et le découpage si VITE_REAL_PARSE ;
 * VITE_USE_MOCKS=false → endpoints.ts (FastAPI), avec le Passeport IA lu et écrit dans Supabase
 * (supabase/passport.ts), sauf les fonctions de NOT_IN_BACKEND_YET.
 * Les deux respectent le type `Api` : aucun écran ne change quand on bascule.
 * Le Kit Festival (dossiers, pièces, synopsis) a sa propre couche : kit.ts.
 */
import { env } from '@/lib/env';
import * as real from './endpoints';
import { buildApi, unknownEndpoints } from './mixed';
import { mockApi } from './mocks/handlers';
import { getDb } from './mocks/db';
import { getPublicFilm } from './supabase/film';
import { supabasePassportApi } from './supabase/passport';
import type { Api } from './endpoints';

/**
 * Fonctions qui n'ont pas encore de route dans le backend : elles restent simulées même
 * avec VITE_USE_MOCKS=false. Retirer une ligne dès que la route existe côté FastAPI.
 * (Passeport, festivals, sous-titres et page film publique ont maintenant leur source réelle.)
 */
export const NOT_IN_BACKEND_YET = [
  'geocode',
  'quickSlots',
  'generateSchedule',
] as const satisfies readonly (keyof Api)[];

const realApi: Api = {
  // Passeport IA et catalogue des outils : Supabase et fichier de référence (le backend n'a pas ces routes)
  ...supabasePassportApi,
  createProject: real.createProject,
  getProject: real.getProject,
  updateProject: real.updateProject,
  deleteProject: real.deleteProject,
  parseScreenplay: real.parseScreenplay,
  geocode: real.geocode,
  suggestLocations: real.suggestLocations,
  suggestScenes: real.suggestScenes,
  detailScene: real.detailScene,
  quickSlots: real.quickSlots,
  generateSchedule: real.generateSchedule,
  getWeather: real.getWeather,
  generateShotSpec: real.generateShotSpec,
  getCalibration: real.getCalibration,
  listWorkspaces: real.listWorkspaces,
  putWorkspace: real.putWorkspace,
  deleteWorkspace: real.deleteWorkspace,
  searchFestivals: real.searchFestivals,
  getFestival: real.getFestival,
  createSubtitleDraft: real.createSubtitleDraft,
  getSubtitleDraft: real.getSubtitleDraft,
  saveSubtitles: real.saveSubtitles,
  getSynopsisFeedback: real.getSynopsisFeedback,
  translateSynopsis: real.translateSynopsis,
  // Page film publique : fonction SQL public_film (le backend n'a pas de route /films)
  getPublicFilm,
  previewCallsheets: real.previewCallsheets,
  sendCallsheets: real.sendCallsheets,
};

/** Backend pour ce qui existe, simulation pour le reste (VITE_USE_MOCKS=false). */
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

/** Fonctions réelles en mode démo : VITE_REAL_ENDPOINTS, plus le découpage si VITE_REAL_PARSE. */
export function demoRealEndpoints(realEndpoints: readonly string[], realParse: boolean): string[] {
  return realParse && !realEndpoints.includes('parseScreenplay')
    ? [...realEndpoints, 'parseScreenplay']
    : [...realEndpoints];
}

if (import.meta.env.DEV && env.useMocks) {
  const unknown = unknownEndpoints(env.realEndpoints, realApi);
  if (unknown.length)
    console.warn(`[api] VITE_REAL_ENDPOINTS : noms inconnus ignorés : ${unknown.join(', ')}`);
}

// Le Coach peut parler au vrai backend (plan par l'IA) pendant que le reste reste simulé.
const coachApi: Partial<Api> = env.realCoach
  ? {
      generateShotSpec: real.generateShotSpec,
      getCalibration: real.getCalibration,
      listWorkspaces: real.listWorkspaces,
      putWorkspace: real.putWorkspace,
      deleteWorkspace: real.deleteWorkspace,
    }
  : {};

// Avec les mocks : Coach réel si VITE_REAL_COACH, puis les fonctions de VITE_REAL_ENDPOINTS.
export const api: Api = env.useMocks
  ? buildApi({
      useMocks: true,
      realEndpoints: demoRealEndpoints(env.realEndpoints, env.realParse),
      real: realApi,
      mock: { ...mockApi, ...coachApi },
    })
  : mixedApi(realApi, mockApi);
export const coachIsReal = !env.useMocks || env.realCoach;
export const usingMocks = env.useMocks;
/** Fonctions servies par le vrai backend alors que les mocks sont actifs (groupes compris). */
export const realEndpointsInMockMode: readonly string[] = env.useMocks
  ? Object.keys(realApi).filter((n) => api[n as keyof Api] === realApi[n as keyof Api])
  : [];
/** Repli si le serveur de découpage est injoignable : seulement en mode démo. */
export const demoParseFallback = realEndpointsInMockMode.includes('parseScreenplay')
  ? mockApi.parseScreenplay
  : undefined;
/**
 * Questions du coach sur le synopsis : servies par le mock seulement. Le backend n'a pas encore
 * POST /synopsis/feedback : en mode réel, le bloc est masqué plutôt que d'afficher une erreur.
 */
export const synopsisFeedbackAvailable =
  env.useMocks && !realEndpointsInMockMode.includes('getSynopsisFeedback');
/** Sous-titres simulés : seulement quand le mode démo est demandé (VITE_USE_MOCKS=true, sans mode mixte). */
export const subtitlesSimulated = !realEndpointsInMockMode.includes('createSubtitleDraft') && env.useMocks;

export type { Api } from './endpoints';
export * from './types';
export { kitApi, type KitApi } from './kit';
export { ApiError, isApiError } from './client';
