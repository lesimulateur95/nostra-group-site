-- NOSTRA V163.2 — Numérotation propre des formules Nostra Care
-- À exécuter une seule fois après V163 / V163.1.
-- Réexécutable sans supprimer les contrats clients.
--
-- Objectifs :
-- 1) Les formules visibles sont toujours numérotées 1, 2, 3... sans trou.
-- 2) Après suppression d'une formule, les restantes sont automatiquement renumérotées.
-- 3) Si TOUTES les formules sont supprimées, l'identité SQL repart à 1 pour la prochaine création.
-- 4) Les contrats clients et leurs plan_id ne sont jamais renumérotés/modifiés par ce script.

begin;

-- Numéro d'affichage indépendant de l'ID technique.
alter table public.motors_warranty_plans_v163
  add column if not exists display_number integer;

-- Fonction qui compacte les numéros visibles en 1..N.
create or replace function public.nostra_resequence_warranty_plans_v1632()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with ranked as (
    select
      id,
      row_number() over (
        order by created_at asc nulls last, id asc
      )::integer as new_number
    from public.motors_warranty_plans_v163
  )
  update public.motors_warranty_plans_v163 p
  set display_number = r.new_number
  from ranked r
  where p.id = r.id
    and p.display_number is distinct from r.new_number;
end;
$$;

-- Trigger : renumérotation après création/suppression.
create or replace function public.nostra_warranty_plan_numbering_trigger_v1632()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sequence text;
begin
  perform public.nostra_resequence_warranty_plans_v1632();

  -- Si la table est vide après une suppression, la prochaine vraie ID repart à 1.
  if TG_OP = 'DELETE'
     and not exists (select 1 from public.motors_warranty_plans_v163) then
    v_sequence := pg_get_serial_sequence(
      'public.motors_warranty_plans_v163',
      'id'
    );

    if v_sequence is not null then
      execute format('select setval(%L::regclass, 1, false)', v_sequence);
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists motors_warranty_plans_numbering_v1632
  on public.motors_warranty_plans_v163;

create trigger motors_warranty_plans_numbering_v1632
after insert or delete
on public.motors_warranty_plans_v163
for each statement
execute function public.nostra_warranty_plan_numbering_trigger_v1632();

-- Renumérote immédiatement les formules déjà existantes (ex. IDs 5/6/7/8 -> affichage 1/2/3/4).
select public.nostra_resequence_warranty_plans_v1632();

-- Si aucune formule n'existe au moment où ce SQL est exécuté, on remet aussi l'identity à 1 immédiatement.
do $$
declare
  v_sequence text;
begin
  if not exists (select 1 from public.motors_warranty_plans_v163) then
    v_sequence := pg_get_serial_sequence(
      'public.motors_warranty_plans_v163',
      'id'
    );

    if v_sequence is not null then
      execute format('select setval(%L::regclass, 1, false)', v_sequence);
    end if;
  end if;
end;
$$;

commit;

-- Vérification : les numéros visibles doivent être 1,2,3... dans l'ordre.
select id, display_number, name, active
from public.motors_warranty_plans_v163
order by display_number, id;
