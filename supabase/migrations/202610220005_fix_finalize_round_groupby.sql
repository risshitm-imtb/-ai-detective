-- Migration: Fix GROUP BY in finalize_round(p_round)
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
  select t.id,p_round,least(r.max_points,coalesce(sum(case when s.answer=k.answer then coalesce((k.scoring->>'points')::int,1) else 0 end),0)),clock_timestamp()
  from public.teams t
  cross join public.rounds r
  left join public.submissions s on s.team_id=t.id and s.round_id=p_round
  left join public.challenge_keys k on k.challenge_id=s.challenge_id
  where r.id=p_round and (p_round=1 or exists(select 1 from public.qualifications q where q.team_id=t.id and q.round_id=p_round-1 and q.qualified))
  group by t.id, r.max_points
  on conflict(team_id,round_id) do nothing;

  select max_points*qualification_percent/100 into v_threshold from public.rounds where id=p_round;

  insert into public.qualifications(team_id,round_id,points,threshold_points,qualified)
  select t.id,p_round,sc.points,v_threshold,sc.points>=v_threshold
    and (p_round=1 or exists(select 1 from public.qualifications q where q.team_id=t.id and q.round_id=p_round-1 and q.qualified))
  from public.teams t join public.scores sc on sc.team_id=t.id and sc.round_id=p_round
  on conflict(team_id,round_id) do nothing;

  update public.rounds set status='revealed',closed_at=coalesce(closed_at,clock_timestamp()),paused_remaining_seconds=null where id=p_round;
  update public.event_config set status='active',current_round=p_round,updated_at=clock_timestamp() where singleton;
  select count(*),count(*) filter(where qualified) into v_teams,v_passed from public.qualifications where round_id=p_round;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'round_finalized',jsonb_build_object('round',p_round,'teams',v_teams,'qualified',v_passed));
  return jsonb_build_object('round',p_round,'teams',v_teams,'qualified',v_passed,'threshold',v_threshold);
end $$;

revoke all on function public.finalize_round(smallint) from public,anon;
grant execute on function public.finalize_round(smallint) to authenticated;
