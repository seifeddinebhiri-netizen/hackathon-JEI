-- 0011 : une signature ne survit pas à une modification du Passeport
-- Le PDF signé reflète les déclarations AU MOMENT de la signature. Si le film, la réalisation ou les
-- déclarations changent ensuite, `c2pa_signed` repasse à false : il faut signer à nouveau.
-- Poser `c2pa_signed = true` (serveur seulement, voir 0007) ne déclenche pas cette remise à zéro.
-- Rejouable.

create or replace function public.ai_passports_reset_signature() returns trigger
language plpgsql as $$
begin
  if (new.film_title, new.director, new.declarations)
     is distinct from (old.film_title, old.director, old.declarations) then
    new.c2pa_signed := false;
  end if;
  return new;
end $$;

drop trigger if exists ai_passports_reset_signature on public.ai_passports;
create trigger ai_passports_reset_signature before update on public.ai_passports
  for each row execute function public.ai_passports_reset_signature();
