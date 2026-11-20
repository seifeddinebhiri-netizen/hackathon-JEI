-- 0009 : catalogue des outils d'IA (Passeport IA)
-- Un outil, ses noms alternatifs, et des FAITS : chaque fait garde sa source (URL), la phrase exacte
-- copiée de la page, et si cette phrase a bien été retrouvée dans la page par le serveur.
-- Rien ici n'est un avis juridique : « documenté » veut dire « le fournisseur répond, source à l'appui ».

create table public.ai_tools (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name           text not null check (char_length(name) between 1 and 80),
  vendor         text not null default '',
  official_site  text,
  categories     text[] not null default '{}',   -- text, image, video, voice, music, translation, editing
  terms_url      text,
  privacy_url    text,
  terms_updated  text,                           -- date lue sur la page des conditions (telle quelle)
  -- null = pas encore évalué ; sinon calculé par le serveur à partir des faits (jamais par l'IA)
  status         text check (status in ('documente', 'partiel', 'non_divulgue')),
  -- seed/auto = écrit par un script ou la recherche automatique ; verifie = relu par un humain
  review_state   text not null default 'a_verifier' check (review_state in ('a_verifier', 'verifie')),
  research_state text not null default 'none'
                 check (research_state in ('none', 'incomplete_access', 'complete')),
  note_fr        text not null default '',
  checked_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger ai_tools_touch before update on public.ai_tools
  for each row execute function public.touch_updated_at();

-- Noms alternatifs, normalisés (minuscules, sans accents ni espaces) : « chat gpt » retrouve ChatGPT.
create table public.ai_tool_aliases (
  alias_norm text primary key,
  tool_id    uuid not null references public.ai_tools(id) on delete cascade
);
create index ai_tool_aliases_tool_idx on public.ai_tool_aliases (tool_id);

create table public.ai_tool_facts (
  id             uuid primary key default gen_random_uuid(),
  tool_id        uuid not null references public.ai_tools(id) on delete cascade,
  field          text not null check (field in (
                   'training_data', 'input_training_use', 'output_rights',
                   'provenance', 'indemnity', 'voice_likeness')),
  plan           text not null default 'all',    -- all, free, paid, consumer, api, enterprise...
  value_fr       text not null check (char_length(value_fr) between 1 and 600),
  quote          text not null check (char_length(quote) between 1 and 500),
  source_url     text not null,
  source_kind    text not null default 'terms'
                 check (source_kind in ('terms', 'privacy', 'policy', 'help', 'model_card', 'marketing')),
  quote_verified boolean not null default false, -- phrase retrouvée mot pour mot dans la page par le serveur
  retrieved_at   timestamptz not null default now()
);
create index ai_tool_facts_tool_idx on public.ai_tool_facts (tool_id, field);

-- Journal des recherches automatiques (une par outil absent). Jamais lisible depuis le navigateur.
create table public.ai_tool_research_runs (
  id           uuid primary key default gen_random_uuid(),
  name_norm    text not null,
  requested_by uuid references public.profiles(id) on delete set null,
  tool_id      uuid references public.ai_tools(id) on delete set null,
  state        text not null default 'queued' check (state in ('queued', 'running', 'done', 'failed')),
  error        text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
-- Une seule recherche en cours par nom d'outil.
create unique index ai_tool_research_inflight_idx
  on public.ai_tool_research_runs (name_norm) where state in ('queued', 'running');

-- Le catalogue est public en lecture ; seul le serveur écrit (connexion directe, RLS ignorée).
alter table public.ai_tools enable row level security;
alter table public.ai_tool_aliases enable row level security;
alter table public.ai_tool_facts enable row level security;
alter table public.ai_tool_research_runs enable row level security;
create policy "outils: lecture" on public.ai_tools for select using (true);
create policy "alias: lecture" on public.ai_tool_aliases for select using (true);
create policy "faits: lecture" on public.ai_tool_facts for select using (true);
-- ai_tool_research_runs : aucune politique = inaccessible depuis le navigateur.
