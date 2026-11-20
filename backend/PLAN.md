# Backend plan (Premier Plan)

## Fait
- Squelette FastAPI (routes / contrôleurs / services / middleware), santé, connexion Supabase + Postgres
- 71 règles de cinématographie validées (`rules/rules.json`) + chargeur
- Auth : vérification du jeton Supabase (HS256 ou clés publiques), limite de débit par utilisateur
- `POST /projects` (+ GET, PATCH, DELETE), `GET /me` (migrations 0001 à 0003)
- **LLM : Gemini** (`google-genai`, sortie structurée Pydantic). Modèle réglable par `LLM_MODEL`
- `POST /shot-spec` : la scène + étiquettes (ambiance, style, intention, lumière, appui...) → plan en vocabulaire fermé → cibles chiffrées
- `GET /calibration` : tables mots → nombres + libellés français (le téléphone recalcule hors ligne)
- Jeu d'essai commun Python/TypeScript (`tests/fixtures/targets_cases.json`)
## Done
- FastAPI skeleton (routes / controllers / services / middleware), health routes, Supabase + Postgres connection code
- 71 validated cinematography rules (`rules/rules.json`) + loader
- `POST /shot-spec` (LLM → closed-vocabulary intent → numeric targets via `calibration.py`), 14 tests with a fake LLM
- `POST/GET/PATCH/DELETE /projects` in Supabase Postgres (`projects.data` jsonb), owner check in every query; demo login mapped to one shared demo user (refused in production)
- **Call sheets** (`app/services/callsheet/`):
  - `POST /callsheets/preview`: one draft per team member (subject, editable message, text + HTML, their scenes, `.ics` with one event per shooting day). Actors get only the scenes of their characters; technicians get the whole schedule. Scene text only on request, and only the member's own scenes.
  - `POST /callsheets/send`: rebuilds each e-mail server-side from the edited subject/message (the browser never sends HTML), refuses members without consent or valid e-mail, per-recipient status, max 50 recipients, Resend HTTP API with idempotency key. No `RESEND_API_KEY` → dry run (`dry_run=true`).
  - Team members (`Member`: name, e-mail, role, characters, consent) are stored in the project (`members` field), next to the wizard's `people`.
  - Login required on both routes (otherwise an open e-mail relay).
- **Kit Festival, festivals** : `GET /festivals` (filtres + classement, contrat `searchFestivals`), `POST /festivals/match` (film et filtres dans le corps), `GET /festivals/{id}` ; 20 fiches réelles sourcées dans `data/festivals.json` ; 16 tests
  - Supabase : appliquer `supabase/migrations/20261118120000_festivals.sql`, puis `supabase/seed_festivals.sql` (SQL Editor, ou `supabase db push`)
  - Après une modification de `data/festivals.json` : `uv run python -m scripts.build_festival_seed`, puis relancer le seed (upsert)
  - Sans `DATABASE_URL`, l'API lit directement `data/festivals.json` (dev local, tests)
  - `deadline_status` (`ouverte` / `passee` / `a_confirmer`) est calculé à la lecture, jamais stocké
- **Kit Festival, sous-titres** : `POST /subtitles/{id}/draft` (audio/vidéo → transcription ElevenLabs Scribe v2 → découpage → traduction FR + EN par Gemini ou Ollama → règles), `GET` et `PUT /subtitles/{id}` ; glossaire derja `data/glossaire_derja.json` (8 entrées à relire par l'équipe) ; tests avec faux fournisseurs
  - Supabase : appliquer `supabase/migrations/20261118150000_subtitle_drafts.sql` (RLS sans policy : accès serveur uniquement)
  - Sans `DATABASE_URL`, les brouillons restent en mémoire (perdus au redémarrage)
  - Réglages : `ELEVENLABS_API_KEY`, `LLM_PROVIDER`, `GEMINI_API_KEY` / `GEMINI_MODEL` ou `OLLAMA_URL` / `OLLAMA_MODEL`, `SUBTITLE_MAX_UPLOAD_MB`

## Sous-titres : où vont les données

## Call sheets: next
- Verify a sending domain in Resend (today only `onboarding@resend.dev`, which only delivers to the Resend account owner).
- Rate limit `/callsheets/send` per user (e.g. a few calls per hour) and keep a send log (who, when, status; never the content).
- Real Supabase login in the front, so each director only sees their own team.
- Merge the wizard's `people` and the new `members` into one list.
- Let members confirm their own consent (link in a first e-mail) instead of the director ticking a box.

## Reminders
- Calibration numbers are v0 engineering defaults, not sourced facts; calibrate in field tests.
- Never log scene text.
- **Audio → ElevenLabs** (transcription). Le fichier est envoyé à ElevenLabs et y est conservé selon leurs conditions ;
  le mode sans conservation (zero retention) est réservé aux clients entreprise. Côté serveur, le fichier est écrit dans
  un dossier temporaire et supprimé dans un `finally`, succès ou erreur : on ne stocke jamais l'audio.
- **Texte → Gemini** (traduction, `LLM_PROVIDER=gemini`). Avec la version gratuite de l'API, Google peut utiliser le
  contenu envoyé : **données de TEST uniquement**, jamais les dialogues d'un vrai film sans accord écrit de l'équipe du film.
- **Option Ollama** (`LLM_PROVIDER=ollama`) : le modèle tourne sur la machine, le texte ne sort pas.
  L'audio, lui, part toujours chez ElevenLabs.
- **Stockage** : seul le brouillon texte (lignes, traductions, outils utilisés) est gardé, dans `subtitle_drafts`.
- **Logs** : jamais le texte des répliques ni les clés ; seulement durée de l'audio, nombre de lignes, fournisseurs,
  temps de traitement.

- **Un seul plan par scène**, deux prompts séparés (`app/prompts/static.py`, `moving.py`) et deux services (`static_plan_service`, `moving_plan_service`) ; la requête accepte `motion` et `duration_s`
- Plan en mouvement = chronologie de passages en secondes (`Timeline`), cibles par passage, cadrage qui peut évoluer ; seul le tremblement est écarté

- Espaces de travail du Coach enregistrés sur le compte : `GET/PUT/DELETE /workspaces` (migration 0004), versions et détection de conflit (409)

## À tester avec de vraies clés
0. Exécuter la migration `0004_workspaces.sql` dans Supabase.
1. `.env` : `GEMINI_API_KEY`, Supabase (URL, clés, `DATABASE_URL`). Vérifier le nom du modèle dans Google AI Studio.
2. Essayer une scène réelle, **fixe puis en mouvement** ; relire le plan, ajuster les prompts (`app/prompts/`). Le plan en mouvement est le plus exigeant pour le modèle : vérifier que les secondes sont cohérentes avec `how_fr`.

## Ensuite
- Sauvegarder les plans et modifications dans le projet (`scene_extras`, voir `migrations/schema.md`)
- Typage strict des listes du projet (scènes, lieux...) côté serveur
- Planification (lieux, météo), Passeport IA (PDF, C2PA), Kit Festival

## À garder en tête
- Seuils de calibration = réglages de départ (v0), pas des faits sourcés.
- Ne jamais journaliser le texte des scènes.
- Offre gratuite Gemini : Google peut utiliser les textes envoyés pour améliorer ses produits (à confirmer). Ne pas promettre « pas d'entraînement ».
