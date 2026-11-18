/**
 * Point d'entrée unique de la couche données.
 * VITE_USE_MOCKS=true → mocks/handlers.ts, sauf le Coach si VITE_REAL_COACH et les fonctions
 * listées dans VITE_REAL_ENDPOINTS (mode mixte) ; sinon → endpoints.ts (FastAPI).
 * Les deux respectent le type `Api` : aucun écran ne change quand on bascule.
 */
import { env } from '@/lib/env';
import * as real from './endpoints';
import { buildApi, unknownEndpoints } from './mixed';
import { mockApi } from './mocks/handlers';
import type { Api } from './endpoints';

const realApi: Api = {
  createProject: real.createProject,
  getProject: real.getProject,
  updateProject: real.updateProject,
  deleteProject: real.deleteProject,
  parseScreenplay: real.parseScreenplay,
  geocode: real.geocode,
  quickSlots: real.quickSlots,
  generateSchedule: real.generateSchedule,
  getWeather: real.getWeather,
  getAiTools: real.getAiTools,
  generateShotSpec: real.generateShotSpec,
  getCalibration: real.getCalibration,
  listWorkspaces: real.listWorkspaces,
  putWorkspace: real.putWorkspace,
  deleteWorkspace: real.deleteWorkspace,
  getProjectPassport: real.getProjectPassport,
  savePassport: real.savePassport,
  checkPassport: real.checkPassport,
  getPassportPdfUrl: real.getPassportPdfUrl,
  signC2pa: real.signC2pa,
  verifyPassport: real.verifyPassport,
  searchFestivals: real.searchFestivals,
  getFestival: real.getFestival,
  createSubtitleDraft: real.createSubtitleDraft,
  getSubtitleDraft: real.getSubtitleDraft,
  saveSubtitles: real.saveSubtitles,
  getSynopsisFeedback: real.getSynopsisFeedback,
  translateSynopsis: real.translateSynopsis,
  getPublicFilm: real.getPublicFilm,
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
/** Mode mixte : la version simulée reste un repli quand le vrai backend échoue (choix explicite à l'écran). */
export const mockFallback: Api | null = env.useMocks ? mockApi : null;
/** Fonctions servies par le vrai backend alors que les mocks sont actifs. */
export const realEndpointsInMockMode: readonly string[] = env.useMocks
  ? env.realEndpoints.filter((n) => n in realApi)
  : [];

export type { Api } from './endpoints';
export * from './types';
export { ApiError, isApiError } from './client';
