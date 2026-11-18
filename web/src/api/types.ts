/**
 * Contrat d'API de l'application — SOURCE DE VÉRITÉ.
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
  /** Kit Festival : profil du film (le nombre de départements IA est déduit du Passeport). */
  film_profile?: ProjectFilmProfile;
  /** Kit Festival : les trois synopsis, écrits par le réalisateur. */
  synopsis?: SynopsisTexts;
  /** Kit Festival : contenu éditable de la page film publique. */
  film_page?: FilmPageContent;
};
export type ProjectFilmProfile = { duration_min: number; language: string; genre: string };
export type SynopsisTexts = { phrase: string; court: string; long: string };
export type FilmPageContent = { stills: string[]; trailer_url?: string };
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
  'scenario' | 'image' | 'montage' | 'son_voix' | 'musique' | 'vfx' | 'sous_titres' | 'affiche_promo';
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
/**
 * Politique IA telle qu'écrite dans le règlement. `non_precisee` : le règlement ne dit rien
 * (statut honnête, pas une autorisation). `section_dediee` : films faits par IA dans une section à part.
 */
export type AiPolicy = 'acceptee' | 'a_declarer' | 'interdite' | 'section_dediee' | 'non_precisee';
/** Calculé par le serveur à la lecture (jamais stocké). */
export type DeadlineStatus = 'ouverte' | 'passee' | 'a_confirmer';
export type Festival = {
  id: string;
  name: string;
  country: string;
  city?: string | null;
  edition?: string | null;
  /** Date ISO ; null si la date de la prochaine édition n'est pas connue. */
  deadline: string | null;
  deadline_status: DeadlineStatus;
  /** Ex. « Appel 2027 pas encore publié. » */
  deadline_note?: string | null;
  fee: string;
  max_duration_min: number | null;
  subtitle_langs: string[];
  ai_policy: AiPolicy;
  ai_policy_detail?: string | null;
  eligibility?: string | null;
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
  limit_chars?: number | null;
};
export type FestivalMatch = {
  festival: Festival;
  score: 1 | 2 | 3 | 4 | 5;
  reasons: string[];
  warnings: string[];
};
export type FilmProfile = {
  duration_min: number;
  language: string;
  genre: string;
  declared_ai_departments: number;
};
/** « Où j'en suis » pour un dossier. La soumission se fait toujours sur le site officiel. */
export type ShortlistStatus = 'a_preparer' | 'pret' | 'soumis' | 'reponse_recue' | 'prochain_appel';
export type ShortlistItem = {
  festival_id: string;
  status: ShortlistStatus;
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
  /** S1, S2… dans l'ordre d'apparition (absent si inconnu). */
  speaker?: string;
  /** Règles de sous-titrage non respectées (recalculées par le serveur). */
  warnings?: SubtitleWarning[];
  /** Ids du glossaire derja utilisés pour cette ligne. */
  glossary_used?: string[];
  /** Version condensée proposée quand la ligne est trop rapide à lire : suggestion, jamais appliquée seule. */
  fr_court?: string;
  en_court?: string;
};
export type SubtitleRule =
  | 'lecture_rapide'
  | 'trop_de_lignes'
  | 'ligne_trop_longue'
  | 'duree_courte'
  | 'duree_longue'
  | 'chevauchement'
  | 'omission_possible';
export type SubtitleWarning = { rule: SubtitleRule; detail: string };
export type SubtitleProcessing = { transcriber: string; translator: string; created_at: string };
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
export type CreateProjectInput = Pick<
  Project,
  'title' | 'format' | 'city' | 'shooting_window' | 'max_hours_per_day'
>;
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
    | 'film_profile'
    | 'synopsis'
    | 'film_page'
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

export type SavePassportInput = Omit<
  Passport,
  'id' | 'updated_at' | 'c2pa_signed' | 'verify_url' | 'badge_code'
> & {
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
  /** Seulement les appels ouverts (deadline_status = ouverte). */
  open_only?: boolean;
  /** Si fourni, le serveur classe les festivals pour ce film. */
  film?: FilmProfile;
};

export type SubtitleDraft = {
  project_id: string;
  source_lang: string;
  lines: SubtitleLine[];
  /** Outils utilisés (absent tant qu'il n'y a pas de brouillon). */
  processing?: SubtitleProcessing;
};
/** POST /subtitles/{projectId}/draft : seul le son (WAV extrait dans le navigateur) est envoyé. */
export type CreateSubtitleDraftInput = {
  project_id: string;
  audio: Blob;
  file_name: string;
  /** `ara` pour la derja (Scribe n'a pas de code de dialecte) ; absent = détection automatique. */
  language_code?: string;
  keyterms?: string[];
  characters?: string[];
};

export type SynopsisKind = 'phrase' | 'court' | 'long';
export type SynopsisFeedbackInput = { kind: SynopsisKind; text: string; limit_chars?: number };
/** POST /synopsis/translate (à confirmer) : traduction du texte de l'auteur, rien d'ajouté ni réécrit. */
export type SynopsisTranslateInput = { kind: SynopsisKind; text: string; target_lang: 'en' };
export type SynopsisTranslation = { text: string };

export type User = { id: string; email: string; name: string; is_demo: boolean; project_id?: string };
export type Session = { access_token: string; expires_at: string; user: User };

// ---------------------------------------------------------------------------
// Coach : plan de prise de vue (POST /shot-spec) et calibration (GET /calibration)
// ---------------------------------------------------------------------------
export type ShotSize = 'ECU' | 'CU' | 'MCU' | 'MS' | 'MWS' | 'WS';
export type SubjectKind = 'person' | 'face' | 'hands' | 'object' | 'none';
export type SubjectView = 'front' | 'side' | 'back' | 'not_applicable';
export type SubjectPosition = 'left_third' | 'center' | 'right_third';
export type CameraAngle = 'eye_level' | 'low' | 'high';
export type Tilt = 'level' | 'dutch';
export type LightContrast = 'low' | 'medium_low' | 'medium' | 'high';
export type Exposure = 'dark' | 'balanced' | 'bright';
export type BacklightPolicy = 'avoid' | 'accept' | 'intentional';
export type SunRelative = 'front' | 'side' | 'behind' | 'not_applicable';
export type Stability = 'tripod' | 'handheld';
export type Movement = 'static' | 'pan' | 'tilt' | 'tracking';

/** Les champs à choix fermé d'un plan : ce que l'utilisateur lit et modifie en mots. */
export type ShotChoices = {
  size: ShotSize;
  subject_kind: SubjectKind;
  subject_view: SubjectView;
  subject_position: SubjectPosition;
  camera_angle: CameraAngle;
  tilt: Tilt;
  light_contrast: LightContrast;
  exposure: Exposure;
  backlight: BacklightPolicy;
  sun_relative: SunRelative;
  stability: Stability;
  movement: Movement;
};
export type ShotIntent = ShotChoices & {
  label_fr: string;
  why_fr: string;
  rule_ids: string[];
  advice_fr: string[];
};

export type NumRange = { min: number; max: number };
/** Cibles chiffrées d'un plan, calculées par la calibration (mêmes noms que le backend). */
export type ShotTargets = {
  roll_abs_deg: NumRange;
  /** null : plan en mouvement, pas d'angle fixe à viser. */
  pitch_deg: NumRange | null;
  subject_h: NumRange | null;
  center_x: NumRange | null;
  center_y: NumRange | null;
  headroom: NumRange | null;
  luma: NumRange;
  contrast: NumRange;
  backlight_ratio_max: number | null;
  sun_offset_abs_deg: NumRange | null;
  /** null : plan en mouvement (la caméra bouge exprès). */
  shake_max: number | null;
};

export type RuleSource = { title: string; author: string | null; url: string; type: string };
export type RuleRef = { id: string; title_fr: string; confidence: string; sources: RuleSource[] };
/** Un passage d'un plan en mouvement. Les secondes se comptent depuis le début de la prise. */
export type TimelineSegment = {
  id: string;
  start_s: number;
  end_s: number;
  /** Ce qui se passe à l'image et comment la caméra bouge pendant ce passage. */
  description_fr: string;
  at_start: ShotChoices;
  /** Cadrage à la fin du passage s'il évolue en douceur (sinon null). */
  at_end: ShotChoices | null;
  targets_start: ShotTargets;
  targets_end: ShotTargets | null;
};
export type Timeline = {
  duration_s: number;
  /** Comment la scène sera filmée, en phrases (écrit par l'IA). */
  how_fr: string;
  segments: TimelineSegment[];
};
export type PlanShot = {
  id: string;
  intent: ShotIntent;
  targets: ShotTargets;
  rules: RuleRef[];
  /** Seulement pour un plan en mouvement ; `intent` et `targets` décrivent alors le premier passage. */
  timeline?: Timeline | null;
};
export type ShotSpec = {
  scene_id: string;
  /** « Brouillon IA : à valider » */
  status: string;
  calibration: string;
  model: string;
  generated_at: string;
  shots: PlanShot[];
};

export type SceneSettingInput = 'interior' | 'exterior' | 'unknown' | 'INT' | 'EXT';
export type SupportInput = 'handheld' | 'tripod' | 'unknown';
/** Une scène et ses étiquettes. Seule `description` est obligatoire. */
export type ShotSpecRequest = {
  description: string;
  scene_id?: string;
  setting?: SceneSettingInput;
  moment?: SceneMoment;
  location?: string;
  characters?: string[];
  mood?: string[];
  visual_style?: string;
  intention?: string;
  light?: string;
  support?: SupportInput;
  /** Plan fixe ou en mouvement (panoramique, tilt, travelling). */
  motion?: 'fixed' | 'moving' | 'unknown';
  /** Durée estimée de la scène en secondes (2 à 120) : obligatoire pour un plan en mouvement. */
  duration_s?: number;
};

type Pair = [number, number];
export type CalibrationField = {
  key: keyof ShotChoices;
  label_fr: string;
  options: { value: string; label_fr: string }[];
};
/** Tables de conversion « mots → nombres » : le téléphone recalcule les cibles hors ligne. */
export type Calibration = {
  version: string;
  third_tol: number;
  rules: { no_subject: string[]; has_head: string[]; moving: string[] };
  tables: {
    subject_h: Record<string, Pair>;
    headroom: Record<string, Pair>;
    center_x: Record<string, number>;
    pitch: Record<string, Pair>;
    roll_abs: Record<string, Pair>;
    luma: Record<string, Pair>;
    contrast: Record<string, Pair>;
    backlight_ratio_max: Record<string, number | null>;
    sun_offset_abs: Record<string, Pair>;
    shake_max: Record<string, number>;
  };
  vocabulary: CalibrationField[];
};

// ---------------------------------------------------------------------------
// Coach : espaces de travail synchronisés avec le compte (GET/PUT/DELETE /workspaces)
// ---------------------------------------------------------------------------
/** Un espace de travail tel que le serveur le garde. `data` = { request, spec, overrides, notes }. */
export type WorkspaceRecord = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  /** Augmente à chaque enregistrement : sert à détecter deux appareils qui modifient le même espace. */
  version: number;
  created_at: string;
  updated_at: string;
};
export type WorkspaceInput = {
  name: string;
  data: Record<string, unknown>;
  /** Version sur laquelle la modification est fondée ; null pour créer l'espace. */
  base_version: number | null;
};
