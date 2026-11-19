-- 0005 : Kit Festival (dossiers, pièces, synopsis et page film, Passeport IA, sous-titres)
-- À coller dans Supabase > SQL Editor APRÈS 0001 à 0004 et après les deux migrations de
-- backend/supabase/migrations/ (tables `festivals` et `subtitle_drafts`), dont elle dépend.
--
-- Principe : une pièce préparée une fois sert à tous les dossiers qui la demandent. Les pièces
-- cochées à la main sont donc enregistrées UNE fois par projet (`kit_pieces`, clé de pièce),
-- jamais copiées dans chaque dossier. Les autres pièces (synopsis, sous-titres, déclaration IA,
-- photos, page film) sont calculées par le front à partir de `film_kits`, `ai_passports` et
-- `subtitle_drafts`.
--
-- owner_id : le défaut auth.uid() sert au front (clé publique + RLS). Le backend et le script de
-- démonstration se connectent en direct (RLS ignorée, auth.uid() vide) : ils remplissent toujours
-- owner_id explicitement.

-- --- Énumérations (valeurs ASCII, libellés affichés par le front) -------------------------
-- « Où j'en suis » (web/src/features/festival/lib/labels.ts, SHORTLIST_STATUS_LABELS) :
--   a_preparer     → En préparation
--   pret           → Prêt à soumettre
--   soumis         → Soumis sur le site officiel
--   reponse_recue  → Réponse reçue
--   prochain_appel → Pour le prochain appel
create type public.dossier_status as enum
  ('a_preparer', 'pret', 'soumis', 'reponse_recue', 'prochain_appel');

-- Pièce cochée à la main : a_faire → À faire, pret → Prêt.
-- « Bloquant » n'est jamais stocké : il est calculé (film trop long, synopsis trop long…).
create type public.piece_state as enum ('a_faire', 'pret');

-- Réponse validée à la question IA d'un festival (web/src/features/festival/lib/aiDeclaration.ts) :
--   aucune → Pas d'IA dans le film, outil_technique → outils techniques, generation → génération,
--   les_deux → les deux. null : pas encore validée.
create type public.ai_choice as enum ('aucune', 'outil_technique', 'generation', 'les_deux');

-- --- Dossiers : un festival suivi pour un projet --------------------------------------------
create table public.festival_dossiers (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  festival_id  text not null references public.festivals(id) on delete restrict,
  status       public.dossier_status not null default 'a_preparer',
  ai_choice    public.ai_choice,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, festival_id)
);
create index festival_dossiers_owner_idx on public.festival_dossiers (owner_id);
create trigger festival_dossiers_touch before update on public.festival_dossiers
  for each row execute function public.touch_updated_at();

-- --- Pièces cochées à la main, une ligne par projet et par clé de pièce --------------------
-- Clés : 'affiche', 'bio', 'droits_musique', 'format:<festival_id>' (pieceKeyOf dans
-- web/src/features/festival/lib/dossier.ts). La déclaration IA, propre à chaque festival, est la
-- colonne festival_dossiers.ai_choice.
create table public.kit_pieces (
  project_id  uuid not null references public.projects(id) on delete cascade,
  owner_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  piece_key   text not null check (piece_key ~ '^[a-z_]{1,40}(:[a-z0-9_-]{1,80})?$'),
  state       public.piece_state not null default 'a_faire',
  updated_at  timestamptz not null default now(),
  primary key (project_id, piece_key)
);
create index kit_pieces_owner_idx on public.kit_pieces (owner_id);
create trigger kit_pieces_touch before update on public.kit_pieces
  for each row execute function public.touch_updated_at();

-- --- Profil du film, synopsis et page film (une ligne par projet) ---------------------------
create table public.film_kits (
  project_id       uuid primary key references public.projects(id) on delete cascade,
  owner_id         uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  duration_min     integer check (duration_min between 1 and 600),
  language         text check (char_length(language) <= 80),
  genre            text check (char_length(genre) <= 80),
  synopsis_phrase  text not null default '' check (char_length(synopsis_phrase) <= 1000),
  synopsis_court   text not null default '' check (char_length(synopsis_court) <= 5000),
  synopsis_long    text not null default '' check (char_length(synopsis_long) <= 10000),
  -- Version anglaise (brouillon IA relu) par version : {"court": {"text", "source", "validated"}}
  synopsis_en      jsonb not null default '{}'::jsonb check (jsonb_typeof(synopsis_en) = 'object'),
  stills           text[] not null default '{}' check (cardinality(stills) <= 12),
  trailer_url      text check (char_length(trailer_url) <= 500),
  updated_at       timestamptz not null default now()
);
create index film_kits_owner_idx on public.film_kits (owner_id);
create trigger film_kits_touch before update on public.film_kits
  for each row execute function public.touch_updated_at();

-- --- Passeport IA (une ligne par projet) ------------------------------------------------------
-- badge_code : code imprimé sur le badge, créé par le front (préfixe de web/src/app/brand.ts).
-- Lecture publique UNIQUEMENT par la fonction verify_badge (champs publics).
create table public.ai_passports (
  project_id    uuid primary key references public.projects(id) on delete cascade,
  owner_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  film_title    text not null check (char_length(film_title) between 1 and 200),
  director      text not null default '' check (char_length(director) <= 200),
  declarations  jsonb not null default '[]'::jsonb check (jsonb_typeof(declarations) = 'array'),
  c2pa_signed   boolean not null default false,
  badge_code    text not null unique check (badge_code ~ '^[A-Z0-9]{2,6}-[A-Z0-9]{4}-[A-Z0-9]{2}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index ai_passports_owner_idx on public.ai_passports (owner_id);
create trigger ai_passports_touch before update on public.ai_passports
  for each row execute function public.touch_updated_at();

-- --- Sous-titres : propriétaire du brouillon -------------------------------------------------
-- Le backend reste le seul à écrire (transcription). Les anciennes lignes sans propriétaire
-- (essais) ne sont plus visibles par personne.
alter table public.subtitle_drafts
  add column owner_id uuid references public.profiles(id) on delete cascade;
create index subtitle_drafts_owner_idx on public.subtitle_drafts (owner_id);

-- --- Sécurité par ligne ----------------------------------------------------------------------
-- Le backend se connecte en direct et l'ignore (il vérifie lui-même le propriétaire).
-- Elle protège les accès faits avec la clé publique depuis le navigateur : chacun ne voit et ne
-- modifie que ses lignes, et seulement sur ses propres projets.
alter table public.festival_dossiers enable row level security;
create policy "dossiers: propriétaire" on public.festival_dossiers for all
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

alter table public.kit_pieces enable row level security;
create policy "pièces: propriétaire" on public.kit_pieces for all
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

alter table public.film_kits enable row level security;
create policy "kit film: propriétaire" on public.film_kits for all
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

alter table public.ai_passports enable row level security;
create policy "passeport: propriétaire" on public.ai_passports for all
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

-- Lecture seule de son propre brouillon (écriture : backend uniquement).
create policy "sous-titres: lecture propriétaire" on public.subtitle_drafts for select
  using (owner_id = (select auth.uid()));

-- --- Vérification publique d'un badge (/verifier/<code>) -------------------------------------
-- security definer : contourne la RLS, mais ne renvoie que les champs publics du Passeport.
create function public.verify_badge(code text)
returns table (film_title text, director text, declarations jsonb, c2pa_signed boolean)
language sql stable security definer set search_path = ''
as $$
  select p.film_title, p.director, p.declarations, p.c2pa_signed
  from public.ai_passports p
  where p.badge_code = upper(btrim(code))
  limit 1;
$$;
revoke all on function public.verify_badge(text) from public;
grant execute on function public.verify_badge(text) to anon, authenticated;
