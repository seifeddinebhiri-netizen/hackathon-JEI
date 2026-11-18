# Backend plan (Premier Plan)

## Done
- FastAPI skeleton (routes / controllers / services / middleware), health routes, Supabase + Postgres connection code
- 71 validated cinematography rules (`rules/rules.json`) + loader
- `POST /shot-spec` (LLM → closed-vocabulary intent → numeric targets via `calibration.py`), 14 tests with a fake LLM
- **Kit Festival, festivals** : `GET /festivals` (filtres + classement, contrat `searchFestivals`), `POST /festivals/match` (film et filtres dans le corps), `GET /festivals/{id}` ; 20 fiches réelles sourcées dans `data/festivals.json` ; 16 tests
  - Supabase : appliquer `supabase/migrations/20261118120000_festivals.sql`, puis `supabase/seed_festivals.sql` (SQL Editor, ou `supabase db push`)
  - Après une modification de `data/festivals.json` : `uv run python -m scripts.build_festival_seed`, puis relancer le seed (upsert)
  - Sans `DATABASE_URL`, l'API lit directement `data/festivals.json` (dev local, tests)
  - `deadline_status` (`ouverte` / `passee` / `a_confirmer`) est calculé à la lecture, jamais stocké

## Next, in order
1. Fill `.env` (Supabase keys, `DATABASE_URL`, `ANTHROPIC_API_KEY`) and test a real scene with curl; review the plans and tune the prompt.
2. Auth (Supabase JWT verification as a dependency) + rate limit on `/shot-spec` (paid LLM call).
3. **`POST /projects`** (+ `GET /projects/{id}`, `DELETE /projects/{id}`): save a project (scene text, setting, the shot spec, user edits) in Supabase Postgres. Needs a migration (table `projects`, row-level security so a user sees only their own rows). Nothing is stored unless the user saves (zero retention by default).
4. **Expose the calibration as JSON** so the client can recompute targets offline after the user edits the AI answer:
   - `GET /calibration` returns the lookup tables from `app/services/calibration.py` (version string, per-enum ranges, thirds tolerance).
   - Single source of truth: build the JSON from the same Python tables, never maintain a second copy.
   - The client (TypeScript) implements `computeTargets(intent, calibration)` identically to `compute_targets`. Add a shared test fixture (intents → expected targets) run by both pytest and Vitest so they cannot drift.
   - The phone caches the calibration JSON with the shot spec (IndexedDB); `calibration` version in the shot spec tells the client whether its cached tables match.
   - Editable fields on the client are the intent enums (size, angle, contrast...); the client recalculates targets from them, no server call needed.
5. Phone-side engine: compare live measurements to the targets (rule engine, debounce, one instruction at a time).

## Reminders
- Calibration numbers are v0 engineering defaults, not sourced facts; calibrate in field tests.
- Never log scene text.
