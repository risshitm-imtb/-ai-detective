-- Migration: Fix qualifications across skipped rounds for participant_submit_answer and adjust_score

create or replace function public.participant_submit_answer(
  p_session_hash text,
  p_challenge uuid,
  p_answer jsonb,
  p_reasoning text,
  p_idempotency uuid
) returns uuid
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_team uuid;
  v_round smallint;
  v_event_round smallint;
  v_status text;
  v_deadline timestamptz;
  v_prev_round smallint;
  v_previous boolean;
  v_submission uuid;
begin
  select team_id into v_team from public.participant_sessions where token_hash=p_session_hash and expires_at>clock_timestamp();
  if v_team is null then raise exception 'Participant session expired or invalid.' using errcode='42501'; end if;
  if p_idempotency is null or length(coalesce(p_reasoning,''))>5000 then raise exception 'Invalid submission.'; end if;
  select round_id into v_round from public.challenges where id=p_challenge and published;
  select current_round into v_event_round from public.event_config where singleton;
  select status,deadline_at into v_status,v_deadline from public.rounds where id=v_round for update;
  if v_round is null or v_round<>v_event_round or v_status<>'active' or clock_timestamp()>v_deadline then
    raise exception 'This round is closed or not active.';
  end if;

  if v_round > 1 then
    select max(id) into v_prev_round from public.rounds where id < v_round and status <> 'skipped';
    if v_prev_round is not null then
      select qualified into v_previous from public.qualifications where team_id=v_team and round_id=v_prev_round;
      if not coalesce(v_previous, false) then
        raise exception 'This team is not qualified for this round.' using errcode='42501';
      end if;
    end if;
  end if;

  insert into public.submissions(team_id,round_id,challenge_id,submitted_by,answer,reasoning,idempotency_key)
    values(v_team,v_round,p_challenge,null,coalesce(p_answer,'null'::jsonb),coalesce(p_reasoning,''),p_idempotency)
    on conflict(team_id,challenge_id) do nothing returning id into v_submission;
  if v_submission is null then
    select id into v_submission from public.submissions where team_id=v_team and challenge_id=p_challenge;
  end if;
  return v_submission;
end $$;

revoke all on function public.participant_submit_answer(text,uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.participant_submit_answer(text,uuid,jsonb,text,uuid) to service_role;

create or replace function public.adjust_score(
  p_team uuid,
  p_round smallint,
  p_points integer,
  p_reason text
) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_max integer;
  v_threshold integer;
  v_prev_round smallint;
  v_previous boolean;
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  if (select status from public.event_config where singleton) not in ('active','completed') then
    raise exception 'event is not active or completed';
  end if;
  if not exists(select 1 from public.rounds where id=p_round and status in ('revealed','skipped')) then
    raise exception 'target round is not finalized or skipped';
  end if;
  select max_points, max_points*qualification_percent/100 into v_max, v_threshold from public.rounds where id=p_round;
  if p_points < 0 or p_points > v_max then
    raise exception 'points must be between 0 and %', v_max;
  end if;
  if length(trim(coalesce(p_reason,''))) < 10 then
    raise exception 'audit reason must be at least 10 characters';
  end if;

  if p_round > 1 then
    select max(id) into v_prev_round from public.rounds where id < p_round and status <> 'skipped';
    if v_prev_round is not null then
      select qualified into v_previous from public.qualifications where team_id=p_team and round_id=v_prev_round;
      if not coalesce(v_previous, false) then
        raise exception 'team did not qualify in previous round';
      end if;
    end if;
  end if;

  insert into public.scores(team_id,round_id,points,evaluated_at)
  values(p_team,p_round,p_points,clock_timestamp())
  on conflict(team_id,round_id) do update set points=excluded.points, evaluated_at=excluded.evaluated_at;

  insert into public.qualifications(team_id,round_id,points,threshold_points,qualified)
  values(p_team,p_round,p_points,v_threshold,p_points>=v_threshold)
  on conflict(team_id,round_id) do update set points=excluded.points, qualified=excluded.qualified;

  insert into public.audit_log(actor,action,detail)
  values(auth.uid(),'score_adjusted',jsonb_build_object(
    'team',p_team,'round',p_round,'points',p_points,'reason',trim(p_reason)
  ));
end $$;

revoke all on function public.adjust_score(uuid,smallint,integer,text) from public;
grant execute on function public.adjust_score(uuid,smallint,integer,text) to authenticated;
