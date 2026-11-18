-- Kit Festival : fiches festivals (données de référence, lecture publique).
-- Le statut de la date limite (ouverte / passée / à confirmer) n'est PAS stocké :
-- il est calculé à la lecture par le backend.

create table if not exists public.festivals (
  id               text primary key,
  name             text not null,
  country          text not null,
  city             text,
  edition          text,
  deadline         date,                       -- null = à confirmer
  deadline_note    text,
  fee              text not null default '[non précisé]',
  max_duration_min int check (max_duration_min > 0),
  subtitle_langs   text[] not null default '{}',
  ai_policy        text not null default 'non_precisee'
    check (ai_policy in ('acceptee', 'a_declarer', 'interdite', 'section_dediee', 'non_precisee')),
  ai_policy_detail text,
  eligibility      text,
  requirements     jsonb not null default '[]'::jsonb
    check (jsonb_typeof(requirements) = 'array'),
  source_url       text not null check (source_url <> ''),   -- pas de fiche sans source
  checked_at       date not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists festivals_deadline_idx on public.festivals (deadline);

-- Lecture pour tous (anon + connectés). Aucune écriture côté client :
-- les fiches sont ajoutées par migration/seed avec la clé service role.
alter table public.festivals enable row level security;

drop policy if exists "festivals lisibles par tous" on public.festivals;
create policy "festivals lisibles par tous"
  on public.festivals for select
  to anon, authenticated
  using (true);

create or replace function public.festivals_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists festivals_updated_at on public.festivals;
create trigger festivals_updated_at
  before update on public.festivals
  for each row execute function public.festivals_set_updated_at();
