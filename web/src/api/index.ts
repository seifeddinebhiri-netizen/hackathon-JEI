/**
 * Point d'entrée unique de la couche données.
 * VITE_USE_MOCKS=true → mocks/handlers.ts ; sinon → endpoints.ts (FastAPI).
 * Les deux respectent le type `Api` : aucun écran ne change quand on bascule.
 */
import { env } from '@/lib/env';
import * as real from './endpoints';
import { mockApi } from './mocks/handlers';
import type { Api } from './endpoints';

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
};

export const api: Api = env.useMocks ? mockApi : realApi;
export const usingMocks = env.useMocks;

export type { Api } from './endpoints';
export * from './types';
export { ApiError, isApiError } from './client';
