-- Nostra Group · Casino V164.9
-- Correctif ciblé : visibilité publique fiable et indépendante
-- À exécuter dans Supabase > SQL Editor.

begin;

-- Garantit que la ligne de réglages existe.
insert into public.casino_settings (id, public_enabled)
values (1, false)
on conflict (id) do nothing;

create or replace function public.casino_set_public_visibility_v1649(
  p_public_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_nostra_manager() then
    raise exception 'forbidden';
  end if;

  update public.casino_settings
  set public_enabled = coalesce(p_public_enabled, false),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  if not found then
    raise exception 'casino_settings_missing';
  end if;

  return true;
end;
$$;

revoke all on function public.casino_set_public_visibility_v1649(boolean)
from public, anon;

grant execute on function public.casino_set_public_visibility_v1649(boolean)
to authenticated;

notify pgrst, 'reload schema';

commit;

-- Vérification après installation :
-- select id, public_enabled, name
-- from public.casino_settings
-- where id = 1;
