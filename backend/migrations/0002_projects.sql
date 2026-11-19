-- 0002 : projets
-- Colonnes pour l'essentiel + jsonb `data` pour le reste (scènes, lieux, personnes, planning,
-- synopsis, `scene_extras`...). `scene_extras` est géré par le backend :
--   { "<scene_id>": { source_excerpt?, ai_original, edited_fields[], shot_plan: {ai, user, calibration} } }

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  format      text not null check (format in ('court', 'long')),
  city        text not null default '',
  data        jsonb not null default '{}'::jsonb,
  version     integer not null default 1,  -- incrémenté à chaque modification (verrou optimiste)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index projects_owner_idx on public.projects (owner_id);

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

alter table public.profiles
  add constraint profiles_current_project_fk
  foreign key (current_project_id) references public.projects(id) on delete set null;

-- Attention : le backend FastAPI se connecte en direct à Postgres et IGNORE cette sécurité par
-- ligne. Il doit donc vérifier lui-même owner_id = utilisateur du jeton. Cette policy protège
-- les accès directs faits avec la clé `anon` depuis le navigateur.
alter table public.projects enable row level security;
create policy "projets: propriétaire" on public.projects for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
