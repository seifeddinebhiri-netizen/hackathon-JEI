-- 0001 : profils utilisateurs
-- À coller dans Supabase > SQL Editor, dans l'ordre (0001, 0002, 0003).
--
-- Les comptes eux-mêmes sont gérés par Supabase Auth (table auth.users).
-- CONFIRMATION PAR EMAIL : ce n'est PAS réglable en SQL. Désactivez-la dans le tableau de bord :
--   Authentication > Sign In / Providers > Email > « Confirm email » = désactivé.
-- (Acceptable pour le hackathon ; à réactiver en production.)

create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text not null default '',
  is_demo             boolean not null default false,
  current_project_id  uuid,  -- clé étrangère ajoutée en 0002
  locale              text not null default 'fr',
  terms_accepted_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Création automatique du profil à l'inscription
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sécurité par ligne : chacun ne lit et ne modifie que son profil.
-- (Pas de policy insert/delete : l'insertion passe par le trigger, la suppression par le compte.)
alter table public.profiles enable row level security;
create policy "profil: lecture"      on public.profiles for select using (id = auth.uid());
create policy "profil: modification" on public.profiles for update using (id = auth.uid());
