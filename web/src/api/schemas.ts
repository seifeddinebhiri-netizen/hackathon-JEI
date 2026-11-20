/**
 * Schémas zod alignés sur types.ts. L'annotation `z.ZodType<T>` fait échouer la compilation
 * si un schéma diverge du type : types.ts reste la source de vérité.
 */
import { z } from 'zod';
import type * as T from './types';

const isoDate = z.string().min(1);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

// --- Projet et Planner -------------------------------------------------------
export const sceneMomentSchema = z.enum([
  'jour',
  'nuit',
  'aube',
  'heure_doree',
]) satisfies z.ZodType<T.SceneMoment>;
export const settingSchema = z.enum(['INT', 'EXT']);

export const sceneDetailSchema: z.ZodType<T.SceneDetail> = z.object({
  what_happens: z.string(),
  on_screen: z.string(),
  props: z.array(z.string()),
  costumes: z.array(z.string()),
  extras: z.string(),
  sound: z.array(z.string()),
  special: z.array(z.string()),
  watch_out: z.array(z.string()),
  model: z.string(),
});

export const sceneSchema: z.ZodType<T.Scene> = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  setting: settingSchema,
  moment: sceneMomentSchema,
  location_id: z.string(),
  characters: z.array(z.string()),
  estimated_hours: z.number().nonnegative(),
  summary: z.string(),
  excerpt: z.string().max(1200).optional(),
  detail: sceneDetailSchema.optional(),
  source: z.enum(['import_ia', 'manuel']),
  validated: z.boolean(),
});

export const permitStatusSchema = z.enum(['non_necessaire', 'a_demander', 'obtenue']);

export const locationSchema: z.ZodType<T.Location> = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  access_hours: z.object({ from: hhmm, to: hhmm }).optional(),
  forbidden_days: z.array(z.string()),
  permit: permitStatusSchema,
  notes: z.string().optional(),
});

export const memberSchema: z.ZodType<T.Member> = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['acteur', 'technicien']),
  characters: z.array(z.string()),
  email_consent: z.boolean(),
  phone: z.string().optional(),
  job: z.string().optional(),
});

export const personSchema: z.ZodType<T.Person> = z.object({
  id: z.string(),
  kind: z.enum(['acteur', 'equipe']),
  name: z.string(),
  role: z.string(),
  character: z.string().optional(),
  contact: z.string().optional(),
});

export const weatherDaySchema: z.ZodType<T.WeatherDay> = z.object({
  date: isoDate,
  rain_pct: z.number().nullable(),
  wind_kmh: z.number().nullable(),
  cloud_pct: z.number().nullable(),
  sunrise: z.string(),
  sunset: z.string(),
  golden_hour: z.object({ from: z.string(), to: z.string() }),
  forecast: z.enum(['prevision', 'hors_horizon']),
});

export const scheduleConflictSchema: z.ZodType<T.ScheduleConflict> = z.object({
  kind: z.enum([
    'pluie',
    'vent',
    'lieu_ferme',
    'jour_trop_long',
    'autorisation_manquante',
    'meteo_a_reverifier',
    'lumiere_non_respectee',
  ]),
  message: z.string(),
});

export const scheduledSceneSchema: z.ZodType<T.ScheduledScene> = z.object({
  scene_id: z.string(),
  start: z.string(),
  end: z.string(),
  conflicts: z.array(scheduleConflictSchema),
});

export const shootingDaySchema: z.ZodType<T.ShootingDay> = z.object({
  date: isoDate,
  location_ids: z.array(z.string()),
  call_time: z.string(),
  scenes: z.array(scheduledSceneSchema),
  weather: weatherDaySchema.optional(),
  backup_note: z.string().optional(),
});

export const scheduleSchema: z.ZodType<T.Schedule> = z.object({
  generated_at: z.string(),
  status: z.enum(['brouillon_ia', 'valide']),
  days: z.array(shootingDaySchema),
  unplaced: z.array(z.object({ scene_id: z.string(), reason: z.string() })),
});

export const festivalRequirementSchema: z.ZodType<T.FestivalRequirement> = z.object({
  kind: z.enum([
    'sous_titres',
    'synopsis',
    'photos',
    'affiche',
    'bande_annonce',
    'bio',
    'declaration_ia',
    'droits_musique',
    'format',
  ]),
  detail: z.string(),
  limit_chars: z.number().nullish(),
});

export const aiChoiceSchema = z.enum([
  'aucune',
  'outil_technique',
  'generation',
  'les_deux',
]) satisfies z.ZodType<T.AiChoice>;

export const shortlistItemSchema: z.ZodType<T.ShortlistItem> = z.object({
  festival_id: z.string(),
  status: z.enum(['a_preparer', 'pret', 'soumis', 'reponse_recue', 'prochain_appel']),
  ai_choice: aiChoiceSchema.nullish(),
});

const filmProfileSchema: z.ZodType<T.ProjectFilmProfile> = z.object({
  duration_min: z.number().nonnegative(),
  language: z.string(),
  genre: z.string(),
});
const synopsisTextsSchema: z.ZodType<T.SynopsisTexts> = z.object({
  phrase: z.string(),
  court: z.string(),
  long: z.string(),
});
const filmPageSchema: z.ZodType<T.FilmPageContent> = z.object({
  stills: z.array(z.string()),
  trailer_url: z.string().optional(),
});

export const projectSchema: z.ZodType<T.Project> = z.object({
  id: z.string(),
  title: z.string(),
  format: z.enum(['court', 'long']),
  city: z.string(),
  shooting_window: z.object({ from: isoDate, to: isoDate }),
  max_hours_per_day: z.number().positive(),
  scenes: z.array(sceneSchema),
  locations: z.array(locationSchema),
  people: z.array(personSchema),
  members: z.array(memberSchema).optional(),
  schedule: scheduleSchema.optional(),
  festival_shortlist: z.array(shortlistItemSchema),
  film_profile: filmProfileSchema.optional(),
  synopsis: synopsisTextsSchema.optional(),
  film_page: filmPageSchema.optional(),
});

// --- Kit Festival (Supabase) ---------------------------------------------------------------
const synopsisEnDraftSchema: z.ZodType<T.SynopsisEnDraft> = z.object({
  text: z.string(),
  source: z.string(),
  validated: z.boolean(),
});
export const kitFilmFieldsSchema: z.ZodType<T.KitFilmFields> = z.object({
  film_profile: filmProfileSchema.optional(),
  synopsis: synopsisTextsSchema.optional(),
  film_page: filmPageSchema.optional(),
  synopsis_en: z
    .object({
      phrase: synopsisEnDraftSchema.optional(),
      court: synopsisEnDraftSchema.optional(),
      long: synopsisEnDraftSchema.optional(),
    })
    .optional(),
});
export const kitPieceStateSchema = z.enum(['a_faire', 'pret']) satisfies z.ZodType<T.KitPieceState>;
export const kitDataSchema: z.ZodType<T.KitData> = z.intersection(
  kitFilmFieldsSchema,
  z.object({
    project_id: z.string(),
    dossiers: z.array(shortlistItemSchema),
    pieces: z.record(z.string(), kitPieceStateSchema),
  }),
);

export const quickSlotSchema: z.ZodType<T.QuickSlot> = z.object({
  start: z.string(),
  end: z.string(),
  verdict: z.enum(['recommande', 'plan_b', 'a_eviter']),
  reason: z.string(),
  weather: weatherDaySchema.optional(),
});

export const geocodeResultSchema: z.ZodType<T.GeocodeResult> = z.object({
  label: z.string(),
  lat: z.number(),
  lon: z.number(),
});

export const quickSlotsResponseSchema: z.ZodType<T.QuickSlotsResponse> = z.object({
  place: geocodeResultSchema,
  slots: z.array(quickSlotSchema),
});

// --- Lieux proposés par l'IA --------------------------------------------------------
export const placeCandidateSchema: z.ZodType<T.PlaceCandidate> = z.object({
  name: z.string(),
  address: z.string(),
  lat: z.number(),
  lon: z.number(),
  osm_url: z.string(),
});

export const locationPropositionSchema: z.ZodType<T.LocationProposition> = z.object({
  type_de_lieu: z.string(),
  pourquoi: z.string(),
  requete_recherche: z.string(),
  zone: z.string(),
  facilite: z.enum(['facile', 'moyenne', 'difficile']),
  autorisation_probable: z.enum(['non_necessaire', 'a_demander']),
  a_verifier_sur_place: z.array(z.string()),
  candidates: z.array(placeCandidateSchema).max(3),
});

export const locationSuggestResultSchema: z.ZodType<T.LocationSuggestResult> = z.object({
  status: z.literal('Brouillon IA : à valider'),
  decor: z.string(),
  besoins: z.object({
    a_voir: z.array(z.string()),
    actions: z.array(z.string()),
    ambiance: z.string(),
    pratique: z.array(z.string()),
  }),
  propositions: z.array(locationPropositionSchema),
  mutualisation: z.string().nullable(),
  model: z.string(),
});

// --- Suggestions de tournage ----------------------------------------------------------
export const sceneSuggestResultSchema: z.ZodType<T.SceneSuggestResult> = z.object({
  status: z.literal('Brouillon IA : à valider'),
  suggestions: z.array(
    z.object({
      id: z.string(),
      scene_numbers: z.array(z.string()).min(1),
      kind: z.enum([
        'preciser_int_ext',
        'preciser_moment',
        'regrouper_decors',
        'alleger_scene',
        'info_manquante',
      ]),
      message: z.string(),
      source: z.string(),
      change_setting: settingSchema.nullable(),
      change_moment: sceneMomentSchema.nullable(),
      change_decor: z.string().nullable(),
    }),
  ),
  model: z.string(),
});

// --- Dépouillement du scénario par l'IA --------------------------------------------------
export const scenarioAnalysisSchema: z.ZodType<T.ScenarioAnalysis> = z.object({
  title: z.string(),
  status: z.literal('Brouillon IA : à valider'),
  simulated: z.boolean(),
  scenes: z
    .array(
      z.object({
        number: z.number().int().positive(),
        heading: z.string().min(1),
        setting: z.enum(['INT', 'EXT', 'UNKNOWN']),
        time_of_day: z.enum(['DAY', 'NIGHT', 'DAWN', 'DUSK', 'UNKNOWN']),
        location: z.string(),
        summary: z.string(),
        characters: z.array(z.string()),
        props: z.array(z.string()),
        technical_requirements: z.array(z.string()),
        production_challenges: z.array(z.string()),
        missing_information: z.array(z.string()),
        inferences: z.array(z.string()),
        suggestions: z.array(z.string()),
      }),
    )
    .min(1),
  characters: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string(),
      scenes: z.array(z.number().int().positive()),
      production_observations: z.array(z.string()),
    }),
  ),
});

/** Le backend envoie `null` pour un champ vide : le contrat du front attend un champ absent. */
const withoutNulls = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null))
    : v;

export const parseScreenplayResultSchema: z.ZodType<T.ParseScreenplayResult> = z.object({
  scenes: z.array(z.preprocess(withoutNulls, sceneSchema)),
  locations: z.array(z.preprocess(withoutNulls, locationSchema)),
  characters: z.array(z.string()),
  warnings: z.array(z.string()),
  ai_used: z.boolean().optional(),
});

// --- Passeport IA ------------------------------------------------------------
export const departmentSchema = z.enum([
  'scenario',
  'image',
  'montage',
  'son_voix',
  'musique',
  'vfx',
  'sous_titres',
  'affiche_promo',
]) satisfies z.ZodType<T.Department>;

export const aiToolSchema: z.ZodType<T.AiTool> = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  status: z.enum(['documente', 'partiel', 'non_divulgue', 'non_evalue']),
  note: z.string(),
  source_url: z.string(),
  checked_at: z.string(),
  reviewed: z.boolean().optional(),
});

export const departmentDeclarationSchema: z.ZodType<T.DepartmentDeclaration> = z.object({
  department: departmentSchema,
  used_ai: z.boolean(),
  tool_id: z.string().optional(),
  custom_tool: z.string().optional(),
  what: z.string(),
  level: z.enum(['assistance', 'generation_partielle', 'generation_complete']).optional(),
  human_decisions: z.string(),
});

export const passportSchema: z.ZodType<T.Passport> = z.object({
  id: z.string(),
  project_id: z.string(),
  film_title: z.string(),
  director: z.string(),
  declarations: z.array(departmentDeclarationSchema),
  c2pa_signed: z.boolean(),
  verify_url: z.string().optional(),
  badge_code: z.string().optional(),
  updated_at: z.string(),
});

export const passportCheckSchema: z.ZodType<T.PassportCheck> = z.object({
  ok: z.boolean(),
  missing: z.array(z.object({ department: departmentSchema, message: z.string() })),
  warnings: z.array(z.string()),
});

export const passportPdfSchema: z.ZodType<T.PassportPdf> = z.object({
  url: z.string(),
  signed: z.boolean().optional(),
  simulated: z.boolean().optional(),
  manifest_id: z.string().optional(),
});

const nullish = <T extends z.ZodType>(s: T) => s.nullish().transform((v) => v ?? undefined);
export const pdfVerificationSchema: z.ZodType<T.PdfVerification> = z.object({
  state: z.enum(['none', 'invalid', 'valid', 'trusted']),
  issued_by_us: z.boolean(),
  signer: nullish(z.string()),
  issuer: nullish(z.string()),
  signing_mode: nullish(z.enum(['test', 'production'])),
  badge_code: nullish(z.string()),
  film_title: nullish(z.string()),
  issued_at: nullish(z.string()),
  tools: z.array(z.object({ slug: z.string(), status: nullish(z.string()), reviewed: z.boolean() })),
  problems: z.array(z.string()),
  matches_passport: nullish(z.boolean()),
  reasons: z.array(z.string()),
}) as z.ZodType<T.PdfVerification>;

export const verifyResultSchema: z.ZodType<T.VerifyResult> = z.object({
  passport: passportSchema,
  tools: z.array(aiToolSchema),
  signature: z.object({
    signed: z.boolean(),
    signed_at: z.string().optional(),
    manifest_id: z.string().optional(),
  }),
  checked_at: z.string(),
});

// --- Festival ----------------------------------------------------------------
export const aiPolicySchema = z.enum([
  'acceptee',
  'a_declarer',
  'interdite',
  'section_dediee',
  'non_precisee',
]) satisfies z.ZodType<T.AiPolicy>;

export const festivalSchema: z.ZodType<T.Festival> = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  city: z.string().nullish(),
  edition: z.string().nullish(),
  deadline: z.string().nullable(),
  deadline_status: z.enum(['ouverte', 'passee', 'a_confirmer']),
  deadline_note: z.string().nullish(),
  fee: z.string(),
  max_duration_min: z.number().nullable(),
  subtitle_langs: z.array(z.string()),
  ai_policy: aiPolicySchema,
  ai_policy_detail: z.string().nullish(),
  eligibility: z.string().nullish(),
  requirements: z.array(festivalRequirementSchema),
  source_url: z.string(),
  checked_at: z.string(),
});

export const festivalMatchSchema: z.ZodType<T.FestivalMatch> = z.object({
  festival: festivalSchema,
  score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const subtitleWarningSchema: z.ZodType<T.SubtitleWarning> = z.object({
  rule: z.enum([
    'lecture_rapide',
    'trop_de_lignes',
    'ligne_trop_longue',
    'duree_courte',
    'duree_longue',
    'chevauchement',
    'omission_possible',
  ]),
  detail: z.string(),
});

export const subtitleLineSchema: z.ZodType<T.SubtitleLine> = z.object({
  id: z.string(),
  start: z.string(),
  end: z.string(),
  source: z.string(),
  fr: z.string(),
  en: z.string().optional(),
  confidence: z.enum(['elevee', 'moyenne', 'faible']),
  note: z.string().optional(),
  validated: z.boolean(),
  speaker: z.string().optional(),
  warnings: z.array(subtitleWarningSchema).optional(),
  glossary_used: z.array(z.string()).optional(),
  fr_court: z.string().optional(),
  en_court: z.string().optional(),
});

export const subtitleDraftSchema: z.ZodType<T.SubtitleDraft> = z.object({
  project_id: z.string(),
  source_lang: z.string(),
  lines: z.array(subtitleLineSchema),
  processing: z
    .object({ transcriber: z.string(), translator: z.string(), created_at: z.string() })
    .optional(),
});

export const synopsisFeedbackSchema: z.ZodType<T.SynopsisFeedback> = z.object({
  questions: z.array(z.string()),
});

export const synopsisTranslationSchema: z.ZodType<T.SynopsisTranslation> = z.object({
  text: z.string(),
});

export const publicFilmSchema: z.ZodType<T.PublicFilm> = z.object({
  id: z.string(),
  title: z.string(),
  director: z.string(),
  synopsis_short: z.string(),
  synopsis_long: z.string(),
  stills: z.array(z.string()),
  credits: z.array(z.object({ role: z.string(), name: z.string() })),
  trailer_url: z.string().optional(),
  passport_badge_code: z.string().optional(),
  verify_url: z.string().optional(),
});

export const okSchema = z.object({ ok: z.literal(true) });

// --- Convocations ------------------------------------------------------------------
const callsheetDraftSceneSchema: z.ZodType<T.CallsheetDraftScene> = z.object({
  number: z.string(),
  title: z.string(),
  date: isoDate,
  call_time: hhmm,
  start: hhmm.nullable(),
  end: hhmm.nullable(),
  location_name: z.string(),
  address: z.string(),
  moment_label: z.string(),
  characters: z.array(z.string()),
  notes: z.string(),
  text: z.string().nullable(),
});

export const callsheetPreviewSchema: z.ZodType<T.CallsheetPreview> = z.object({
  drafts: z.array(
    z.object({
      member_id: z.string(),
      name: z.string(),
      role: z.enum(['acteur', 'technicien']),
      to: z.string(),
      subject: z.string(),
      message: z.string(),
      schedule_text: z.string(),
      text: z.string(),
      html: z.string(),
      scenes: z.array(callsheetDraftSceneSchema),
      ics: z.string(),
      ics_filename: z.string(),
      include_scene_text: z.boolean(),
      blocked_reason: z.string().nullable(),
    }),
  ),
  not_concerned: z.array(z.object({ member_id: z.string(), name: z.string(), reason: z.string() })),
  email_configured: z.boolean(),
});

export const callsheetSendResultSchema: z.ZodType<T.CallsheetSendResult> = z.object({
  dry_run: z.boolean(),
  results: z.array(
    z.object({
      member_id: z.string(),
      name: z.string(),
      to: z.string(),
      status: z.enum(['envoye', 'essai', 'ignore', 'erreur']),
      reason: z.string().nullable(),
      subject: z.string().nullable(),
    }),
  ),
  sent: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

// --- Coach : plan de prise de vue et calibration ------------------------------------
const numRange = z.object({ min: z.number(), max: z.number() });

export const shotChoicesShape = {
  size: z.enum(['ECU', 'CU', 'MCU', 'MS', 'MWS', 'WS']),
  subject_kind: z.enum(['person', 'face', 'hands', 'object', 'none']),
  subject_view: z.enum(['front', 'side', 'back', 'not_applicable']),
  subject_position: z.enum(['left_third', 'center', 'right_third']),
  camera_angle: z.enum(['eye_level', 'low', 'high']),
  tilt: z.enum(['level', 'dutch']),
  light_contrast: z.enum(['low', 'medium_low', 'medium', 'high']),
  exposure: z.enum(['dark', 'balanced', 'bright']),
  backlight: z.enum(['avoid', 'accept', 'intentional']),
  sun_relative: z.enum(['front', 'side', 'behind', 'not_applicable']),
  stability: z.enum(['tripod', 'handheld']),
  movement: z.enum(['static', 'pan', 'tilt', 'tracking']),
};

export const shotIntentSchema: z.ZodType<T.ShotIntent> = z.object({
  ...shotChoicesShape,
  label_fr: z.string(),
  why_fr: z.string(),
  rule_ids: z.array(z.string()),
  advice_fr: z.array(z.string()),
});

export const shotTargetsSchema: z.ZodType<T.ShotTargets> = z.object({
  roll_abs_deg: numRange,
  pitch_deg: numRange.nullable(),
  subject_h: numRange.nullable(),
  center_x: numRange.nullable(),
  center_y: numRange.nullable(),
  headroom: numRange.nullable(),
  luma: numRange,
  contrast: numRange,
  backlight_ratio_max: z.number().nullable(),
  sun_offset_abs_deg: numRange.nullable(),
  shake_max: z.number().nullable(),
});

const ruleSourceSchema = z.object({
  title: z.string(),
  author: z.string().nullable(),
  url: z.string(),
  type: z.string(),
});
const shotChoicesObject = z.object(shotChoicesShape);

export const timelineSegmentSchema: z.ZodType<T.TimelineSegment> = z.object({
  id: z.string(),
  start_s: z.number(),
  end_s: z.number(),
  description_fr: z.string(),
  at_start: shotChoicesObject,
  at_end: shotChoicesObject.nullable(),
  targets_start: shotTargetsSchema,
  targets_end: shotTargetsSchema.nullable(),
});

export const timelineSchema: z.ZodType<T.Timeline> = z.object({
  duration_s: z.number().positive(),
  how_fr: z.string(),
  segments: z.array(timelineSegmentSchema).min(1),
});

export const planShotSchema: z.ZodType<T.PlanShot> = z.object({
  id: z.string(),
  intent: shotIntentSchema,
  targets: shotTargetsSchema,
  rules: z.array(
    z.object({
      id: z.string(),
      title_fr: z.string(),
      confidence: z.string(),
      sources: z.array(ruleSourceSchema),
    }),
  ),
  timeline: timelineSchema.nullable().optional(),
});
export const shotSpecSchema: z.ZodType<T.ShotSpec> = z.object({
  scene_id: z.string(),
  status: z.string(),
  calibration: z.string(),
  model: z.string(),
  generated_at: z.string(),
  shots: z.array(planShotSchema),
});

const pair = z.tuple([z.number(), z.number()]);
export const calibrationSchema: z.ZodType<T.Calibration> = z.object({
  version: z.string(),
  third_tol: z.number(),
  rules: z.object({
    no_subject: z.array(z.string()),
    has_head: z.array(z.string()),
    moving: z.array(z.string()),
  }),
  tables: z.object({
    subject_h: z.record(z.string(), pair),
    headroom: z.record(z.string(), pair),
    center_x: z.record(z.string(), z.number()),
    pitch: z.record(z.string(), pair),
    roll_abs: z.record(z.string(), pair),
    luma: z.record(z.string(), pair),
    contrast: z.record(z.string(), pair),
    backlight_ratio_max: z.record(z.string(), z.number().nullable()),
    sun_offset_abs: z.record(z.string(), pair),
    shake_max: z.record(z.string(), z.number()),
  }),
  vocabulary: z.array(
    z.object({
      key: z.enum(Object.keys(shotChoicesShape) as [keyof T.ShotChoices, ...(keyof T.ShotChoices)[]]),
      label_fr: z.string(),
      options: z.array(z.object({ value: z.string(), label_fr: z.string() })),
    }),
  ),
});

// --- Coach : espaces de travail -------------------------------------------------------
export const workspaceRecordSchema: z.ZodType<T.WorkspaceRecord> = z.object({
  id: z.string(),
  name: z.string(),
  data: z.record(z.string(), z.unknown()),
  version: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
});

// --- Catalogue des outils d'IA (backend : GET /ai-tools ; Supabase : table ai_tools) --------------
/** Fiche d'outil telle que la renvoie le backend (et la table ai_tools) : adaptée par `toAiTool`. */
export const catalogToolSchema = z.object({
  slug: z.string(),
  name: z.string(),
  vendor: z.string(),
  official_site: z.string().nullable().optional(),
  terms_url: z.string().nullable().optional(),
  status: z.enum(['documente', 'partiel', 'non_divulgue']).nullable().optional(),
  review_state: z.enum(['a_verifier', 'verifie']),
  research_state: z.enum(['none', 'incomplete_access', 'complete']),
  note_fr: z.string().optional(),
  checked_at: z.string().nullable().optional(),
});
export type CatalogTool = z.output<typeof catalogToolSchema>;

export const toolResolutionSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('found'), tool: catalogToolSchema }),
  z.object({ state: z.literal('researching'), run_id: z.string() }),
]);

/** Résolution déjà adaptée à l'interface (sortie de `resolveAiTool`). */
export const toolResolutionOut: z.ZodType<T.ToolResolution> = z.union([
  z.object({ state: z.literal('found'), tool: aiToolSchema }),
  z.object({ state: z.literal('researching'), run_id: z.string() }),
]);

export const toolRunSchema: z.ZodType<T.ToolRun> = z.object({
  id: z.string(),
  state: z.enum(['queued', 'running', 'done', 'failed']),
  tool_slug: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
  error: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
}) as z.ZodType<T.ToolRun>;
