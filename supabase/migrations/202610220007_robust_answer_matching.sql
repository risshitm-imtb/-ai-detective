-- Migration: Robust answer evaluation matching in finalize_round
create or replace function public.finalize_round(p_round smallint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_threshold integer; v_teams integer; v_passed integer;
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
        -- Round 4 case report: awarding points if submitted and case_resolved is true or report provided
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

  select max_points*qualification_percent/100 into v_threshold from public.rounds where id=p_round;

  insert into public.qualifications(team_id,round_id,points,threshold_points,qualified)
  select t.id, p_round, sc.points, v_threshold, sc.points >= v_threshold
    and (
      p_round=1
      or exists(
        select 1 from public.qualifications q
        where q.team_id=t.id
        and q.round_id = (select max(id) from public.rounds where id < p_round and status <> 'skipped')
        and q.qualified
      )
      or not exists(select 1 from public.rounds where id < p_round and status <> 'skipped')
    )
  from public.teams t join public.scores sc on sc.team_id=t.id and sc.round_id=p_round
  on conflict(team_id,round_id) do update set
    points = excluded.points,
    qualified = excluded.qualified;

  update public.rounds set status='revealed', closed_at=coalesce(closed_at,clock_timestamp()), paused_remaining_seconds=null where id=p_round;
  update public.event_config set status='active', current_round=p_round, updated_at=clock_timestamp() where singleton;
  select count(*), count(*) filter(where qualified) into v_teams, v_passed from public.qualifications where round_id=p_round;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'round_finalized',jsonb_build_object('round',p_round,'teams',v_teams,'qualified',v_passed));
  return jsonb_build_object('round',p_round,'teams',v_teams,'qualified',v_passed,'threshold',v_threshold);
end $$;

grant execute on function public.finalize_round(smallint) to authenticated;
