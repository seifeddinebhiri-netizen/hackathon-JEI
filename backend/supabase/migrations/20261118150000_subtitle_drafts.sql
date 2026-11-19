-- Kit Festival : brouillons de sous-titres (un par projet).
-- Contient le texte des répliques : accès serveur uniquement (clé service role / DATABASE_URL).
-- RLS activée SANS aucune policy : anon et authenticated n'ont aucun accès direct.
-- L'audio n'est jamais stocké, ni ici ni ailleurs.

create table if not exists public.subtitle_drafts (
  project_id  text primary key,
  source_lang text not null default 'derja',
  lines       jsonb not null default '[]'::jsonb
    check (jsonb_typeof(lines) = 'array'),
  processing  jsonb,                                  -- outils utilisés (Passeport IA)
  updated_at  timestamptz not null default now()
);

alter table public.subtitle_drafts enable row level security;
