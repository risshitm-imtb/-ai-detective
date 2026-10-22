-- Migration: Ensure open progression across rounds when closed early or completed

-- 1. Set qualification_percent default to 0
alter table public.rounds alter column qualification_percent set default 0;
update public.rounds set qualification_percent = 0;

-- 2. Update start_next_round_with_duration so that all participating teams smoothly transition
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
    if v_count = 0 then
      -- Auto-qualify all registered teams if threshold count was 0
      insert into public.qualifications(team_id, round_id, points, threshold_points, qualified)
      select t.id, v_prior_round, coalesce(s.points, 0), 0, true
      from public.teams t
      left join public.scores s on s.team_id = t.id and s.round_id = v_prior_round
      on conflict (team_id, round_id) do update set qualified = true;
    end if;
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

-- 3. Update finalize_round so all participating teams qualify upon round finalization
create or replace function public.finalize_round(p_round smallint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_threshold integer := 0;
  v_teams integer;
  v_passed integer;
begin
  if not public.is_organizer() and not exists(select 1 from public.rounds where id=p_round and status='closed' and deadline_at<=clock_timestamp()) then
    raise exception 'organizer authorization required' using errcode='42501';
  end if;
  if not exists(select 1 from public.rounds where id=p_round and status in ('active','paused','closed')) then
    raise exception 'round is not ready to finalize';
  end if;
  if exists(select 1 from public.submissions s join public.challenges c on c.id=s.challenge_id
            where s.round_id=p_round and c.published and not exists(select 1 from public.challenge_keys k where k.challenge_id=c.id)) then
    raise exception 'published challenge missing answer key';
  end if;

  insert into public.scores(team_id,round_id,points,evaluated_at)
  select t.id, p_round,
    least(r.max_points, coalesce(sum(
      case
        -- Exact JSON match
        when s.answer = k.answer then coalesce((k.scoring->>'points')::int, 1)
        -- Verdict or classification match (case-insensitive)
        when lower(coalesce(s.answer->>'verdict', s.answer->>'classification', '')) = lower(coalesce(k.answer->>'verdict', k.answer->>'classification', ''))
          and coalesce(s.answer->>'verdict', s.answer->>'classification', '') <> ''
          then coalesce((k.scoring->>'points')::int, 1)
        -- Plain string JSON match
        when jsonb_typeof(s.answer) = 'string'
          and lower(s.answer #>> '{}') in (lower(coalesce(k.answer->>'verdict', '')), lower(coalesce(k.answer->>'classification', '')))
          then coalesce((k.scoring->>'points')::int, 1)
        -- Round 4 case report
        when p_round = 4 and s.answer is not null and (s.answer ? 'main_conclusion' or s.answer ? 'case_resolved' or s.answer ? 'primary_conclusion')
          then coalesce((k.scoring->>'points')::int, 30)
        else 0
      end
    ), 0)),
    clock_timestamp()
  from public.teams t
  cross join public.rounds r
  left join public.submissions s on s.team_id=t.id and s.round_id=p_round
  left join public.challenge_keys k on k.challenge_id=s.challenge_id
  where r.id=p_round and (
    p_round=1
    or exists(
      select 1 from public.qualifications q
      where q.team_id=t.id
      and q.round_id = (select max(id) from public.rounds where id < p_round and status <> 'skipped')
      and q.qualified
    )
    or not exists(select 1 from public.rounds where id < p_round and status <> 'skipped')
  )
  group by t.id, r.max_points
  on conflict(team_id,round_id) do update set
    points = excluded.points,
    evaluated_at = excluded.evaluated_at;

  -- Ensure threshold is 0 so all teams advance
  select coalesce(max_points*qualification_percent/100, 0) into v_threshold from public.rounds where id=p_round;

  insert into public.qualifications(team_id,round_id,points,threshold_points,qualified)
  select t.id, p_round, sc.points, v_threshold, true
  from public.teams t join public.scores sc on sc.team_id=t.id and sc.round_id=p_round
  on conflict(team_id,round_id) do update set
    points = excluded.points,
    qualified = true;

  update public.rounds set status='revealed', closed_at=coalesce(closed_at,clock_timestamp()), paused_remaining_seconds=null where id=p_round;
  update public.event_config set status='active', current_round=p_round, updated_at=clock_timestamp() where singleton;
  select count(*), count(*) filter(where qualified) into v_teams, v_passed from public.qualifications where round_id=p_round;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'round_finalized',jsonb_build_object('round',p_round,'teams',v_teams,'qualified',v_passed));
  return jsonb_build_object('round',p_round,'teams',v_teams,'qualified',v_passed,'threshold',v_threshold);
end $$;

-- 4. Update participant_get_state so all registered teams qualify
create or replace function public.participant_get_state(p_session_hash text)
returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_team_id uuid;
  v_round smallint;
  v_qualified boolean := true;
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

  if v_prior_round is not null then
    select coalesce(qualified, true) into v_qualified from public.qualifications where team_id = v_team_id and round_id = v_prior_round;
    if v_qualified is null then v_qualified := true; end if;
  else
    v_qualified := true;
  end if;

  select final_results_published into v_results_published from public.event_config where singleton;

  return v_event || jsonb_build_object(
    'team', (select jsonb_build_object('id', t.id, 'name', t.name, 'lead_name', t.lead_name, 'usn', t.usn) from public.teams t where t.id = v_team_id),
    'team_role', 'captain',
    'qualifications', coalesce((select jsonb_agg(to_jsonb(q) order by q.round_id) from public.qualifications q where q.team_id = v_team_id), '[]'::jsonb),
    'scores', coalesce((select jsonb_agg(to_jsonb(s) order by s.round_id) from public.scores s where s.team_id = v_team_id), '[]'::jsonb),
    'submissions', coalesce((select jsonb_agg(to_jsonb(s) - 'team_id' - 'submitted_by' - 'idempotency_key' order by s.received_at) from public.submissions s where s.team_id = v_team_id), '[]'::jsonb),
    'challenges', case when v_round is not null and (v_prior_round is null or coalesce(v_qualified, true))
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
