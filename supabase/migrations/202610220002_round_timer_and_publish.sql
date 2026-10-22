-- Migration: Per-round timer configuration at start time + 2-phase final leaderboard publication
-- Adds: final_results_published flag, start_round_with_duration(), start_event_with_duration(), publish_final_results()
-- Modifies: participant_get_state() to gate leaderboard on final_results_published

-- ── 1. Add final_results_published to event_config ──────────────────────────────
alter table public.event_config
  add column if not exists final_results_published boolean not null default false;

-- ── 2. start_event_with_duration — starts Round 1 with a custom duration ─────────
create or replace function public.start_event_with_duration(p_seconds integer)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare v_now timestamptz := clock_timestamp(); v_status text;
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  select status into v_status from public.event_config where singleton;
  if v_status <> 'registration' then raise exception 'Event has already started'; end if;
  if p_seconds not between 60 and 1800 then raise exception 'Duration must be 60 to 1800 seconds'; end if;

  -- Update round 1 duration before starting
  update public.rounds set duration_seconds = p_seconds where id = 1 and status = 'locked';

  -- Start the event and round 1
  update public.event_config set status='active', current_round=1, updated_at=v_now where singleton;
  update public.rounds set status='active', starts_at=v_now,
    deadline_at=v_now + make_interval(secs => p_seconds) where id=1;

  insert into public.audit_log(actor,action,detail)
    values(auth.uid(),'event_started',jsonb_build_object('round',1,'duration_seconds',p_seconds,'at',v_now));

  return v_now;
end $$;

revoke all on function public.start_event_with_duration(integer) from public,anon;
grant execute on function public.start_event_with_duration(integer) to authenticated;

-- ── 3. start_next_round_with_duration — starts round 2-4 with a custom duration ──
create or replace function public.start_next_round_with_duration(p_round smallint, p_seconds integer)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare v_now timestamptz := clock_timestamp(); v_count integer;
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  if p_round not between 2 and 4 or (select current_round from public.event_config where singleton) <> p_round-1 then
    raise exception 'invalid next round';
  end if;
  if (select status from public.rounds where id=p_round-1) <> 'revealed' then
    raise exception 'previous results are not finalized';
  end if;
  select count(*) into v_count from public.qualifications where round_id=p_round-1 and qualified;
  if v_count=0 then raise exception 'no teams qualified; explicit event review required'; end if;
  if exists(select 1 from public.rounds where id=p_round and status<>'locked') then
    raise exception 'round already started';
  end if;
  if p_seconds not between 60 and 1800 then raise exception 'Duration must be 60 to 1800 seconds'; end if;

  -- Update duration before starting
  update public.rounds set duration_seconds = p_seconds where id = p_round;

  update public.event_config set current_round=p_round, updated_at=v_now where singleton;
  update public.rounds set status='active', starts_at=v_now,
    deadline_at=v_now + make_interval(secs => p_seconds) where id=p_round;

  insert into public.audit_log(actor,action,detail)
    values(auth.uid(),'round_started',jsonb_build_object('round',p_round,'duration_seconds',p_seconds,'at',v_now));

  return v_now;
end $$;

revoke all on function public.start_next_round_with_duration(smallint,integer) from public,anon;
grant execute on function public.start_next_round_with_duration(smallint,integer) to authenticated;

-- ── 4. publish_final_results — 2-phase final leaderboard reveal ───────────────────
create or replace function public.publish_final_results()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  if (select status from public.event_config where singleton) <> 'completed' then
    raise exception 'Event must be completed before publishing final results';
  end if;
  update public.event_config set final_results_published=true, updated_at=clock_timestamp() where singleton;
  insert into public.audit_log(actor,action,detail)
    values(auth.uid(),'final_results_published',jsonb_build_object('at',clock_timestamp()));
end $$;

revoke all on function public.publish_final_results() from public,anon;
grant execute on function public.publish_final_results() to authenticated;

-- ── 5. Patch participant_get_state to gate leaderboard on final_results_published ─
create or replace function public.participant_get_state(p_session_hash text)
returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_team_id uuid;
  v_round smallint;
  v_qualified boolean;
  v_event jsonb;
  v_results_published boolean;
begin
  select team_id into v_team_id from public.participant_sessions
   where token_hash=p_session_hash and expires_at>clock_timestamp();
  if v_team_id is null then raise exception 'Participant session expired or invalid.' using errcode='42501'; end if;

  -- Auto-close expired active rounds
  select current_round into v_round from public.event_config where singleton;
  if v_round is not null and exists(select 1 from public.rounds where id=v_round and status='active' and deadline_at<=clock_timestamp()) then
    perform 1 from public.event_config where singleton for update;
    select current_round into v_round from public.event_config where singleton;
    if v_round is not null and exists(select 1 from public.rounds where id=v_round and status='active' and deadline_at<=clock_timestamp()) then
      update public.rounds set status='closed',closed_at=clock_timestamp() where id=v_round and status='active';
      perform public.finalize_round(v_round);
    end if;
  end if;

  select jsonb_build_object('server_now',clock_timestamp(),
    'event',(select to_jsonb(e)-'singleton' from public.event_config e where singleton),
    'rounds',coalesce((select jsonb_agg(to_jsonb(r) order by id) from public.rounds r),'[]'::jsonb))
    into v_event;
  select current_round into v_round from public.event_config where singleton;
  select qualified into v_qualified from public.qualifications where team_id=v_team_id and round_id=v_round-1;
  select final_results_published into v_results_published from public.event_config where singleton;

  return v_event || jsonb_build_object(
    'team',(select jsonb_build_object('id',t.id,'name',t.name,'lead_name',t.lead_name,'usn',t.usn) from public.teams t where t.id=v_team_id),
    'team_role','captain',
    'qualifications',coalesce((select jsonb_agg(to_jsonb(q) order by q.round_id) from public.qualifications q where q.team_id=v_team_id),'[]'::jsonb),
    'scores',coalesce((select jsonb_agg(to_jsonb(s) order by s.round_id) from public.scores s where s.team_id=v_team_id),'[]'::jsonb),
    'submissions',coalesce((select jsonb_agg(to_jsonb(s)-'team_id'-'submitted_by'-'idempotency_key' order by s.received_at) from public.submissions s where s.team_id=v_team_id),'[]'::jsonb),
    'challenges',case when v_round is not null and (v_round=1 or coalesce(v_qualified,false))
       and exists(select 1 from public.rounds r where r.id=v_round and r.status in ('active','closed','revealed'))
       then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'round_id',c.round_id,'content',c.content,'sort_order',c.sort_order) order by c.sort_order)
          from public.challenges c where c.round_id=v_round and c.published),'[]'::jsonb) else '[]'::jsonb end,
    'debrief',case when v_round is not null and exists(select 1 from public.scores where team_id=v_team_id and round_id=v_round)
       and exists(select 1 from public.rounds where id=v_round and status='revealed')
       then coalesce((select jsonb_agg(jsonb_build_object('challenge_id',c.id,'answer',k.answer,'explanation',k.explanation,'verification_notes',k.verification_notes) order by c.sort_order)
          from public.challenges c join public.challenge_keys k on k.challenge_id=c.id where c.round_id=v_round and c.published),'[]'::jsonb) else '[]'::jsonb end,
    'round_winner',case when v_round is not null and exists(select 1 from public.rounds where id=v_round and status='revealed') then
       (select jsonb_build_object('team_name', t.name, 'points', s.points)
        from public.scores s join public.teams t on t.id=s.team_id
        where s.round_id=v_round order by s.points desc, s.created_at asc limit 1)
       else null end,
    'final_results_published', coalesce(v_results_published, false),
    'leaderboard',case when (select status from public.event_config where singleton)='completed'
       and coalesce(v_results_published,false)=true
       then coalesce((select jsonb_agg(to_jsonb(l) order by l.rank) from public.get_participant_leaderboard() l),'[]'::jsonb) else '[]'::jsonb end
  );
end $$;

-- Ensure correct grants (already exist from prior migration, but safe to re-grant)
grant execute on function public.participant_get_state(text) to service_role;
