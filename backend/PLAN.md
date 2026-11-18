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
