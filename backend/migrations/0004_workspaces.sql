-- 0004 : espaces de travail du Coach (une scène par espace)
-- Chaque espace garde sa configuration : la scène saisie (formulaire), le plan proposé par l'IA,
-- les modifications de l'utilisateur et les étiquettes de mouvement, dans `data`.
-- `id` est créé par l'appareil (uuid) : un espace peut être créé hors ligne puis envoyé.
-- `version` sert à détecter deux appareils qui modifient le même espace (409).

create table public.workspaces (
  id          uuid primary key,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  data        jsonb not null default '{}'::jsonb,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index workspaces_owner_idx on public.workspaces (owner_id, created_at);

create trigger workspaces_touch before update on public.workspaces
  for each row execute function public.touch_updated_at();

-- Le backend se connecte en direct et IGNORE cette sécurité par ligne : il filtre lui-même sur
-- owner_id. Elle protège les accès directs faits avec la clé publique depuis le navigateur.
alter table public.workspaces enable row level security;
create policy "espaces: propriétaire" on public.workspaces for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
