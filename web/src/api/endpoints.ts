/**
 * Vrais appels au backend FastAPI. Une fonction par endpoint (voir docs/API_CONTRACT.md).
 * mocks/handlers.ts expose EXACTEMENT la même signature (type `Api`).
 */
import { z } from 'zod';
import { request, SUBTITLE_DRAFT_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from './client';
import * as S from './schemas';
import type * as T from './types';

export async function createProject(input: T.CreateProjectInput): Promise<T.Project> {
  return request('/projects', { method: 'POST', body: input, schema: S.projectSchema });
}

export async function getProject(id: string): Promise<T.Project> {
  return request(`/projects/${encodeURIComponent(id)}`, { schema: S.projectSchema });
}

export async function updateProject(id: string, patch: T.UpdateProjectInput): Promise<T.Project> {
  return request(`/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
    schema: S.projectSchema,
  });
}

export async function deleteProject(id: string): Promise<{ ok: true }> {
  return request(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE', schema: S.okSchema });
}

export async function parseScreenplay(input: T.ParseScreenplayInput): Promise<T.ParseScreenplayResult> {
  const fd = new FormData();
  if (input.file) fd.append('file', input.file);
  if (input.text) fd.append('text', input.text);
  return request('/planner/parse', {
    method: 'POST',
    formData: fd,
    schema: S.parseScreenplayResultSchema,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

export async function geocode(q: string): Promise<T.GeocodeResult[]> {
  return request('/planner/geocode', { query: { q }, schema: z.array(S.geocodeResultSchema) });
}

export async function quickSlots(req: T.QuickSlotRequest): Promise<T.QuickSlotsResponse> {
  return request('/planner/quick', { method: 'POST', body: req, schema: S.quickSlotsResponseSchema });
}

export async function generateSchedule(input: T.GenerateScheduleInput): Promise<T.Schedule> {
  return request('/planner/schedule', { method: 'POST', body: input, schema: S.scheduleSchema });
}

export async function getWeather(q: T.WeatherQuery): Promise<T.WeatherDay[]> {
  return request('/planner/weather', { query: q, schema: z.array(S.weatherDaySchema) });
}

export async function getAiTools(): Promise<T.AiTool[]> {
  return request('/ai-tools', { schema: z.array(S.aiToolSchema) });
}

/** Ajout proposé (à confirmer) : récupérer le Passeport d'un projet. `null` si aucun. */
export async function getProjectPassport(projectId: string): Promise<T.Passport | null> {
  return request(`/projects/${encodeURIComponent(projectId)}/passport`, {
    schema: S.passportSchema.nullable(),
  });
}

export async function savePassport(input: T.SavePassportInput): Promise<T.Passport> {
  return request('/passport', { method: 'POST', body: input, schema: S.passportSchema });
}

export async function checkPassport(id: string): Promise<T.PassportCheck> {
  return request(`/passport/${encodeURIComponent(id)}/check`, { schema: S.passportCheckSchema });
}

export async function getPassportPdfUrl(id: string): Promise<T.PassportPdf> {
  return request(`/passport/${encodeURIComponent(id)}/pdf`, { schema: S.passportPdfSchema });
}

export async function signC2pa(input: T.C2paSignInput): Promise<T.C2paSignResult> {
  return request('/c2pa/sign', { method: 'POST', body: input, schema: S.c2paSignResultSchema });
}

export async function verifyPassport(id: string): Promise<T.VerifyResult> {
  return request(`/verify/${encodeURIComponent(id)}`, { schema: S.verifyResultSchema });
}

export async function searchFestivals(params: T.FestivalSearchParams): Promise<T.FestivalMatch[]> {
  const { film, open_only, ...rest } = params;
  return request('/festivals', {
    query: {
      ...rest,
      open_only: open_only ? 'true' : undefined,
      film_duration_min: film?.duration_min,
      film_language: film?.language,
      film_genre: film?.genre,
      film_ai_departments: film?.declared_ai_departments,
    },
    schema: z.array(S.festivalMatchSchema),
  });
}

export async function getFestival(id: string): Promise<T.Festival> {
  return request(`/festivals/${encodeURIComponent(id)}`, { schema: S.festivalSchema });
}

export async function createSubtitleDraft(input: T.CreateSubtitleDraftInput): Promise<T.SubtitleDraft> {
  const fd = new FormData();
  fd.append('file', input.audio, input.file_name);
  if (input.language_code) fd.append('language_code', input.language_code);
  if (input.keyterms?.length) fd.append('keyterms', input.keyterms.join(', '));
  if (input.characters?.length) fd.append('characters', input.characters.join(', '));
  return request(`/subtitles/${encodeURIComponent(input.project_id)}/draft`, {
    method: 'POST',
    formData: fd,
    schema: S.subtitleDraftSchema,
    timeoutMs: SUBTITLE_DRAFT_TIMEOUT_MS,
  });
}

export async function getSubtitleDraft(projectId: string): Promise<T.SubtitleDraft> {
  return request(`/subtitles/${encodeURIComponent(projectId)}`, { schema: S.subtitleDraftSchema });
}

export async function saveSubtitles(projectId: string, lines: T.SubtitleLine[]): Promise<T.SubtitleDraft> {
  return request(`/subtitles/${encodeURIComponent(projectId)}`, {
    method: 'PUT',
    body: { lines },
    schema: S.subtitleDraftSchema,
  });
}

export async function getSynopsisFeedback(input: T.SynopsisFeedbackInput): Promise<T.SynopsisFeedback> {
  return request('/synopsis/feedback', { method: 'POST', body: input, schema: S.synopsisFeedbackSchema });
}

export async function translateSynopsis(input: T.SynopsisTranslateInput): Promise<T.SynopsisTranslation> {
  return request('/synopsis/translate', { method: 'POST', body: input, schema: S.synopsisTranslationSchema });
}

export async function getPublicFilm(id: string): Promise<T.PublicFilm> {
  return request(`/films/${encodeURIComponent(id)}/public`, { schema: S.publicFilmSchema });
}

export type Api = {
  createProject: typeof createProject;
  getProject: typeof getProject;
  updateProject: typeof updateProject;
  deleteProject: typeof deleteProject;
  parseScreenplay: typeof parseScreenplay;
  geocode: typeof geocode;
  quickSlots: typeof quickSlots;
  generateSchedule: typeof generateSchedule;
  getWeather: typeof getWeather;
  getAiTools: typeof getAiTools;
  getProjectPassport: typeof getProjectPassport;
  savePassport: typeof savePassport;
  checkPassport: typeof checkPassport;
  getPassportPdfUrl: typeof getPassportPdfUrl;
  signC2pa: typeof signC2pa;
  verifyPassport: typeof verifyPassport;
  searchFestivals: typeof searchFestivals;
  getFestival: typeof getFestival;
  createSubtitleDraft: typeof createSubtitleDraft;
  getSubtitleDraft: typeof getSubtitleDraft;
  saveSubtitles: typeof saveSubtitles;
  getSynopsisFeedback: typeof getSynopsisFeedback;
  translateSynopsis: typeof translateSynopsis;
  getPublicFilm: typeof getPublicFilm;
};
