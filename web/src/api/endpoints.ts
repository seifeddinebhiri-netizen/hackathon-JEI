/**
 * Vrais appels au backend FastAPI. Une fonction par endpoint (voir docs/API_CONTRACT.md).
 * mocks/handlers.ts expose EXACTEMENT la même signature (type `Api`).
 */
import { z } from 'zod';
import {
  request,
  requestBlob,
  SUBTITLE_DRAFT_TIMEOUT_MS,
  UPLOAD_TIMEOUT_MS,
  uploadForm,
  type UploadProgress,
} from './client';
import { toAiTool } from './aiTools';
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

/** Fiche de tournage d'une scène, écrite par l'IA à partir de son texte (rien d'inventé). */
export async function detailScene(input: T.SceneDetailInput): Promise<T.SceneDetail> {
  return request('/planner/scenes/detail', {
    method: 'POST',
    body: input,
    schema: S.sceneDetailSchema,
    timeoutMs: UPLOAD_TIMEOUT_MS,
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

/** Plan de prise de vue proposé par l'IA (Gemini) pour une scène. Peut durer plusieurs secondes. */
export async function generateShotSpec(input: T.ShotSpecRequest): Promise<T.ShotSpec> {
  return request('/shot-spec', {
    method: 'POST',
    body: input,
    schema: S.shotSpecSchema,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

/** Tables mots → nombres, pour recalculer les cibles quand l'utilisateur modifie le plan. */
export async function getCalibration(): Promise<T.Calibration> {
  return request('/calibration', { schema: S.calibrationSchema });
}

/** Les espaces de travail du Coach de l'utilisateur connecté. */
export async function listWorkspaces(): Promise<T.WorkspaceRecord[]> {
  return request('/workspaces', { schema: z.array(S.workspaceRecordSchema) });
}

export async function putWorkspace(id: string, input: T.WorkspaceInput): Promise<T.WorkspaceRecord> {
  return request(`/workspaces/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
    schema: S.workspaceRecordSchema,
  });
}

export async function deleteWorkspace(id: string): Promise<{ ok: true }> {
  return request(`/workspaces/${encodeURIComponent(id)}`, { method: 'DELETE', schema: S.okSchema });
}

/** Catalogue des outils d'IA (nécessite un compte). L'identifiant d'un outil est son `slug`. */
export async function getAiTools(): Promise<T.AiTool[]> {
  const tools = await request('/ai-tools', { schema: z.array(S.catalogToolSchema) });
  return tools.map(toAiTool);
}

/**
 * « Ajouter cet outil » : déjà au catalogue, ou une recherche guidée est lancée SUR LE SERVEUR (le
 * navigateur ne la règle ni ne la déclenche autrement ; elle prend 10 à 60 secondes).
 */
export async function resolveAiTool(name: string): Promise<T.ToolResolution> {
  const r = await request('/ai-tools/resolve', {
    method: 'POST',
    body: { name },
    schema: S.toolResolutionSchema,
  });
  return r.state === 'found' ? { state: 'found', tool: toAiTool(r.tool) } : r;
}

export async function getAiToolRun(runId: string): Promise<T.ToolRun> {
  return request(`/ai-tools/runs/${encodeURIComponent(runId)}`, { schema: S.toolRunSchema });
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

/**
 * PDF du Passeport d'un projet, fabriqué et SIGNÉ (C2PA) par le serveur à partir du Passeport enregistré.
 * `id` est l'identifiant du projet (Passport.id = project_id). Le fichier est servi par une adresse
 * locale au navigateur (`blob:`), à ouvrir dans un nouvel onglet.
 */
export async function getPassportPdfUrl(id: string): Promise<T.PassportPdf> {
  const { blob, headers } = await requestBlob(`/passports/${encodeURIComponent(id)}/pdf`, {
    method: 'POST',
    timeoutMs: 30_000,
  });
  return {
    url: URL.createObjectURL(blob),
    signed: true,
    simulated: headers.get('X-C2PA-Simulated') !== 'false',
    manifest_id: headers.get('X-C2PA-Manifest-Id') || undefined,
  };
}

/**
 * Vérifier un PDF de Passeport reçu (PUBLIC, sans compte) : intact ? signé par nous ? identique au
 * Passeport actuel ? Le fichier est lu par le serveur puis oublié.
 */
export async function verifyPassportPdf(file: File): Promise<T.PdfVerification> {
  const formData = new FormData();
  formData.append('file', file);
  return request('/verify/pdf', {
    method: 'POST',
    formData,
    timeoutMs: 30_000,
    schema: S.pdfVerificationSchema,
  });
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

export async function createSubtitleDraft(
  input: T.CreateSubtitleDraftInput,
  opts?: { onUploadProgress?: UploadProgress },
): Promise<T.SubtitleDraft> {
  const fd = new FormData();
  fd.append('file', input.audio, input.file_name);
  if (input.language_code) fd.append('language_code', input.language_code);
  if (input.keyterms?.length) fd.append('keyterms', input.keyterms.join(', '));
  if (input.characters?.length) fd.append('characters', input.characters.join(', '));
  return uploadForm(`/subtitles/${encodeURIComponent(input.project_id)}/draft`, {
    formData: fd,
    schema: S.subtitleDraftSchema,
    timeoutMs: SUBTITLE_DRAFT_TIMEOUT_MS,
    onProgress: opts?.onUploadProgress,
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
  detailScene: typeof detailScene;
  quickSlots: typeof quickSlots;
  generateSchedule: typeof generateSchedule;
  getWeather: typeof getWeather;
  getAiTools: typeof getAiTools;
  generateShotSpec: typeof generateShotSpec;
  getCalibration: typeof getCalibration;
  listWorkspaces: typeof listWorkspaces;
  putWorkspace: typeof putWorkspace;
  deleteWorkspace: typeof deleteWorkspace;
  getProjectPassport: typeof getProjectPassport;
  savePassport: typeof savePassport;
  checkPassport: typeof checkPassport;
  getPassportPdfUrl: typeof getPassportPdfUrl;
  resolveAiTool: typeof resolveAiTool;
  getAiToolRun: typeof getAiToolRun;
  verifyPassport: typeof verifyPassport;
  verifyPassportPdf: typeof verifyPassportPdf;
  searchFestivals: typeof searchFestivals;
  getFestival: typeof getFestival;
  createSubtitleDraft: typeof createSubtitleDraft;
  getSubtitleDraft: typeof getSubtitleDraft;
  saveSubtitles: typeof saveSubtitles;
  getSynopsisFeedback: typeof getSynopsisFeedback;
  translateSynopsis: typeof translateSynopsis;
  getPublicFilm: typeof getPublicFilm;
  previewCallsheets: typeof previewCallsheets;
  sendCallsheets: typeof sendCallsheets;
};
