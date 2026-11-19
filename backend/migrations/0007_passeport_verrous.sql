-- 0007 : Passeport IA, ce que le navigateur ne peut plus écrire
-- À coller dans Supabase > SQL Editor après 0005. Indépendante de 0006 et 0008. Rejouable.
--
-- 1. `badge_code` est créé par la base (code imprimé sur le badge, ex. EN-DRHM-T1), unique,
--    jamais choisi par le navigateur.
-- 2. `c2pa_signed` n'est modifiable que par le serveur : une vraie signature C2PA (à venir) la
--    posera. La signature de démonstration du front ne l'écrit plus.
-- Le navigateur (clé publique + session) ne peut plus insérer que project_id, film_title,
-- director, declarations, et ne peut plus modifier que film_title, director, declarations.
-- Le backend et scripts/seed_kit_demo.py (connexion directe) ne sont pas concernés.

-- --- 1. Code du badge créé par la base ---------------------------------------------------------
-- Préfixe « EN » = brand.badgePrefix (web/src/app/brand.ts). Alphabet sans 0/O ni 1/I.
-- security definer : vérifie l'unicité sur TOUS les passeports (la RLS cacherait ceux des autres).
create or replace function public.ai_passports_set_badge_code() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  if new.badge_code is not null then
    return new;  -- fourni par une connexion serveur (script de démonstration)
  end if;
  loop
    code := 'EN-'
      || (select string_agg(substr(alphabet, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 4))
      || '-'
      || (select string_agg(substr(alphabet, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 2));
    exit when not exists (select 1 from public.ai_passports p where p.badge_code = code);
  end loop;
  new.badge_code := code;
  return new;
end $$;
revoke all on function public.ai_passports_set_badge_code() from public;

drop trigger if exists ai_passports_badge_code on public.ai_passports;
create trigger ai_passports_badge_code before insert on public.ai_passports
  for each row execute function public.ai_passports_set_badge_code();

-- --- 2. Colonnes écrites par le navigateur --------------------------------------------------------
revoke insert, update on public.ai_passports from anon, authenticated;
grant insert (project_id, film_title, director, declarations) on public.ai_passports to authenticated;
grant update (film_title, director, declarations) on public.ai_passports to authenticated;
-- La lecture (select) et la suppression (delete) restent soumises à la policy « passeport: propriétaire ».
