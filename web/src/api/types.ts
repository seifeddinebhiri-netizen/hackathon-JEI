/**
 * Contrat d'API Premier Plan — SOURCE DE VÉRITÉ.
 * Règle : toutes les valeurs d'énumération sont en ASCII (sans accent ni espace) ;
 * les accents n'apparaissent que dans les libellés affichés.
 * Toute modification ici doit être répercutée dans schemas.ts (le compilateur le vérifie)
 * et dans docs/API_CONTRACT.md.
 */

// ---------------------------------------------------------------------------
// Projet et Planner
// ---------------------------------------------------------------------------
export type FilmFormat = 'court' | 'long';
export type Project = {
  id: string;
  title: string;
  format: FilmFormat;
  city: string;
  shooting_window: { from: string; to: string }; // dates ISO
  max_hours_per_day: number;
  scenes: Scene[];
  locations: Location[];
  people: Person[];
  schedule?: Schedule;
  festival_shortlist: ShortlistItem[];
};
export type SceneMoment = 'jour' | 'nuit' | 'aube' | 'heure_doree';
export type Scene = {
  id: string;
  number: string;
  title: string;
  setting: 'INT' | 'EXT';
  moment: SceneMoment;
  location_id: string;
  characters: string[]; // noms de personnages
  estimated_hours: number;
  summary: string;
  source: 'import_ia' | 'manuel';
  validated: boolean;
};
export type PermitStatus = 'non_necessaire' | 'a_demander' | 'obtenue';
export type Location = {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lon?: number;
  access_hours?: { from: string; to: string }; // "08:00"
  forbidden_days: string[]; // dates ISO ou jours de semaine
  permit: PermitStatus;
  notes?: string;
};
export type Person = {
  id: string;
  kind: 'acteur' | 'equipe';
  name: string;
  role: string;
  character?: string;
  contact?: string;
};

/** Au-delà de l'horizon de prévision : forecast = 'hors_horizon' et rain_pct / wind_kmh / cloud_pct = null. */
export type WeatherDay = {
  date: string;
  rain_pct: number | null;
  wind_kmh: number | null;
  cloud_pct: number | null;
  sunrise: string;
  sunset: string;
  golden_hour: { from: string; to: string };
  forecast: 'prevision' | 'hors_horizon';
};
export type ScheduleConflict = {
  kind: 'pluie' | 'vent' | 'lieu_ferme' | 'jour_trop_long' | 'autorisation_manquante' | 'meteo_a_reverifier';
  message: string;
};
export type ScheduledScene = { scene_id: string; start: string; end: string; conflicts: ScheduleConflict[] };
export type ShootingDay = {
  date: string;
  location_ids: string[];
  call_time: string;
  scenes: ScheduledScene[];
  weather?: WeatherDay;
  backup_note?: string;
};
export type Schedule = {
  generated_at: string;
  status: 'brouillon_ia' | 'valide';
  days: ShootingDay[];
  unplaced: { scene_id: string; reason: string }[];
};

export type QuickSlotRequest = {
  description: string;
  place: string;
  setting: 'INT' | 'EXT';
  moment: SceneMoment;
  from: string;
  to: string;
};
export type QuickSlot = {
  start: string;
  end: string;
  verdict: 'recommande' | 'plan_b' | 'a_eviter';
  reason: string;
  weather?: WeatherDay;
};

// ---------------------------------------------------------------------------
// Passeport IA
// ---------------------------------------------------------------------------
export type Department =
  | 'scenario'
  | 'image'
  | 'montage'
  | 'son_voix'
  | 'musique'
  | 'vfx'
  | 'sous_titres'
  | 'affiche_promo';
export type AiToolStatus = 'documente' | 'partiel' | 'non_divulgue';
export type AiTool = {
  id: string;
  name: string;
  provider: string;
  status: AiToolStatus;
  note: string;
  source_url: string;
  checked_at: string;
};
export type UsageLevel = 'assistance' | 'generation_partielle' | 'generation_complete';
export type DepartmentDeclaration = {
  department: Department;
  used_ai: boolean;
  tool_id?: string;
  custom_tool?: string;
  what: string;
  level?: UsageLevel;
  human_decisions: string;
};
export type Passport = {
  id: string;
  project_id: string;
  film_title: string;
  director: string;
  declarations: DepartmentDeclaration[];
  c2pa_signed: boolean;
  verify_url?: string;
  badge_code?: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Festival
// ---------------------------------------------------------------------------
export type AiPolicy = 'acceptee' | 'a_declarer' | 'interdite';
export type Festival = {
  id: string;
  name: string;
  country: string;
  deadline: string;
  fee: string;
  max_duration_min?: number;
  subtitle_langs: string[];
  ai_policy: AiPolicy;
  requirements: FestivalRequirement[];
  source_url: string;
  checked_at: string;
};
export type FestivalRequirement = {
  kind:
    | 'sous_titres'
    | 'synopsis'
    | 'photos'
    | 'affiche'
    | 'bande_annonce'
    | 'bio'
    | 'declaration_ia'
    | 'droits_musique'
    | 'format';
  detail: string;
  limit_chars?: number;
};
export type FestivalMatch = { festival: Festival; score: 1 | 2 | 3 | 4 | 5; reasons: string[]; warnings: string[] };
export type FilmProfile = {
  duration_min: number;
  language: string;
  genre: string;
  declared_ai_departments: number;
};
export type ShortlistItem = {
  festival_id: string;
  status: 'a_preparer' | 'pret' | 'soumis';
  checklist: { requirement: FestivalRequirement; done: boolean }[];
};
export type SubtitleLine = {
  id: string;
  start: string;
  end: string;
  source: string;
  fr: string;
  en?: string;
  confidence: 'elevee' | 'moyenne' | 'faible';
  note?: string;
  validated: boolean;
};
export type SynopsisFeedback = { questions: string[] }; // jamais de texte réécrit
export type PublicFilm = {
  id: string;
  title: string;
  director: string;
  synopsis_short: string;
  synopsis_long: string;
  stills: string[];
  credits: { role: string; name: string }[];
  trailer_url?: string;
  passport_badge_code?: string;
  verify_url?: string;
};

// ---------------------------------------------------------------------------
// Corps de requête et réponses complémentaires (précisés dans API_CONTRACT.md)
// ---------------------------------------------------------------------------
export type CreateProjectInput = Pick<Project, 'title' | 'format' | 'city' | 'shooting_window' | 'max_hours_per_day'>;
export type UpdateProjectInput = Partial<
  Pick<
    Project,
    | 'title'
    | 'format'
    | 'city'
    | 'shooting_window'
    | 'max_hours_per_day'
    | 'scenes'
    | 'locations'
    | 'people'
    | 'schedule'
    | 'festival_shortlist'
  >
>;

export type ParseScreenplayInput = { file?: File; text?: string };
export type ParseScreenplayResult = {
  scenes: Scene[];
  /** Lieux détectés dans les en-têtes de scène, à compléter par l'utilisateur. */
  locations: Location[];
  /** Personnages détectés. */
  characters: string[];
  warnings: string[];
};

export type GeocodeResult = { label: string; lat: number; lon: number };

export type QuickSlotsResponse = { place: GeocodeResult; slots: QuickSlot[] };

export type GenerateScheduleInput = { project_id: string };

export type WeatherQuery = { lat: number; lon: number; from: string; to: string };

export type SavePassportInput = Omit<Passport, 'id' | 'updated_at' | 'c2pa_signed' | 'verify_url' | 'badge_code'> & {
  id?: string;
};
export type PassportCheck = {
  ok: boolean;
  missing: { department: Department; message: string }[];
  warnings: string[];
};
export type PassportPdf = { url: string };
export type C2paSignInput = { passport_id: string; file_name: string };
export type C2paSignResult = { signed: boolean; manifest_id: string; signed_at: string; simulated: boolean };
export type VerifyResult = {
  passport: Passport;
  tools: AiTool[];
  signature: { signed: boolean; signed_at?: string; manifest_id?: string };
  checked_at: string;
};

export type FestivalSearchParams = {
  q?: string;
  country?: string;
  max_duration_min?: number;
  fee?: 'gratuit' | 'payant';
  deadline_before?: string;
  subtitle_lang?: string;
  ai_policy?: AiPolicy;
  /** Si fourni, le serveur classe les festivals pour ce film. */
  film?: FilmProfile;
};

export type SubtitleDraft = { project_id: string; source_lang: string; lines: SubtitleLine[] };

export type SynopsisKind = 'phrase' | 'court' | 'long';
export type SynopsisFeedbackInput = { kind: SynopsisKind; text: string; limit_chars?: number };

export type User = { id: string; email: string; name: string; is_demo: boolean; project_id?: string };
export type Session = { access_token: string; expires_at: string; user: User };
