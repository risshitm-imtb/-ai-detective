-- Migration: Skip Round control, updated default durations, and qualification logic for skipped rounds

-- 1. Update rounds status constraint to include 'skipped'
alter table public.rounds drop constraint if exists rounds_status_check;
alter table public.rounds add constraint rounds_status_check check (status in ('locked','active','paused','closed','revealed','skipped'));

-- 2. Update default durations: Rounds 1, 2, 3 default to 600s (10m), Round 4 to 900s (15m)
update public.rounds set duration_seconds = 600 where id in (1, 2, 3) and status = 'locked';
update public.rounds set duration_seconds = 900 where id = 4 and status = 'locked';

-- 3. skip_round RPC: Allows organizer to skip any unstarted or active round
create or replace function public.skip_round(p_round smallint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_now timestamptz := clock_timestamp();
  v_status text;
  v_round_status text;
  v_next_round smallint;
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  select status into v_status from public.event_config where singleton;
  if p_round not between 1 and 4 then raise exception 'invalid round number'; end if;

  select status into v_round_status from public.rounds where id = p_round for update;
  if v_round_status in ('revealed', 'skipped') then
    raise exception 'round is already finalized or skipped';
  end if;

  -- Mark target round as skipped
  update public.rounds set
    status = 'skipped',
    closed_at = coalesce(closed_at, v_now),
    paused_remaining_seconds = null
  where id = p_round;

  -- Find next round that is not skipped
  select min(id) into v_next_round from public.rounds where id > p_round and status <> 'skipped';

  -- If in registration and round 1 skipped, advance current_round pointer
  if v_status = 'registration' then
    update public.event_config set
      current_round = coalesce(v_next_round, p_round),
      updated_at = v_now
    where singleton;
  else
    -- In active event, update current_round to the next available round (or keep at p_round if ending)
    update public.event_config set
      current_round = coalesce(v_next_round, p_round),
      updated_at = v_now
    where singleton;
  end if;

  insert into public.audit_log(actor, action, detail)
    values(auth.uid(), 'round_skipped', jsonb_build_object('round', p_round, 'next_round', v_next_round, 'at', v_now));

  return jsonb_build_object('skipped_round', p_round, 'next_round', v_next_round);
end $$;

revoke all on function public.skip_round(smallint) from public, anon;
grant execute on function public.skip_round(smallint) to authenticated;

-- 4. Update start_next_round_with_duration to support skipped previous rounds
create or replace function public.start_next_round_with_duration(p_round smallint, p_seconds integer)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_prior_round smallint;
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  if p_round not between 2 and 4 then raise exception 'invalid next round'; end if;

  -- Find the most recent non-skipped prior round
  select max(id) into v_prior_round from public.rounds where id < p_round and status <> 'skipped';

  if v_prior_round is not null then
    if (select status from public.rounds where id = v_prior_round) <> 'revealed' then
      raise exception 'previous results from round % are not finalized', v_prior_round;
    end if;
    select count(*) into v_count from public.qualifications where round_id = v_prior_round and qualified;
    if v_count = 0 then raise exception 'no teams qualified in round %; explicit event review required', v_prior_round; end if;
  end if;

  if exists(select 1 from public.rounds where id = p_round and status <> 'locked') then
    raise exception 'round % already started or skipped', p_round;
  end if;
  if p_seconds not between 60 and 1800 then raise exception 'Duration must be 60 to 1800 seconds'; end if;

  -- Update duration before starting
  update public.rounds set duration_seconds = p_seconds where id = p_round;

  update public.event_config set current_round = p_round, updated_at = v_now where singleton;
  update public.rounds set status = 'active', starts_at = v_now,
    deadline_at = v_now + make_interval(secs => p_seconds) where id = p_round;

  insert into public.audit_log(actor, action, detail)
    values(auth.uid(), 'round_started', jsonb_build_object('round', p_round, 'duration_seconds', p_seconds, 'at', v_now));

  return v_now;
end $$;

-- Also update standard start_next_round
create or replace function public.start_next_round(p_round smallint)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_duration integer;
begin
  select duration_seconds into v_duration from public.rounds where id = p_round;
  return public.start_next_round_with_duration(p_round, coalesce(v_duration, 600));
end $$;

-- 5. Update end_event to permit completion when rounds are skipped
create or replace function public.end_event()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_last_conducted_round smallint;
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;

  -- Find highest round that was conducted (revealed)
  select max(id) into v_last_conducted_round from public.rounds where status = 'revealed';

  -- Verify all subsequent rounds up to 4 are either skipped or target round 4 is revealed
  if exists(select 1 from public.rounds where id > coalesce(v_last_conducted_round, 0) and status not in ('skipped', 'locked')) then
    raise exception 'all rounds must be finalized or skipped before ending event';
  end if;

  update public.event_config set
    status = 'completed',
    event_ended_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where singleton and status = 'active';

  if not found then raise exception 'event is not currently active'; end if;
  insert into public.audit_log(actor, action) values(auth.uid(), 'event_ended');
end $$;

-- 6. Update participant_get_state for qualification checking with skipped rounds
create or replace function public.participant_get_state(p_session_hash text)
returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_team_id uuid;
  v_round smallint;
  v_qualified boolean;
  v_prior_round smallint;
  v_event jsonb;
  v_results_published boolean;
begin
  select team_id into v_team_id from public.participant_sessions
   where token_hash = p_session_hash and expires_at > clock_timestamp();
  if v_team_id is null then raise exception 'Participant session expired or invalid.' using errcode='42501'; end if;

  -- Auto-close expired active rounds
  select current_round into v_round from public.event_config where singleton;
  if v_round is not null and exists(select 1 from public.rounds where id = v_round and status = 'active' and deadline_at <= clock_timestamp()) then
    perform 1 from public.event_config where singleton for update;
    select current_round into v_round from public.event_config where singleton;
    if v_round is not null and exists(select 1 from public.rounds where id = v_round and status = 'active' and deadline_at <= clock_timestamp()) then
      update public.rounds set status = 'closed', closed_at = clock_timestamp() where id = v_round and status = 'active';
      perform public.finalize_round(v_round);
    end if;
  end if;

  select jsonb_build_object('server_now', clock_timestamp(),
    'event', (select to_jsonb(e) - 'singleton' from public.event_config e where singleton),
    'rounds', coalesce((select jsonb_agg(to_jsonb(r) order by id) from public.rounds r), '[]'::jsonb))
    into v_event;

  select current_round into v_round from public.event_config where singleton;

  -- Find most recent non-skipped prior round to verify qualification
  select max(id) into v_prior_round from public.rounds where id < coalesce(v_round, 1) and status <> 'skipped';

  if v_prior_round is null then
    v_qualified := true; -- If no prior round was conducted, team qualifies automatically
  else
    select qualified into v_qualified from public.qualifications where team_id = v_team_id and round_id = v_prior_round;
  end if;

  select final_results_published into v_results_published from public.event_config where singleton;

  return v_event || jsonb_build_object(
    'team', (select jsonb_build_object('id', t.id, 'name', t.name, 'lead_name', t.lead_name, 'usn', t.usn) from public.teams t where t.id = v_team_id),
    'team_role', 'captain',
    'qualifications', coalesce((select jsonb_agg(to_jsonb(q) order by q.round_id) from public.qualifications q where q.team_id = v_team_id), '[]'::jsonb),
    'scores', coalesce((select jsonb_agg(to_jsonb(s) order by s.round_id) from public.scores s where s.team_id = v_team_id), '[]'::jsonb),
    'submissions', coalesce((select jsonb_agg(to_jsonb(s) - 'team_id' - 'submitted_by' - 'idempotency_key' order by s.received_at) from public.submissions s where s.team_id = v_team_id), '[]'::jsonb),
    'challenges', case when v_round is not null and (v_prior_round is null or coalesce(v_qualified, false))
       and exists(select 1 from public.rounds r where r.id = v_round and r.status in ('active', 'closed', 'revealed'))
       then coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'round_id', c.round_id, 'content', c.content, 'sort_order', c.sort_order) order by c.sort_order)
          from public.challenges c where c.round_id = v_round and c.published), '[]'::jsonb) else '[]'::jsonb end,
    'debrief', case when v_round is not null and exists(select 1 from public.scores where team_id = v_team_id and round_id = v_round)
       and exists(select 1 from public.rounds where id = v_round and status = 'revealed')
       then coalesce((select jsonb_agg(jsonb_build_object('challenge_id', c.id, 'answer', k.answer, 'explanation', k.explanation, 'verification_notes', k.verification_notes) order by c.sort_order)
          from public.challenges c join public.challenge_keys k on k.challenge_id = c.id where c.round_id = v_round and c.published), '[]'::jsonb) else '[]'::jsonb end,
    'round_winner', case when v_round is not null and exists(select 1 from public.rounds where id = v_round and status = 'revealed') then
       (select jsonb_build_object('team_name', t.name, 'points', s.points)
        from public.scores s join public.teams t on t.id = s.team_id
        where s.round_id = v_round order by s.points desc, t.created_at asc limit 1)
       else null end,
    'final_results_published', coalesce(v_results_published, false),
    'leaderboard', case when (select status from public.event_config where singleton) = 'completed'
       and coalesce(v_results_published, false) = true
       then coalesce((select jsonb_agg(to_jsonb(l) order by l.rank) from public.get_participant_leaderboard() l), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;

grant execute on function public.participant_get_state(text) to service_role;
