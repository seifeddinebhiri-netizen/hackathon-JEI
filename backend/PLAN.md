# Backend plan (Premier Plan)

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

## Call sheets: next
- Verify a sending domain in Resend (today only `onboarding@resend.dev`, which only delivers to the Resend account owner).
- Rate limit `/callsheets/send` per user (e.g. a few calls per hour) and keep a send log (who, when, status; never the content).
- Real Supabase login in the front, so each director only sees their own team.
- Merge the wizard's `people` and the new `members` into one list.
- Let members confirm their own consent (link in a first e-mail) instead of the director ticking a box.

## Reminders
- Calibration numbers are v0 engineering defaults, not sourced facts; calibrate in field tests.
- Never log scene text.
