-- Migration: Fix round_winner order column in participant_get_state
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
        where s.round_id=v_round order by s.points desc, t.created_at asc limit 1)
       else null end,
    'final_results_published', coalesce(v_results_published, false),
    'leaderboard',case when (select status from public.event_config where singleton)='completed'
       and coalesce(v_results_published,false)=true
       then coalesce((select jsonb_agg(to_jsonb(l) order by l.rank) from public.get_participant_leaderboard() l),'[]'::jsonb) else '[]'::jsonb end
  );
end $$;

grant execute on function public.participant_get_state(text) to service_role;
