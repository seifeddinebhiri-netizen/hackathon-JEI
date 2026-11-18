-- 0003 : stockage optionnel du scénario (« Garder mon scénario », désactivé par défaut)
-- Bucket privé ; chemin attendu : <user_id>/<project_id>/<fichier>.
-- La suppression d'un projet NE supprime PAS les fichiers du bucket : le backend doit les effacer
-- (à faire avec la route d'envoi du scénario).

insert into storage.buckets (id, name, public)
values ('scripts', 'scripts', false)
on conflict (id) do nothing;

create policy "scripts: lecture propriétaire" on storage.objects for select
  using (bucket_id = 'scripts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "scripts: envoi propriétaire" on storage.objects for insert
  with check (bucket_id = 'scripts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "scripts: suppression propriétaire" on storage.objects for delete
  using (bucket_id = 'scripts' and (storage.foldername(name))[1] = auth.uid()::text);
