-- 0008 : page film publique (/film/<id du projet>)
-- À coller dans Supabase > SQL Editor après 0005. Indépendante de 0006 et 0007. Rejouable.
--
-- Comme verify_badge : `security definer` contourne la RLS, mais la fonction ne renvoie QUE les
-- champs publics d'un dossier de presse. Jamais : owner_id, contacts de l'équipe (people.contact),
-- lieux, planning, déclarations détaillées, synopsis anglais en brouillon.
-- Seuls les films dont la page a été préparée (une ligne dans film_kits) sont visibles.
-- L'identifiant du projet (uuid aléatoire) sert de lien de partage.

create or replace function public.public_film(film_id uuid)
returns table (
  title                text,
  director             text,
  synopsis_short       text,
  synopsis_long        text,
  stills               text[],
  credits              jsonb,
  trailer_url          text,
  passport_badge_code  text
)
language sql stable security definer set search_path = ''
as $$
  with film as (
    select
      pr.id,
      pr.title,
      case when jsonb_typeof(pr.data -> 'people') = 'array' then pr.data -> 'people' else '[]'::jsonb end
        as people,
      fk.synopsis_phrase, fk.synopsis_court, fk.synopsis_long, fk.stills, fk.trailer_url,
      ap.director as passport_director,
      ap.badge_code
    from public.projects pr
    join public.film_kits fk on fk.project_id = pr.id
    left join public.ai_passports ap on ap.project_id = pr.id
    where pr.id = film_id
  )
  select
    f.title,
    coalesce(
      nullif(btrim(f.passport_director), ''),
      (select btrim(x ->> 'name') from jsonb_array_elements(f.people) x
        where x ->> 'role' ilike 'réalisation%' and btrim(coalesce(x ->> 'name', '')) <> ''
        limit 1),
      ''
    ) as director,
    coalesce(nullif(f.synopsis_court, ''), f.synopsis_phrase) as synopsis_short,
    f.synopsis_long,
    f.stills,
    -- Générique : nom + rôle (personnage pour un acteur), dans l'ordre saisi. Pas de contact.
    coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'role',
                  case when x ->> 'kind' = 'acteur'
                       then coalesce(nullif(btrim(x ->> 'character'), ''), 'Rôle')
                       else coalesce(x ->> 'role', '') end,
                  'name', btrim(x ->> 'name'))
                order by t.ord)
         from jsonb_array_elements(f.people) with ordinality as t(x, ord)
         where btrim(coalesce(x ->> 'name', '')) <> ''),
      '[]'::jsonb
    ) as credits,
    nullif(f.trailer_url, '') as trailer_url,
    f.badge_code as passport_badge_code
  from film f;
$$;

revoke all on function public.public_film(uuid) from public;
grant execute on function public.public_film(uuid) to anon, authenticated;
