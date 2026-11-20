-- 0010 : relecture humaine des fiches d'outils (suite de 0009)
-- Rejouable sans risque (`if not exists`) : à exécuter que 0009 soit déjà passée ou non.

alter table public.ai_tools
  add column if not exists reviewed_by text,          -- nom de la personne qui a relu la fiche
  add column if not exists reviewed_at timestamptz;

alter table public.ai_tool_facts
  add column if not exists human_confirmed boolean not null default false; -- une personne a relu la source
