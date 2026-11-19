-- 0006 : durcissement des comptes
-- À coller dans Supabase > SQL Editor après 0005. Rejouable sans erreur.
--
-- 1. Le navigateur (clé publique + session) ne peut plus modifier que ces colonnes de son profil :
--    display_name, locale, terms_accepted_at, current_project_id. `is_demo`, `id` et les dates
--    restent réservés au backend et aux scripts (connexion directe ou clé service role).
-- 2. `current_project_id` doit désigner un projet du même compte.
-- 3. La création du profil à l'inscription ne fait plus échouer l'inscription si le profil existe
--    déjà (compte recréé, script de démonstration).
--
-- Le backend se connecte en direct (rôle postgres) : rien ne change pour lui.

-- --- 1. Colonnes modifiables depuis le navigateur ---------------------------------------------
revoke update on public.profiles from anon, authenticated;
grant update (display_name, locale, terms_accepted_at, current_project_id)
  on public.profiles to authenticated;

-- --- 2. Le projet courant appartient au compte ------------------------------------------------
drop policy if exists "profil: modification" on public.profiles;
create policy "profil: modification" on public.profiles for update
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (
      current_project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = current_project_id and p.owner_id = (select auth.uid())
      )
    )
  );

-- --- 3. Profil créé à l'inscription, sans doublon ---------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- Comptes créés avant le déclencheur : profil manquant ajouté.
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'name', '')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
