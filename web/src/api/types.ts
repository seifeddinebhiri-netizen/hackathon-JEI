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
  /** Équipe des convocations : qui reçoit sa feuille de service par e-mail. */
  members?: Member[];
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
  /** Extrait du texte de la scène (1 200 caractères au plus), gardé au découpage du scénario. */
  excerpt?: string;
  /** Fiche de tournage écrite par l'IA à partir du texte de la scène (modifiable). */
  detail?: SceneDetail;
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

/** Membre de l'équipe pour les convocations par e-mail. */
export type MemberRole = 'acteur' | 'technicien';
export type Member = {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  /** Acteurs : personnages joués (noms issus du découpage). */
  characters: string[];
  /** A accepté de recevoir des e-mails de la production. */
  email_consent: boolean;
  /** Téléphone, pour la liste de l'équipe (jamais envoyé par e-mail). */
  phone?: string;
  /** Techniciens : poste (Image, Son, Régie…). */
  job?: string;
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
  kind:
    | 'pluie'
    | 'vent'
    | 'lieu_ferme'
    | 'jour_trop_long'
    | 'autorisation_manquante'
    | 'meteo_a_reverifier'
    | 'lumiere_non_respectee';
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

// --- Lieux proposés par l'IA pour un décor -------------------------------------------
/** Scène envoyée au repérage : ce que le LLM lit pour déduire les besoins du lieu. */
export type LocationSuggestScene = {
  number: string;
  title: string;
  setting: 'INT' | 'EXT';
  moment: SceneMoment;
  summary: string;
  characters: string[];
  excerpt?: string;
};
export type LocationSuggestInput = {
  film: { title: string; format: FilmFormat; city: string; genre?: string; synopsis?: string };
  decor: { name: string };
  scenes: LocationSuggestScene[];
  other_decors: string[];
  /** Types de lieux déjà proposés, à ne pas reproposer */
  exclude: string[];
  /** Contraintes à respecter, ex. « pluie probable : préférer des lieux abrités » */
  constraints?: string[];
};
/** Lieu réel trouvé par la recherche géographique (OpenStreetMap), jamais inventé par l'IA. */
export type PlaceCandidate = { name: string; address: string; lat: number; lon: number; osm_url: string };
export type LocationProposition = {
  type_de_lieu: string;
  pourquoi: string;
  requete_recherche: string;
  zone: string;
  facilite: 'facile' | 'moyenne' | 'difficile';
  autorisation_probable: 'non_necessaire' | 'a_demander';
  a_verifier_sur_place: string[];
  candidates: PlaceCandidate[];
};
export type LocationNeeds = { a_voir: string[]; actions: string[]; ambiance: string; pratique: string[] };
export type LocationSuggestResult = {
  status: 'Brouillon IA : à valider';
  decor: string;
  besoins: LocationNeeds;
  propositions: LocationProposition[];
  mutualisation: string | null;
  model: string;
};

// --- Suggestions de tournage sur le scénario (validées par l'auteur) --------------------
/**
 * Jamais d'écriture : l'IA propose seulement de préciser INT/EXT ou le moment, de regrouper deux
 * décors, d'alléger une scène coûteuse à tourner, ou signale une information manquante.
 */
export type SceneSuggestionKind =
  'preciser_int_ext' | 'preciser_moment' | 'regrouper_decors' | 'alleger_scene' | 'info_manquante';
export type SceneSuggestInput = {
  film: LocationSuggestInput['film'];
  scenes: {
    number: string;
    title: string;
    setting: 'INT' | 'EXT';
    moment: SceneMoment;
    decor: string;
    summary: string;
    characters: string[];
    estimated_hours: number;
    excerpt?: string;
  }[];
  decors: string[];
};
/** Fiche de tournage d'une scène (POST /planner/scenes/detail). Vide = non précisé dans le texte. */
export type SceneDetail = {
  what_happens: string;
  on_screen: string;
  props: string[];
  costumes: string[];
  extras: string;
  sound: string[];
  special: string[];
  watch_out: string[];
  model: string;
};
export type SceneDetailInput = {
  film: LocationSuggestInput['film'];
  scene: Omit<SceneSuggestInput['scenes'][number], 'estimated_hours'>;
};
export type SceneSuggestion = {
  id: string;
  scene_numbers: string[];
  kind: SceneSuggestionKind;
  message: string;
  /** Ce qui, dans le texte, justifie la suggestion */
  source: string;
  change_setting: 'INT' | 'EXT' | null;
  change_moment: SceneMoment | null;
  /** Nom exact d'un décor existant, pour un regroupement */
  change_decor: string | null;
};
export type SceneSuggestResult = {
  status: 'Brouillon IA : à valider';
  suggestions: SceneSuggestion[];
  model: string;
};

// --- Dépouillement du scénario par l'IA (POST /scenarios/analyze) ----------------------
export type ScenarioAnalysisScene = {
  number: number;
  heading: string;
  setting: 'INT' | 'EXT' | 'UNKNOWN';
  time_of_day: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'UNKNOWN';
  location: string;
  summary: string;
  characters: string[];
  props: string[];
  technical_requirements: string[];
  production_challenges: string[];
  missing_information: string[];
  inferences: string[];
  suggestions: string[];
};
export type ScenarioAnalysis = {
  title: string;
  status: 'Brouillon IA : à valider';
  simulated: boolean;
  scenes: ScenarioAnalysisScene[];
  characters: { name: string; description: string; scenes: number[]; production_observations: string[] }[];
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
/** `non_evalue` : aucune recherche n'a abouti pour cet outil. Ce n'est pas « non divulgué » (le fournisseur ne publie rien). */
export type AiToolStatus = 'documente' | 'partiel' | 'non_divulgue' | 'non_evalue';
export type AiTool = {
  id: string;
  name: string;
  provider: string;
  status: AiToolStatus;
  note: string;
  source_url: string;
  checked_at: string;
  /** Une personne a relu cette fiche (sinon : recherche automatique ou chargement initial, non relue). */
  reviewed?: boolean;
};

/** Réponse à « ajouter cet outil » : déjà au catalogue, ou une recherche est lancée sur le serveur. */
export type ToolResolution = { state: 'found'; tool: AiTool } | { state: 'researching'; run_id: string };
export type ToolRun = {
  id: string;
  state: 'queued' | 'running' | 'done' | 'failed';
  tool_slug?: string;
  error?: string;
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
/**
 * Un dossier (un festival suivi). Les pièces cochées à la main ne sont PAS dans le dossier :
 * elles sont rangées une fois par projet (`KitData.pieces`) et servent à tous les dossiers.
 */
export type ShortlistItem = {
  festival_id: string;
  status: ShortlistStatus;
  /** Réponse validée à la question IA de ce festival (null ou absent : pas encore validée). */
  ai_choice?: AiChoice | null;
};
/** Case cochée pour la question IA d'un festival. */
export type AiChoice = 'aucune' | 'outil_technique' | 'generation' | 'les_deux';

// ---------------------------------------------------------------------------
// Kit Festival (Supabase : festival_dossiers, kit_pieces, film_kits)
// ---------------------------------------------------------------------------
/** Pièce cochée à la main. « Bloquant » n'est jamais stocké : il est calculé. */
export type KitPieceState = 'a_faire' | 'pret';
/** Version anglaise d'un synopsis : brouillon IA, avec le texte français qu'il traduit. */
export type SynopsisEnDraft = { text: string; source: string; validated: boolean };
export type SynopsisEnglish = Partial<Record<SynopsisKind, SynopsisEnDraft>>;
/** Champs du film enregistrés par le Kit (table film_kits). */
export type KitFilmFields = {
  film_profile?: ProjectFilmProfile;
  synopsis?: SynopsisTexts;
  film_page?: FilmPageContent;
  synopsis_en?: SynopsisEnglish;
};
export type KitData = KitFilmFields & {
  project_id: string;
  /** Dans l'ordre d'ajout. */
  dossiers: ShortlistItem[];
  /** Pièces cochées à la main, par clé (`pieceKeyOf`) : une seule ligne pour tous les dossiers. */
  pieces: Record<string, KitPieceState>;
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
    | 'members'
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
  /** false : découpage simple, sans IA (IA indisponible). Absent : inconnu (mock). */
  ai_used?: boolean;
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
/** `url` : adresse du PDF à ouvrir. Avec le vrai backend, c'est le PDF signé (C2PA) ; `simulated` : signature de test. */
export type PassportPdf = { url: string; signed?: boolean; simulated?: boolean; manifest_id?: string };
/** Résultat de la vérification d'un PDF de Passeport déposé par un festival (rien n'est conservé). */
export type PdfVerification = {
  state: 'none' | 'invalid' | 'valid' | 'trusted';
  /** Signé par NOTRE certificat (et pas par quelqu'un qui aurait copié nos informations). */
  issued_by_us: boolean;
  signer?: string;
  issuer?: string;
  signing_mode?: 'test' | 'production';
  badge_code?: string;
  film_title?: string;
  issued_at?: string;
  tools: { slug: string; status?: string; reviewed: boolean }[];
  problems: string[];
  /** Le Passeport actuel est-il celui du PDF ? `undefined` : impossible à dire. */
  matches_passport?: boolean;
  reasons: string[];
};
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
// Convocations (feuilles de service par e-mail) — POST /callsheets/preview et /send
// ---------------------------------------------------------------------------
export type CallsheetScene = {
  id: string;
  number: string;
  title: string;
  date: string; // ISO
  /** Heure de rendez-vous, « 08:00 » */
  call_time: string;
  start?: string;
  end?: string;
  location_id: string;
  moment: SceneMoment;
  characters: string[];
  notes: string;
  /** Envoyé seulement si un membre doit recevoir le texte de ses scènes. */
  text?: string;
};
export type CallsheetInput = {
  project: { title: string; director_name: string; reply_to: string; timezone?: string };
  scenes: CallsheetScene[];
  locations: { id: string; name: string; address: string }[];
  members: Member[];
  include_scene_text?: boolean;
  /** Membres qui reçoivent le texte de leurs scènes. */
  include_scene_text_for?: string[];
};
export type CallsheetDraftScene = {
  number: string;
  title: string;
  date: string;
  call_time: string;
  start: string | null;
  end: string | null;
  location_name: string;
  address: string;
  moment_label: string;
  characters: string[];
  notes: string;
  text: string | null;
};
export type CallsheetDraft = {
  member_id: string;
  name: string;
  role: MemberRole;
  to: string;
  subject: string;
  /** Message personnel, modifiable. */
  message: string;
  /** Planning du membre, ajouté sous le message. */
  schedule_text: string;
  text: string;
  html: string;
  scenes: CallsheetDraftScene[];
  ics: string;
  ics_filename: string;
  include_scene_text: boolean;
  /** Raison pour laquelle l'envoi sera refusé, sinon null. */
  blocked_reason: string | null;
};
export type CallsheetPreview = {
  drafts: CallsheetDraft[];
  not_concerned: { member_id: string; name: string; reason: string }[];
  /** false : le serveur n'a pas de clé d'envoi, l'envoi sera un essai. */
  email_configured: boolean;
};
export type CallsheetDraftEdit = {
  member_id: string;
  subject: string;
  message: string;
  include_scene_text: boolean;
};
export type CallsheetSendInput = CallsheetInput & { drafts: CallsheetDraftEdit[] };
export type CallsheetSendStatus = 'envoye' | 'essai' | 'ignore' | 'erreur';
export type CallsheetSendResult = {
  dry_run: boolean;
  results: {
    member_id: string;
    name: string;
    to: string;
    status: CallsheetSendStatus;
    reason: string | null;
    subject: string | null;
  }[];
  sent: number;
  skipped: number;
  failed: number;
};

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
