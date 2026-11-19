/**
 * Vrais appels au backend FastAPI. Une fonction par endpoint (voir docs/API_CONTRACT.md).
 * mocks/handlers.ts expose EXACTEMENT la même signature (type `Api`).
 */
import { z } from 'zod';
import { request, UPLOAD_TIMEOUT_MS } from './client';
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

/** Le découpage par l'IA peut être long sur un long scénario. */
const PARSE_TIMEOUT_MS = 190_000;

/**
 * Découpage du scénario (POST /planner/parse, multipart) : fichier tel quel (PDF, DOCX, TXT,
 * Fountain, FDX) ou texte collé. Marche aussi sur un récit sans en-têtes INT./EXT.
 * Le texte n'est envoyé qu'à ce moment-là, et n'est pas conservé par le serveur.
 */
export async function parseScreenplay(input: T.ParseScreenplayInput): Promise<T.ParseScreenplayResult> {
  const form = new FormData();
  if (input.file) form.append('file', input.file, input.file.name);
  else form.append('text', input.text ?? '');
  form.append('use_ai', 'true');
  return request('/planner/parse', {
    method: 'POST',
    formData: form,
    schema: S.parseScreenplayResultSchema,
    timeoutMs: PARSE_TIMEOUT_MS,
  });
}

/** Suggestions de tournage sur les scènes (jamais d'écriture), que l'auteur accepte ou refuse. */
export async function suggestScenes(input: T.SceneSuggestInput): Promise<T.SceneSuggestResult> {
  return request('/planner/scenes/suggest', {
    method: 'POST',
    body: input,
    schema: S.sceneSuggestResultSchema,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

/** Lieux proposés par l'IA pour un décor, avec de vrais lieux trouvés par la recherche géographique. */
export async function suggestLocations(input: T.LocationSuggestInput): Promise<T.LocationSuggestResult> {
  return request('/planner/locations/suggest', {
    method: 'POST',
    body: input,
    schema: S.locationSuggestResultSchema,
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
  const { film, ...rest } = params;
  return request('/festivals', {
    query: {
      ...rest,
      film_duration_min: film?.duration_min,
      film_language: film?.language,
      film_genre: film?.genre,
      film_ai_departments: film?.declared_ai_departments,
    },
    schema: z.array(S.festivalMatchSchema),
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

export async function getPublicFilm(id: string): Promise<T.PublicFilm> {
  return request(`/films/${encodeURIComponent(id)}/public`, { schema: S.publicFilmSchema });
}

/** Brouillons des convocations : rien n'est envoyé. */
export async function previewCallsheets(input: T.CallsheetInput): Promise<T.CallsheetPreview> {
  return request('/callsheets/preview', { method: 'POST', body: input, schema: S.callsheetPreviewSchema });
}

/** Envoi des convocations validées par le réalisateur (mode essai sans clé côté serveur). */
export async function sendCallsheets(input: T.CallsheetSendInput): Promise<T.CallsheetSendResult> {
  return request('/callsheets/send', {
    method: 'POST',
    body: input,
    schema: S.callsheetSendResultSchema,
    timeoutMs: 120_000, // 50 destinataires au plus, ~0,6 s chacun
  });
}

export type Api = {
  createProject: typeof createProject;
  getProject: typeof getProject;
  updateProject: typeof updateProject;
  deleteProject: typeof deleteProject;
  parseScreenplay: typeof parseScreenplay;
  geocode: typeof geocode;
  suggestLocations: typeof suggestLocations;
  suggestScenes: typeof suggestScenes;
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
  getSubtitleDraft: typeof getSubtitleDraft;
  saveSubtitles: typeof saveSubtitles;
  getSynopsisFeedback: typeof getSynopsisFeedback;
  getPublicFilm: typeof getPublicFilm;
  previewCallsheets: typeof previewCallsheets;
  sendCallsheets: typeof sendCallsheets;
};
