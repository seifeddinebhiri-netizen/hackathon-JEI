/**
 * Point d'entrée unique de la couche données.
 * VITE_USE_MOCKS=true → mocks/handlers.ts, sauf le Coach si VITE_REAL_COACH et les fonctions
 * listées dans VITE_REAL_ENDPOINTS (mode mixte) ; sinon → endpoints.ts (FastAPI), avec le
 * Passeport IA lu et écrit dans Supabase (supabase/passport.ts), catalogue d'outils et PDF signé par le backend.
 * Les deux respectent le type `Api` : aucun écran ne change quand on bascule.
 * Le Kit Festival (dossiers, pièces, synopsis) a sa propre couche : kit.ts.
 */
import { env } from '@/lib/env';
import * as real from './endpoints';
import { buildApi, unknownEndpoints } from './mixed';
import { mockApi } from './mocks/handlers';
import { getPublicFilm } from './supabase/film';
import { supabasePassportApi } from './supabase/passport';
import type { Api } from './endpoints';

const realApi: Api = {
  // Passeport IA : déclarations lues et écrites dans Supabase ; catalogue des outils, recherche d'un outil
  // absent et PDF signé : backend (le PDF est fabriqué et signé par le serveur).
  ...supabasePassportApi,
  getAiTools: real.getAiTools,
  resolveAiTool: real.resolveAiTool,
  getAiToolRun: real.getAiToolRun,
  getPassportPdfUrl: real.getPassportPdfUrl,
  verifyPassportPdf: real.verifyPassportPdf,
  createProject: real.createProject,
  getProject: real.getProject,
  updateProject: real.updateProject,
  deleteProject: real.deleteProject,
  parseScreenplay: real.parseScreenplay,
  geocode: real.geocode,
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
};

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
export const api: Api = buildApi({
  useMocks: env.useMocks,
  realEndpoints: env.realEndpoints,
  real: realApi,
  mock: { ...mockApi, ...coachApi },
});
export const coachIsReal = !env.useMocks || env.realCoach;
export const usingMocks = env.useMocks;
/** Fonctions servies par le vrai backend alors que les mocks sont actifs (groupes compris). */
export const realEndpointsInMockMode: readonly string[] = env.useMocks
  ? Object.keys(realApi).filter((n) => api[n as keyof Api] === realApi[n as keyof Api])
  : [];
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
