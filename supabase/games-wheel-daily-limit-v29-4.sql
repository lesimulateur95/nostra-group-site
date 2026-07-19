-- NOSTRA GROUP V29.4
-- Limite : un seul tirage par citoyen et par jour.
-- Remise à zéro à 00h00, heure de France (Europe/Paris).
-- Les tirages non utilisés ne se cumulent pas.

alter table public.game_wheel_spins
  add column if not exists draw_date date;

with ranked_existing_spins as (
  select
    id,
    (awarded_at at time zone 'Europe/Paris')::date as local_day,
    row_number() over (
      partition by user_id, (awarded_at at time zone 'Europe/Paris')::date
      order by awarded_at asc, id asc
    ) as daily_rank
  from public.game_wheel_spins
  where draw_date is null
)
update public.game_wheel_spins spins
set draw_date = ranked.local_day
from ranked_existing_spins ranked
where spins.id = ranked.id
  and ranked.daily_rank = 1;

create unique index if not exists game_wheel_spins_one_per_day_idx
  on public.game_wheel_spins(user_id, draw_date)
  where draw_date is not null;

create or replace function public.spin_nostra_wheel()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_player_name text;
  v_slot integer;
  v_prize_key text;
  v_prize_label text;
  v_prize_type text;
  v_status text;
  v_spin_id bigint;
  v_draw_date date := (clock_timestamp() at time zone 'Europe/Paris')::date;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1
    from public.game_wheel_spins
    where user_id = v_user_id
      and draw_date = v_draw_date
  ) then
    raise exception using errcode = 'P0001', message = 'daily_spin_limit';
  end if;

  select nullif(trim(concat_ws(' ', rp_first_name, rp_last_name)), '')
    into v_player_name
  from public.member_profiles
  where user_id = v_user_id;

  if v_player_name is null then
    select nullif(trim(coalesce(discord_name, '')), '')
      into v_player_name
    from public.member_profiles
    where user_id = v_user_id;
  end if;

  v_player_name := coalesce(v_player_name, 'Citoyen Nostra Group');
  v_slot := floor(random() * 23)::integer;

  case v_slot
    when 0 then v_prize_key := 'lost'; v_prize_label := 'Perdu'; v_prize_type := 'loss';
    when 1 then v_prize_key := 'paint'; v_prize_label := 'Peinture offerte'; v_prize_type := 'bonus';
    when 2 then v_prize_key := 'lost'; v_prize_label := 'Perdu'; v_prize_type := 'loss';
    when 3 then v_prize_key := 'discount_5'; v_prize_label := '-5 % sur la prochaine commande'; v_prize_type := 'bonus';
    when 4 then v_prize_key := 'coffee'; v_prize_label := '1 café offert'; v_prize_type := 'bonus';
    when 5 then v_prize_key := 'lost'; v_prize_label := 'Perdu'; v_prize_type := 'loss';
    when 6 then v_prize_key := 'circuit_lap'; v_prize_label := '1 tour de circuit offert'; v_prize_type := 'bonus';
    when 7 then v_prize_key := 'paint'; v_prize_label := 'Peinture offerte'; v_prize_type := 'bonus';
    when 8 then v_prize_key := 'lost'; v_prize_label := 'Perdu'; v_prize_type := 'loss';
    when 9 then v_prize_key := 'circuit_10_laps'; v_prize_label := '10 tours de circuit offerts'; v_prize_type := 'bonus';
    when 10 then v_prize_key := 'discount_5'; v_prize_label := '-5 % sur la prochaine commande'; v_prize_type := 'bonus';
    when 11 then v_prize_key := 'circuit_5_laps'; v_prize_label := '5 tours de circuit offerts'; v_prize_type := 'bonus';
    when 12 then v_prize_key := 'lost'; v_prize_label := 'Perdu'; v_prize_type := 'loss';
    when 13 then v_prize_key := 'silver_card'; v_prize_label := 'Carte fidélité Silver'; v_prize_type := 'bonus';
    when 14 then v_prize_key := 'coffee'; v_prize_label := '1 café offert'; v_prize_type := 'bonus';
    when 15 then v_prize_key := 'discount_5'; v_prize_label := '-5 % sur la prochaine commande'; v_prize_type := 'bonus';
    when 16 then v_prize_key := 'circuit_lap'; v_prize_label := '1 tour de circuit offert'; v_prize_type := 'bonus';
    when 17 then v_prize_key := 'lost'; v_prize_label := 'Perdu'; v_prize_type := 'loss';
    when 18 then v_prize_key := 'vehicle_test'; v_prize_label := 'Essai d’un véhicule de la concession'; v_prize_type := 'bonus';
    when 19 then v_prize_key := 'paint'; v_prize_label := 'Peinture offerte'; v_prize_type := 'bonus';
    when 20 then v_prize_key := 'circuit_5_laps'; v_prize_label := '5 tours de circuit offerts'; v_prize_type := 'bonus';
    when 21 then v_prize_key := 'discount_10k'; v_prize_label := '-10 000 € sur la prochaine commande'; v_prize_type := 'bonus';
    else v_prize_key := 'discount_10k'; v_prize_label := '-10 000 € sur la prochaine commande'; v_prize_type := 'bonus';
  end case;

  v_status := case when v_prize_type = 'loss' then 'lost' else 'unused' end;

  begin
    insert into public.game_wheel_spins (
      user_id,
      player_name,
      slot_index,
      prize_key,
      prize_label,
      prize_type,
      redemption_status,
      draw_date
    ) values (
      v_user_id,
      v_player_name,
      v_slot,
      v_prize_key,
      v_prize_label,
      v_prize_type,
      v_status,
      v_draw_date
    )
    returning id into v_spin_id;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'daily_spin_limit';
  end;

  return jsonb_build_object(
    'id', v_spin_id,
    'slot_index', v_slot,
    'prize_key', v_prize_key,
    'prize_label', v_prize_label,
    'prize_type', v_prize_type,
    'redemption_status', v_status
  );
end;
$$;

revoke all on function public.spin_nostra_wheel() from public;
grant execute on function public.spin_nostra_wheel() to authenticated;

notify pgrst, 'reload schema';
