/**
 * L'envers du décor : un diagramme back-end par module, extrait du dépôt
 * seifeddinebhiri-netizen/hackathon-JEI le 20 nov. 2026 :
 *  - origin/main (dont la fusion « ai-passport » : PDF et signature C2PA du Passeport) ;
 *  - feature/scenario-ai (planner, convocations : pas encore fusionné dans main).
 * Chaque bloc cite le fichier ou la route qui le prouve (`proof`, affiché au survol).
 *
 * Statut : integre = route branchée et testée ; partiel = branché mais simulé, non validé avec une vraie
 * clé, en revue ou certificat de test ; prevu = pas encore codé.
 */
export type Maturity = 'integre' | 'partiel' | 'prevu';

export const MATURITY_LABEL: Record<Maturity, string> = {
  integre: 'Intégré',
  partiel: 'Partiel',
  prevu: 'Prévu',
};

export interface Block {
  id: string;
  /** Colonne (0 à 4) et rangée (0 ou 1) dans la grille du diagramme */
  col: number;
  row: number;
  kicker: string;
  title: string;
  tags: string[];
  status: Maturity;
  proof: string;
}

export interface Diagram {
  blocks: Block[];
  edges: [string, string, ('dashed' | undefined)?][];
}

export const DIAGRAMS: Record<'planifier' | 'tourner' | 'declarer' | 'diffuser', Diagram> = {
  planifier: {
    blocks: [
      { id: 'front', col: 0, row: 0, kicker: 'Front · React', title: 'Import du scénario', tags: ['.txt .fountain', 'PDF · Word'], status: 'integre', proof: 'web/src/features/planner/components/wizard/StepScreenplay.tsx' },
      { id: 'api', col: 1, row: 0, kicker: 'FastAPI', title: 'POST /planner/parse', tags: ['découpage en passages', 'Pydantic'], status: 'integre', proof: 'backend/app/routes/screenplay.py · services/screenplay/pipeline.py · tests/test_screenplay.py' },
      { id: 'ia', col: 2, row: 0, kicker: 'IA · brouillon', title: 'Scènes et suggestions', tags: ['Gemini', 'Anthropic · Groq', 'Ollama (local)'], status: 'integre', proof: 'services/screenplay/llm.py · services/llm_service.py · /planner/scenes/suggest' },
      { id: 'humain', col: 3, row: 0, kicker: 'Le cinéaste décide', title: 'Accepter · refuser', tags: ['Brouillon IA', 'J’ai relu'], status: 'integre', proof: 'wizard/SceneSuggestions.tsx · wizard/SceneEditor.tsx' },
      { id: 'db', col: 4, row: 0, kicker: 'Supabase', title: 'Projet enregistré', tags: ['PostgreSQL', 'RLS propriétaire'], status: 'integre', proof: 'routes/projects.py · migrations/0002_projects.sql · tests/test_projects.py' },
      { id: 'lieux', col: 1, row: 1, kicker: 'Lieux et météo', title: 'Lieux réels, 14 jours', tags: ['OSM Nominatim', 'Open-Meteo', 'SunCalc'], status: 'integre', proof: '/planner/locations/suggest (places_service.py) · /planner/weather (weather_service.py) · web/src/lib/sun.ts' },
      { id: 'cal', col: 3, row: 1, kicker: 'Calendrier', title: 'Planning et convocations', tags: ['calcul navigateur', 'Resend (essai)'], status: 'partiel', proof: 'api/mocks/scheduler.ts (NOT_IN_BACKEND_YET) · /callsheets (feature/scenario-ai, non fusionné)' },
    ],
    edges: [
      ['front', 'api'],
      ['api', 'ia'],
      ['ia', 'humain'],
      ['humain', 'db'],
      ['api', 'lieux'],
      ['lieux', 'cal'],
      ['humain', 'cal'],
    ],
  },
  tourner: {
    blocks: [
      { id: 'front', col: 0, row: 0, kicker: 'Front · React', title: 'Décrire la scène', tags: ['espaces de travail', 'fixe · mouvement'], status: 'integre', proof: 'web/src/features/coach/plan/components/CoachFlow.tsx' },
      { id: 'api', col: 1, row: 0, kicker: 'FastAPI', title: 'POST /shot-spec', tags: ['jeton Supabase', 'limite par utilisateur'], status: 'integre', proof: 'backend/app/routes/shot_spec.py · tests/test_shot_spec.py' },
      { id: 'ia', col: 2, row: 0, kicker: 'IA · plan en mots', title: 'Vocabulaire fermé', tags: ['Gemini', '71 règles sourcées'], status: 'partiel', proof: 'services/static_plan_service.py · moving_plan_service.py · rules/rules.json (pas encore validé avec une vraie clé)' },
      { id: 'calib', col: 3, row: 0, kicker: 'Calibration', title: 'Mots → chiffres', tags: ['GET /calibration', 'réglages v0'], status: 'integre', proof: 'services/calibration.py · routes/calibration.py · tests/test_calibration.py' },
      { id: 'db', col: 1, row: 1, kicker: 'Supabase', title: 'Espaces enregistrés', tags: ['table workspaces', 'RLS · conflits 409'], status: 'integre', proof: 'routes/workspaces.py · migrations/0004_workspaces.sql · tests/test_workspaces.py' },
      { id: 'device', col: 3, row: 1, kicker: 'Sur le téléphone', title: 'Mesure en direct', tags: ['MediaPipe BlazeFace', 'capteurs · Canvas', 'MediaRecorder'], status: 'integre', proof: 'features/coach/measure/useFaceDetector.ts · useOrientation.ts · useFrameStats.ts · useRecorder.ts' },
      { id: 'pose', col: 4, row: 1, kicker: 'Prochaine brique', title: 'Corps entier', tags: ['modèle de pose'], status: 'prevu', proof: 'README § 9 : voyants de taille non mesurés' },
    ],
    edges: [
      ['front', 'api'],
      ['api', 'ia'],
      ['ia', 'calib'],
      ['api', 'db'],
      ['calib', 'device'],
      ['device', 'pose', 'dashed'],
    ],
  },
  declarer: {
    blocks: [
      { id: 'front', col: 0, row: 0, kicker: 'Front · React', title: 'Déclarer par département', tags: ['Étiquette IA', '8 départements'], status: 'integre', proof: 'web/src/routes/Passport.tsx · features/passport/' },
      { id: 'db', col: 1, row: 0, kicker: 'Supabase', title: 'Passeport enregistré', tags: ['ai_passports · RLS', 'badge généré en base'], status: 'integre', proof: 'migrations/0005_kit_festival.sql · 0007_passeport_verrous.sql · 0011_passport_resign.sql' },
      { id: 'pdf', col: 2, row: 0, kicker: 'FastAPI · PDF signé', title: 'POST /passports/{id}/pdf', tags: ['ReportLab', 'c2pa-python · ES256'], status: 'partiel', proof: 'origin/main : services/passport_pdf_service.py · c2pa_service.py · tests/test_passport_c2pa.py (certificat de TEST)' },
      { id: 'verif', col: 4, row: 0, kicker: 'Pour les festivals', title: 'Vérification publique', tags: ['POST /verify/pdf', 'rien n’est stocké'], status: 'integre', proof: 'origin/main : routes/verify.py · services/verify_service.py · tests/test_verify_pdf.py' },
      { id: 'resolve', col: 1, row: 1, kicker: 'FastAPI', title: 'POST /ai-tools/resolve', tags: ['outil inconnu → recherche'], status: 'integre', proof: 'origin/main : routes/ai_tools.py · tests/test_ai_tools.py' },
      { id: 'research', col: 2, row: 1, kicker: 'IA · recherche', title: 'Documentation publique', tags: ['Gemini', 'pages https · citations'], status: 'integre', proof: 'origin/main : services/research/pipeline.py · fetcher.py · quotes.py' },
      { id: 'catalog', col: 3, row: 1, kicker: 'Supabase', title: 'Catalogue des outils', tags: ['ai_tools · ai_tool_facts', 'statut par outil'], status: 'integre', proof: 'origin/main : migrations/0009_ai_tools.sql · data/ai_tools_seed.json · services/tool_status.py' },
    ],
    edges: [
      ['front', 'db'],
      ['db', 'pdf'],
      ['pdf', 'verif'],
      ['front', 'resolve'],
      ['resolve', 'research'],
      ['research', 'catalog'],
    ],
  },
  diffuser: {
    blocks: [
      { id: 'front', col: 0, row: 0, kicker: 'Front · React', title: 'Kit Festival', tags: ['catalogue · dossiers', 'relecture'], status: 'integre', proof: 'web/src/routes/festival/ · features/festival/' },
      { id: 'fest', col: 1, row: 0, kicker: 'FastAPI', title: 'GET /festivals', tags: ['festivals.json · 20 fiches', 'compatibilité'], status: 'integre', proof: 'routes/festivals.py · services/festival_service.py · data/festivals.json · tests/test_festivals.py' },
      { id: 'db', col: 4, row: 0, kicker: 'Supabase', title: 'Dossiers et brouillons', tags: ['festival_dossiers', 'subtitle_drafts', 'public_film()'], status: 'integre', proof: 'migrations/0005_kit_festival.sql · 0008_public_film.sql · supabase/migrations/…_subtitle_drafts.sql · api/supabase/kit.ts' },
      { id: 'sub', col: 1, row: 1, kicker: 'FastAPI', title: 'POST /subtitles/{id}/draft', tags: ['audio en fichier temporaire', 'supprimé après'], status: 'integre', proof: 'routes/subtitles.py · services/subtitle_service.py · tests/test_subtitles.py' },
      { id: 'stt', col: 2, row: 1, kicker: 'IA · transcription', title: 'Derja → texte', tags: ['ElevenLabs Scribe'], status: 'integre', proof: 'services/transcription_service.py' },
      { id: 'tr', col: 3, row: 1, kicker: 'IA · traduction', title: 'Français · anglais', tags: ['Gemini ou Ollama', 'glossaire derja'], status: 'integre', proof: 'services/translation_service.py · glossary_service.py · data/glossaire_derja.json' },
      { id: 'valid', col: 4, row: 1, kicker: 'Le cinéaste décide', title: 'Ligne par ligne → .srt', tags: ['confiance', 'export verrouillé'], status: 'integre', proof: 'features/festival/components/viewer/SubtitleViewer.tsx · lib/srt.ts' },
    ],
    edges: [
      ['front', 'fest'],
      ['fest', 'db'],
      ['front', 'sub'],
      ['sub', 'stt'],
      ['stt', 'tr'],
      ['tr', 'valid'],
      ['valid', 'db'],
    ],
  },
};
