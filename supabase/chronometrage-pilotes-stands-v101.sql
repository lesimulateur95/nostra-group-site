-- Nostra Group - Chronométrage pilotes / arrêts stand V101
-- À exécuter une seule fois dans Supabase > SQL Editor.

alter table public.race_control_entries
  add column if not exists pit_started_at timestamptz,
  add column if not exists pit_stop_count integer not null default 0,
  add column if not exists last_pit_duration_ms bigint,
  add column if not exists total_pit_duration_ms bigint not null default 0;

alter table public.race_control_entries
  drop constraint if exists race_control_entries_status_check;

alter table public.race_control_entries
  add constraint race_control_entries_status_check
  check (status in ('ready', 'running', 'finished', 'stopped', 'dnf'))
  not valid;

alter table public.race_control_entries
  validate constraint race_control_entries_status_check;

alter table public.race_control_entries
  drop constraint if exists race_control_entries_pit_stop_count_check;

alter table public.race_control_entries
  add constraint race_control_entries_pit_stop_count_check
  check (pit_stop_count >= 0)
  not valid;

alter table public.race_control_entries
  validate constraint race_control_entries_pit_stop_count_check;

alter table public.race_control_entries
  drop constraint if exists race_control_entries_pit_duration_check;

alter table public.race_control_entries
  add constraint race_control_entries_pit_duration_check
  check (
    coalesce(last_pit_duration_ms, 0) >= 0
    and total_pit_duration_ms >= 0
  )
  not valid;

alter table public.race_control_entries
  validate constraint race_control_entries_pit_duration_check;

create or replace function public.nostra_race_recalculate_event(
  p_event_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active integer;
begin
  update public.race_control_entries entry
  set
    best_lap_ms = lap_stats.best_lap_ms,
    updated_at = now()
  from (
    select
      lap.entry_id,
      min(lap.lap_time_ms)::bigint as best_lap_ms
    from public.race_control_laps lap
    where lap.event_id = p_event_id
    group by lap.entry_id
  ) lap_stats
  where entry.id = lap_stats.entry_id;

  with ranked as (
    select
      entry.id,
      row_number() over (
        order by
          case entry.status
            when 'finished' then 0
            when 'stopped' then 1
            else 2
          end,
          case
            when entry.status = 'finished'
              then entry.total_time_ms
            else null
          end asc nulls last,
          case
            when entry.status in ('stopped', 'dnf')
              then entry.lap_count
            else null
          end desc nulls last,
          case
            when entry.status in ('stopped', 'dnf')
              then entry.total_time_ms
            else null
          end asc nulls last,
          entry.finished_at asc nulls last,
          entry.grid_position
      )::integer as calculated_position
    from public.race_control_entries entry
    where entry.event_id = p_event_id
      and entry.status in ('finished', 'stopped', 'dnf')
  )
  update public.race_control_entries entry
  set
    position = ranked.calculated_position,
    updated_at = now()
  from ranked
  where entry.id = ranked.id;

  select count(*)::integer
    into v_active
  from public.race_control_entries entry
  where entry.event_id = p_event_id
    and entry.status in ('ready', 'running');

  if v_active = 0 then
    update public.race_control_events
    set
      status = case
        when status = 'published' then 'published'
        else 'finished'
      end,
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
    where id = p_event_id;
  end if;
end;
$$;

create or replace function public.nostra_toggle_race_control_pit_stop(
  p_entry_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.race_control_entries%rowtype;
  v_event public.race_control_events%rowtype;
  v_now timestamptz := clock_timestamp();
  v_duration_ms bigint;
begin
  if not public.nostra_race_is_commissioner() then
    raise exception 'commissioner_required';
  end if;

  select entry.*
    into v_entry
  from public.race_control_entries entry
  where entry.id = p_entry_id
  for update;

  if v_entry.id is null or v_entry.status <> 'running' then
    raise exception 'invalid_entry_status';
  end if;

  select event.*
    into v_event
  from public.race_control_events event
  where event.id = v_entry.event_id
  for update;

  if v_event.status <> 'running' then
    raise exception 'invalid_event_status';
  end if;

  if v_entry.pit_started_at is null then
    update public.race_control_entries
    set
      pit_started_at = v_now,
      pit_stop_count = pit_stop_count + 1,
      updated_at = v_now
    where id = v_entry.id;
  else
    v_duration_ms := greatest(
      0,
      floor(extract(epoch from (v_now - v_entry.pit_started_at)) * 1000)::bigint
    );

    update public.race_control_entries
    set
      pit_started_at = null,
      last_pit_duration_ms = v_duration_ms,
      total_pit_duration_ms = total_pit_duration_ms + v_duration_ms,
      updated_at = v_now
    where id = v_entry.id;
  end if;

  return v_event.id;
end;
$$;

create or replace function public.nostra_stop_race_control_entry(
  p_entry_id bigint,
  p_elapsed_ms bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.race_control_entries%rowtype;
  v_event public.race_control_events%rowtype;
  v_stopped_at timestamptz;
  v_total_time_ms bigint;
  v_pit_duration_ms bigint := 0;
begin
  if not public.nostra_race_is_commissioner() then
    raise exception 'commissioner_required';
  end if;

  select entry.*
    into v_entry
  from public.race_control_entries entry
  where entry.id = p_entry_id
  for update;

  if v_entry.id is null or v_entry.status <> 'running' then
    raise exception 'invalid_entry_status';
  end if;

  select event.*
    into v_event
  from public.race_control_events event
  where event.id = v_entry.event_id
  for update;

  if v_event.status <> 'running' then
    raise exception 'invalid_event_status';
  end if;

  v_stopped_at := public.nostra_race_crossing_time(
    v_event.started_at,
    p_elapsed_ms
  );

  v_total_time_ms := floor(
    extract(epoch from (v_stopped_at - v_event.started_at)) * 1000
  )::bigint;

  if v_entry.pit_started_at is not null then
    v_pit_duration_ms := greatest(
      0,
      floor(
        extract(epoch from (v_stopped_at - v_entry.pit_started_at)) * 1000
      )::bigint
    );
  end if;

  update public.race_control_entries
  set
    status = 'stopped',
    pit_started_at = null,
    last_pit_duration_ms = case
      when v_entry.pit_started_at is null then last_pit_duration_ms
      else v_pit_duration_ms
    end,
    total_pit_duration_ms = total_pit_duration_ms + v_pit_duration_ms,
    finished_at = v_stopped_at,
    total_time_ms = v_total_time_ms,
    updated_at = clock_timestamp()
  where id = v_entry.id;

  perform public.nostra_race_recalculate_event(v_event.id);

  return v_event.id;
end;
$$;

create or replace function public.nostra_finish_race_control_entry(
  p_entry_id bigint,
  p_elapsed_ms bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.race_control_entries%rowtype;
  v_event public.race_control_events%rowtype;
  v_crossing_at timestamptz;
  v_lap_time_ms bigint;
  v_lap_number integer;
  v_total_time_ms bigint;
  v_pit_duration_ms bigint := 0;
begin
  if not public.nostra_race_is_commissioner() then
    raise exception 'commissioner_required';
  end if;

  select entry.*
    into v_entry
  from public.race_control_entries entry
  where entry.id = p_entry_id
  for update;

  if v_entry.id is null or v_entry.status <> 'running' then
    raise exception 'invalid_entry_status';
  end if;

  select event.*
    into v_event
  from public.race_control_events event
  where event.id = v_entry.event_id
  for update;

  if v_event.status <> 'running' then
    raise exception 'invalid_event_status';
  end if;

  if v_entry.lap_count < v_event.target_laps - 1 then
    raise exception 'laps_remaining';
  end if;

  if v_entry.lap_count = v_event.target_laps - 1 then
    v_crossing_at := public.nostra_race_crossing_time(
      v_event.started_at,
      p_elapsed_ms
    );

    v_lap_time_ms := floor(
      extract(
        epoch from (
          v_crossing_at
          - coalesce(v_entry.last_crossing_at, v_event.started_at)
        )
      ) * 1000
    )::bigint;

    if v_lap_time_ms < 500 then
      raise exception 'duplicate_crossing';
    end if;

    v_lap_number := v_entry.lap_count + 1;

    insert into public.race_control_laps (
      event_id,
      entry_id,
      lap_number,
      lap_time_ms,
      crossed_at,
      recorded_by
    )
    values (
      v_event.id,
      v_entry.id,
      v_lap_number,
      v_lap_time_ms,
      v_crossing_at,
      auth.uid()
    );
  else
    v_crossing_at := coalesce(
      v_entry.last_crossing_at,
      public.nostra_race_crossing_time(
        v_event.started_at,
        p_elapsed_ms
      )
    );

    v_lap_number := v_entry.lap_count;
  end if;

  v_total_time_ms := floor(
    extract(epoch from (v_crossing_at - v_event.started_at)) * 1000
  )::bigint;

  if v_entry.pit_started_at is not null then
    v_pit_duration_ms := greatest(
      0,
      floor(
        extract(epoch from (v_crossing_at - v_entry.pit_started_at)) * 1000
      )::bigint
    );
  end if;

  update public.race_control_entries
  set
    status = 'finished',
    lap_count = v_lap_number,
    last_crossing_at = v_crossing_at,
    pit_started_at = null,
    last_pit_duration_ms = case
      when v_entry.pit_started_at is null then last_pit_duration_ms
      else v_pit_duration_ms
    end,
    total_pit_duration_ms = total_pit_duration_ms + v_pit_duration_ms,
    finished_at = v_crossing_at,
    total_time_ms = v_total_time_ms,
    best_lap_ms = (
      select min(lap.lap_time_ms)::bigint
      from public.race_control_laps lap
      where lap.entry_id = v_entry.id
    ),
    updated_at = clock_timestamp()
  where id = v_entry.id;

  perform public.nostra_race_recalculate_event(v_event.id);

  return v_event.id;
end;
$$;

create or replace function public.nostra_mark_race_control_entry_dnf(
  p_entry_id bigint,
  p_elapsed_ms bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.race_control_entries%rowtype;
  v_event public.race_control_events%rowtype;
  v_finished_at timestamptz;
  v_pit_duration_ms bigint := 0;
begin
  if not public.nostra_race_is_commissioner() then
    raise exception 'commissioner_required';
  end if;

  select entry.*
    into v_entry
  from public.race_control_entries entry
  where entry.id = p_entry_id
  for update;

  if v_entry.id is null
    or v_entry.status not in ('ready', 'running')
  then
    raise exception 'invalid_entry_status';
  end if;

  select event.*
    into v_event
  from public.race_control_events event
  where event.id = v_entry.event_id
  for update;

  if v_event.status not in ('ready', 'running') then
    raise exception 'invalid_event_status';
  end if;

  v_finished_at := case
    when v_event.started_at is null then clock_timestamp()
    else public.nostra_race_crossing_time(
      v_event.started_at,
      p_elapsed_ms
    )
  end;

  if v_entry.pit_started_at is not null then
    v_pit_duration_ms := greatest(
      0,
      floor(
        extract(epoch from (v_finished_at - v_entry.pit_started_at)) * 1000
      )::bigint
    );
  end if;

  update public.race_control_entries
  set
    status = 'dnf',
    pit_started_at = null,
    last_pit_duration_ms = case
      when v_entry.pit_started_at is null then last_pit_duration_ms
      else v_pit_duration_ms
    end,
    total_pit_duration_ms = total_pit_duration_ms + v_pit_duration_ms,
    finished_at = v_finished_at,
    total_time_ms = case
      when v_event.started_at is null then null
      else floor(
        extract(epoch from (v_finished_at - v_event.started_at)) * 1000
      )::bigint
    end,
    updated_at = clock_timestamp()
  where id = v_entry.id;

  perform public.nostra_race_recalculate_event(v_event.id);

  return v_event.id;
end;
$$;

create or replace function public.nostra_stop_race_control_event(
  p_event_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if not public.nostra_race_is_commissioner() then
    raise exception 'commissioner_required';
  end if;

  if not exists (
    select 1
    from public.race_control_events event
    where event.id = p_event_id
      and event.status in ('ready', 'running')
  ) then
    raise exception 'invalid_event_status';
  end if;

  update public.race_control_entries entry
  set
    status = 'dnf',
    last_pit_duration_ms = case
      when entry.pit_started_at is null then entry.last_pit_duration_ms
      else greatest(
        0,
        floor(extract(epoch from (v_now - entry.pit_started_at)) * 1000)::bigint
      )
    end,
    total_pit_duration_ms = entry.total_pit_duration_ms + case
      when entry.pit_started_at is null then 0
      else greatest(
        0,
        floor(extract(epoch from (v_now - entry.pit_started_at)) * 1000)::bigint
      )
    end,
    pit_started_at = null,
    finished_at = v_now,
    total_time_ms = case
      when event.started_at is null then null
      else floor(extract(epoch from (v_now - event.started_at)) * 1000)::bigint
    end,
    updated_at = v_now
  from public.race_control_events event
  where entry.event_id = p_event_id
    and event.id = p_event_id
    and entry.status in ('ready', 'running');

  update public.race_control_events
  set
    status = 'finished',
    completed_at = v_now,
    updated_at = v_now
  where id = p_event_id;

  perform public.nostra_race_recalculate_event(p_event_id);
end;
$$;

create or replace function public.nostra_get_race_control_dashboard_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.nostra_race_is_commissioner() then
    raise exception 'commissioner_required';
  end if;

  return jsonb_build_object(
    'configured', true,
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', event.id,
          'title', event.title,
          'competition_type', event.competition_type,
          'target_laps', event.target_laps,
          'status', event.status,
          'started_at', event.started_at,
          'completed_at', event.completed_at,
          'published_at', event.published_at,
          'created_at', event.created_at,
          'participant_count', (
            select count(*)::integer
            from public.race_control_entries entry
            where entry.event_id = event.id
          ),
          'active_count', (
            select count(*)::integer
            from public.race_control_entries entry
            where entry.event_id = event.id
              and entry.status in ('ready', 'running')
          ),
          'finished_count', (
            select count(*)::integer
            from public.race_control_entries entry
            where entry.event_id = event.id
              and entry.status in ('finished', 'stopped', 'dnf')
          )
        )
        order by
          case event.status
            when 'running' then 0
            when 'ready' then 1
            when 'finished' then 2
            when 'published' then 3
            else 4
          end,
          event.created_at desc
      )
      from (
        select *
        from public.race_control_events
        order by created_at desc
        limit 30
      ) event
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.nostra_get_race_control_event_state(
  p_event_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.race_control_events%rowtype;
begin
  if not public.nostra_race_is_commissioner() then
    raise exception 'commissioner_required';
  end if;

  select *
    into v_event
  from public.race_control_events
  where id = p_event_id;

  if v_event.id is null then
    return jsonb_build_object(
      'configured', true,
      'server_now', clock_timestamp(),
      'event', null,
      'entries', '[]'::jsonb,
      'best_lap', null
    );
  end if;

  return jsonb_build_object(
    'configured', true,
    'server_now', clock_timestamp(),
    'event', jsonb_build_object(
      'id', v_event.id,
      'title', v_event.title,
      'competition_type', v_event.competition_type,
      'target_laps', v_event.target_laps,
      'status', v_event.status,
      'started_at', v_event.started_at,
      'completed_at', v_event.completed_at,
      'published_at', v_event.published_at,
      'created_at', v_event.created_at
    ),
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', entry.id,
          'driver_name', entry.driver_name,
          'team_name', entry.team_name,
          'grid_position', entry.grid_position,
          'status', entry.status,
          'lap_count', entry.lap_count,
          'last_crossing_at', entry.last_crossing_at,
          'finished_at', entry.finished_at,
          'total_time_ms', entry.total_time_ms,
          'pit_started_at', entry.pit_started_at,
          'pit_stop_count', entry.pit_stop_count,
          'last_pit_duration_ms', entry.last_pit_duration_ms,
          'total_pit_duration_ms', entry.total_pit_duration_ms,
          'best_lap_ms', entry.best_lap_ms,
          'last_lap_ms', (
            select lap.lap_time_ms
            from public.race_control_laps lap
            where lap.entry_id = entry.id
            order by lap.lap_number desc
            limit 1
          ),
          'position', entry.position,
          'championship_points', entry.championship_points,
          'laps', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', lap.id,
                'lap_number', lap.lap_number,
                'lap_time_ms', lap.lap_time_ms,
                'crossed_at', lap.crossed_at
              )
              order by lap.lap_number
            )
            from public.race_control_laps lap
            where lap.entry_id = entry.id
          ), '[]'::jsonb)
        )
        order by
          coalesce(entry.position, entry.grid_position),
          entry.grid_position
      )
      from public.race_control_entries entry
      where entry.event_id = v_event.id
    ), '[]'::jsonb),
    'best_lap', (
      select jsonb_build_object(
        'entry_id', entry.id,
        'driver_name', entry.driver_name,
        'team_name', entry.team_name,
        'lap_number', lap.lap_number,
        'lap_time_ms', lap.lap_time_ms
      )
      from public.race_control_laps lap
      join public.race_control_entries entry
        on entry.id = lap.entry_id
      where lap.event_id = v_event.id
      order by lap.lap_time_ms, lap.crossed_at
      limit 1
    )
  );
end;
$$;

revoke all on function public.nostra_toggle_race_control_pit_stop(bigint)
from public;

revoke all on function public.nostra_stop_race_control_entry(bigint, bigint)
from public;

grant execute on function public.nostra_toggle_race_control_pit_stop(bigint)
to authenticated;

grant execute on function public.nostra_stop_race_control_entry(bigint, bigint)
to authenticated;

notify pgrst, 'reload schema';
