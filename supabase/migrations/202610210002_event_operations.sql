-- Server-side event operations. Every transition is serialized by locking the
-- singleton event row; the client never supplies official timestamps or scores.
alter table public.event_config
  add column if not exists current_round smallint references public.rounds(id),
  add column if not exists event_started_at timestamptz,
  add column if not exists event_ended_at timestamptz,
  add column if not exists event_name text not null default 'AI Detective by Lang Net',
  add column if not exists organizer_name text not null default 'Lang Net';
alter table public.rounds
  add column if not exists paused_remaining_seconds integer,
  add column if not exists closed_at timestamptz;
alter table public.rounds alter column qualification_percent set default 70;
update public.rounds set qualification_percent=70 where qualification_percent is null;
alter table public.rounds alter column qualification_percent set not null;
create unique index if not exists teams_name_ci_unique on public.teams(lower(name));
create index if not exists challenges_round_published_idx on public.challenges(round_id,sort_order) where published;

create table public.qualifications (
  team_id uuid not null references public.teams(id),
  round_id smallint not null references public.rounds(id),
  points integer not null default 0 check(points>=0),
  threshold_points integer not null check(threshold_points>=0),
  qualified boolean not null,
  finalized_at timestamptz not null default now(),
  primary key(team_id,round_id)
);
alter table public.qualifications enable row level security;
create policy "read own qualification" on public.qualifications for select using (
  exists(select 1 from public.team_members m where m.team_id=qualifications.team_id and m.user_id=auth.uid())
);
create policy "organizers read qualifications" on public.qualifications for select using (public.is_organizer());
grant select on public.qualifications to authenticated;
revoke insert,update,delete on public.qualifications from anon,authenticated;

drop policy if exists "read published active challenges" on public.challenges;
create policy "read published eligible challenges" on public.challenges for select using (
  published
  and exists(select 1 from public.rounds r where r.id=round_id and r.status in ('active','closed','revealed'))
  and exists(select 1 from public.team_members m where m.user_id=auth.uid())
  and (round_id=1 or exists(
    select 1 from public.team_members m join public.qualifications q on q.team_id=m.team_id
    where m.user_id=auth.uid() and q.round_id=challenges.round_id-1 and q.qualified
  ))
);
-- Column grants keep provenance/audit metadata private even when a participant
-- bypasses the UI and queries PostgREST directly.
revoke select on public.challenges from anon,authenticated;
grant select(id,round_id,content,sort_order,published) on public.challenges to authenticated;
revoke all on public.challenge_keys from public,anon,authenticated;
revoke all on public.organizers from public,anon,authenticated;
revoke select on public.audit_log from anon,authenticated;

create or replace function public.assert_organizer() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not exists(select 1 from public.organizers where user_id=auth.uid()) then
    raise exception 'organizer authorization required' using errcode='42501';
  end if;
end $$;
revoke all on function public.assert_organizer() from public;

create or replace function public.create_team(p_name text, p_display_name text)
returns table(team_id uuid, join_code text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_team uuid; v_code text := upper(encode(extensions.gen_random_bytes(8),'hex'));
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if length(trim(p_name)) not between 2 and 40 or length(trim(p_display_name)) not between 1 and 50 then
    raise exception 'invalid team or display name';
  end if;
  perform 1 from public.event_config where singleton for update;
  if (select status from public.event_config where singleton) not in ('registration','waiting') then
    raise exception 'registration is closed';
  end if;
  insert into public.profiles(user_id,display_name) values(auth.uid(),trim(p_display_name))
    on conflict(user_id) do update set display_name=excluded.display_name;
  insert into public.teams(name,join_code_hash,captain_user_id)
    values(trim(p_name),encode(extensions.digest(v_code,'sha256'),'hex'),auth.uid()) returning id into v_team;
  insert into public.team_members(team_id,user_id,role) values(v_team,auth.uid(),'captain');
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'team_created',jsonb_build_object('team',v_team));
  return query select v_team,v_code;
end $$;

create or replace function public.join_team(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_team uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if length(trim(p_code)) not between 8 and 20 or length(trim(p_display_name)) not between 1 and 50 then raise exception 'invalid join details'; end if;
  perform 1 from public.event_config where singleton for update;
  if (select status from public.event_config where singleton) not in ('registration','waiting') then raise exception 'registration is closed'; end if;
  insert into public.profiles(user_id,display_name) values(auth.uid(),trim(p_display_name))
    on conflict(user_id) do update set display_name=excluded.display_name;
  select id into v_team from public.teams where join_code_hash=encode(extensions.digest(upper(trim(p_code)),'sha256'),'hex') for update;
  if v_team is null then raise exception 'team code not found'; end if;
  if (select count(*) from public.team_members where team_id=v_team)>=3 then raise exception 'team is full'; end if;
  insert into public.team_members(team_id,user_id,role) values(v_team,auth.uid(),'member');
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'team_joined',jsonb_build_object('team',v_team));
  return v_team;
end $$;

create or replace function public.set_round_threshold(p_round smallint,p_percent smallint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_organizer();
  if p_percent not between 0 and 100 then raise exception 'threshold must be between 0 and 100'; end if;
  if (select status from public.event_config where singleton for update) not in ('registration','waiting') then raise exception 'thresholds are locked after event start'; end if;
  update public.rounds set qualification_percent=p_percent where id=p_round and status='locked';
  if not found then raise exception 'round not configurable'; end if;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'round_threshold_changed',jsonb_build_object('round',p_round,'percent',p_percent));
end $$;

create or replace function public.set_round_duration(p_round smallint,p_seconds integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_other_total integer;
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  if (select status from public.event_config where singleton)<>'registration' then raise exception 'schedule is locked after event start'; end if;
  if p_seconds not between 60 and 1800 then raise exception 'round duration must be 1 to 30 minutes'; end if;
  select coalesce(sum(duration_seconds),0) into v_other_total from public.rounds where id<>p_round;
  if v_other_total+p_seconds>3000 then raise exception 'round schedule cannot exceed 50 competition minutes'; end if;
  update public.rounds set duration_seconds=p_seconds where id=p_round and status='locked';
  if not found then raise exception 'round is not configurable'; end if;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'round_duration_changed',jsonb_build_object('round',p_round,'seconds',p_seconds));
end $$;

create or replace function public.set_event_details(p_event_name text,p_organizer_name text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_organizer(); perform 1 from public.event_config where singleton for update;
  if (select status from public.event_config where singleton)<>'registration' then raise exception 'event details are locked after start'; end if;
  if coalesce(length(trim(p_event_name)),0) not between 3 and 80 or coalesce(length(trim(p_organizer_name)),0) not between 2 and 80 then raise exception 'invalid event or organizer name'; end if;
  update public.event_config set event_name=trim(p_event_name),organizer_name=trim(p_organizer_name),updated_at=clock_timestamp() where singleton;
  insert into public.audit_log(actor,action) values(auth.uid(),'event_details_changed');
end $$;

create or replace function public.publish_challenge(
  p_round smallint,p_sort_order integer,p_content jsonb,p_answer jsonb,p_scoring jsonb,
  p_explanation text,p_provenance jsonb,p_verification_notes text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_max integer; v_points integer;
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  if (select status from public.event_config where singleton)<>'registration' then raise exception 'challenge content is locked after event start'; end if;
  if jsonb_typeof(p_content)<>'object' or coalesce(length(trim(p_content->>'question')),0)<10 then raise exception 'challenge needs a question in content.question'; end if;
  if p_content->>'question_type' is null or p_content->>'question_type' not in ('multiple_choice','classification','written','case_report') then raise exception 'invalid question_type'; end if;
  if p_content->>'difficulty' is null or p_content->>'difficulty' not in ('easy','medium','hard') then raise exception 'invalid difficulty'; end if;
  if p_content ?| array['answer','correct','correct_answer','answer_key','explanation','scoring'] then raise exception 'private answer data must be stored in the key fields'; end if;
  if p_sort_order<0 then raise exception 'sort order must be non-negative'; end if;
  if coalesce(jsonb_typeof(p_provenance),'null')<>'object' or p_provenance='{}'::jsonb then raise exception 'document challenge provenance'; end if;
  if coalesce(length(trim(p_explanation)),0)<20 or coalesce(length(trim(p_verification_notes)),0)<20 then raise exception 'explanation and verification notes must be documented'; end if;
  select max_points into v_max from public.rounds where id=p_round;
  if p_answer is null or coalesce(jsonb_typeof(p_scoring),'null')<>'object' then raise exception 'answer and scoring configuration are required'; end if;
  v_points:=(p_scoring->>'points')::integer;
  if v_points is null or v_points<1 or v_points>v_max then raise exception 'challenge points must fit within the round maximum'; end if;
  insert into public.challenges(round_id,content,sort_order,published,provenance)
    values(p_round,p_content,p_sort_order,true,p_provenance) returning id into v_id;
  insert into public.challenge_keys(challenge_id,answer,scoring,explanation,verification_notes)
    values(v_id,p_answer,p_scoring,p_explanation,trim(p_verification_notes));
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'challenge_published',jsonb_build_object('challenge',v_id,'round',p_round,'sort_order',p_sort_order));
  return v_id;
end $$;

create or replace function public.start_event()
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare v_now timestamptz := clock_timestamp();
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  if (select status from public.event_config where singleton)<>'registration' then raise exception 'event is not in registration state'; end if;
  if not exists(select 1 from public.teams) or exists(
    select 1 from public.teams t left join public.team_members m on m.team_id=t.id
    group by t.id having count(m.user_id)<>3
  ) then
    raise exception 'all teams must have exactly three members before the event starts';
  end if;
  if exists(select 1 from public.rounds r where not exists(
    select 1 from public.challenges c join public.challenge_keys k on k.challenge_id=c.id
    where c.round_id=r.id and c.published
  )) then raise exception 'every round needs a published challenge with a verified answer key'; end if;
  update public.event_config set status='active',current_round=1,event_started_at=v_now,updated_at=v_now where singleton;
  update public.rounds set status='active',starts_at=v_now,deadline_at=v_now+make_interval(secs=>duration_seconds) where id=1;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'event_started',jsonb_build_object('at',v_now));
  return v_now;
end $$;

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
  group by t.id
  on conflict(team_id,round_id) do nothing;
  select max_points*qualification_percent/100 into v_threshold from public.rounds where id=p_round;
  insert into public.qualifications(team_id,round_id,points,threshold_points,qualified)
  select t.id,p_round,sc.points,v_threshold,sc.points>=v_threshold
    and (p_round=1 or exists(select 1 from public.qualifications q where q.team_id=t.id and q.round_id=p_round-1 and q.qualified))
  from public.teams t join public.scores sc on sc.team_id=t.id and sc.round_id=p_round
  on conflict(team_id,round_id) do nothing;
  update public.rounds set status='revealed',closed_at=coalesce(closed_at,clock_timestamp()),paused_remaining_seconds=null where id=p_round;
  -- Even after round four, completion is an explicit administrator action.
  update public.event_config set status='active',current_round=p_round,updated_at=clock_timestamp() where singleton;
  select count(*),count(*) filter(where qualified) into v_teams,v_passed from public.qualifications where round_id=p_round;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'round_finalized',jsonb_build_object('round',p_round,'teams',v_teams,'qualified',v_passed));
  return jsonb_build_object('round',p_round,'teams',v_teams,'qualified',v_passed,'threshold',v_threshold);
end $$;

create or replace function public.start_next_round(p_round smallint)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare v_now timestamptz := clock_timestamp(); v_count integer;
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  if p_round not between 2 and 4 or (select current_round from public.event_config where singleton)<>p_round-1 then raise exception 'invalid next round'; end if;
  if (select status from public.rounds where id=p_round-1)<>'revealed' then raise exception 'previous results are not finalized'; end if;
  select count(*) into v_count from public.qualifications where round_id=p_round-1 and qualified;
  if v_count=0 then raise exception 'no teams qualified; explicit event review required'; end if;
  if exists(select 1 from public.rounds where id=p_round and status<>'locked') then raise exception 'round already started'; end if;
  update public.event_config set current_round=p_round,updated_at=v_now where singleton;
  update public.rounds set status='active',starts_at=v_now,deadline_at=v_now+make_interval(secs=>duration_seconds) where id=p_round;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'round_started',jsonb_build_object('round',p_round,'at',v_now));
  return v_now;
end $$;

create or replace function public.pause_round()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_round smallint; v_remaining integer;
begin
  perform public.assert_organizer(); perform 1 from public.event_config where singleton for update;
  select current_round into v_round from public.event_config where singleton;
  update public.rounds set status='paused',paused_remaining_seconds=greatest(0,ceil(extract(epoch from deadline_at-clock_timestamp()))::int)
    where id=v_round and status='active' and deadline_at>clock_timestamp() returning paused_remaining_seconds into v_remaining;
  if not found then raise exception 'no unexpired active round to pause'; end if;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'round_paused',jsonb_build_object('round',v_round,'remaining',v_remaining));
  return v_remaining;
end $$;

create or replace function public.resume_round()
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare v_round smallint; v_deadline timestamptz;
begin
  perform public.assert_organizer(); perform 1 from public.event_config where singleton for update;
  select current_round into v_round from public.event_config where singleton;
  update public.rounds set status='active',deadline_at=clock_timestamp()+make_interval(secs=>paused_remaining_seconds),paused_remaining_seconds=null
    where id=v_round and status='paused' returning deadline_at into v_deadline;
  if not found then raise exception 'no paused round'; end if;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'round_resumed',jsonb_build_object('round',v_round,'deadline',v_deadline));
  return v_deadline;
end $$;

create or replace function public.close_round_early()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_round smallint;
begin
  perform public.assert_organizer(); perform 1 from public.event_config where singleton for update;
  select current_round into v_round from public.event_config where singleton;
  update public.rounds set status='closed',closed_at=clock_timestamp() where id=v_round and status in ('active','paused');
  if not found then raise exception 'round is not open'; end if;
  return public.finalize_round(v_round);
end $$;

create or replace function public.submit_answer(p_challenge uuid,p_answer jsonb,p_reasoning text,p_idempotency uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_team uuid; v_role text; v_round smallint; v_id uuid; v_event_round smallint; v_prev boolean; v_round_status text; v_deadline timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select team_id,role into v_team,v_role from public.team_members where user_id=auth.uid();
  if v_team is null then raise exception 'team membership required' using errcode='42501'; end if;
  if v_role<>'captain' then raise exception 'only the team captain may submit the official answer' using errcode='42501'; end if;
  select c.round_id into v_round from public.challenges c where c.id=p_challenge and c.published;
  if v_round is null then raise exception 'challenge unavailable'; end if;
  select current_round into v_event_round from public.event_config where singleton;
  select status,deadline_at into v_round_status,v_deadline from public.rounds where id=v_round for update;
  if v_round<>v_event_round or v_round_status<>'active' or clock_timestamp()>v_deadline then
    raise exception 'round is closed or not active';
  end if;
  if v_round>1 then
    select qualified into v_prev from public.qualifications where team_id=v_team and round_id=v_round-1;
    if coalesce(v_prev,false)=false then raise exception 'team is not qualified for this round' using errcode='42501'; end if;
  end if;
  insert into public.submissions(team_id,round_id,challenge_id,submitted_by,answer,reasoning,idempotency_key)
    values(v_team,v_round,p_challenge,auth.uid(),coalesce(p_answer,'null'::jsonb),coalesce(p_reasoning,''),p_idempotency)
    on conflict(team_id,challenge_id) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.submissions where team_id=v_team and challenge_id=p_challenge;
  end if;
  return v_id;
end $$;

create or replace function public.finalize_expired_round()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_round smallint;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  perform 1 from public.event_config where singleton for update;
  select current_round into v_round from public.event_config where singleton;
  if v_round is null or not exists(select 1 from public.rounds where id=v_round and status='active' and deadline_at<=clock_timestamp()) then
    if v_round is not null and exists(select 1 from public.rounds where id=v_round and status='revealed') then
      return jsonb_build_object('round',v_round,'already_finalized',true);
    end if;
    raise exception 'no expired round to finalize';
  end if;
  update public.rounds set status='closed',closed_at=clock_timestamp() where id=v_round;
  return public.finalize_round(v_round);
end $$;

create or replace function public.end_event()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_organizer();
  update public.event_config set status='completed',event_ended_at=clock_timestamp(),updated_at=clock_timestamp()
    where singleton and status='active' and current_round=4
      and exists(select 1 from public.rounds where id=4 and status='revealed');
  if not found then raise exception 'final results must be ready before ending event'; end if;
  insert into public.audit_log(actor,action) values(auth.uid(),'event_ended');
end $$;

create or replace function public.end_event_no_qualifiers()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_round smallint;
begin
  perform public.assert_organizer(); perform 1 from public.event_config where singleton for update;
  select current_round into v_round from public.event_config where singleton;
  if v_round is null or v_round>=4 or not exists(select 1 from public.rounds where id=v_round and status='revealed')
    or exists(select 1 from public.qualifications where round_id=v_round and qualified) then
    raise exception 'event may end early only after finalized results with no qualified teams';
  end if;
  update public.event_config set status='completed',event_ended_at=clock_timestamp(),updated_at=clock_timestamp() where singleton;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'event_ended_no_qualifiers',jsonb_build_object('round',v_round));
end $$;

create or replace function public.adjust_score(p_team uuid,p_round smallint,p_points integer,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_max integer; v_threshold integer; v_previous boolean;
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  if not exists(select 1 from public.event_config where singleton and status='active' and current_round=p_round) then
    raise exception 'scores are locked after the next round starts or the event ends';
  end if;
  if length(trim(coalesce(p_reason,''))) not between 10 and 500 then raise exception 'score adjustment reason must be 10 to 500 characters'; end if;
  select max_points,max_points*qualification_percent/100 into v_max,v_threshold from public.rounds where id=p_round;
  if p_points<0 or p_points>v_max then raise exception 'points are outside the round score range'; end if;
  if not exists(select 1 from public.rounds where id=p_round and status='revealed') then raise exception 'scores can only be adjusted after round finalization'; end if;
  if p_round>1 then
    select qualified into v_previous from public.qualifications where team_id=p_team and round_id=p_round-1;
    if not coalesce(v_previous,false) then raise exception 'team was not eligible for this round'; end if;
  end if;
  update public.scores set points=p_points,evaluated_at=clock_timestamp() where team_id=p_team and round_id=p_round;
  if not found then raise exception 'score record not found'; end if;
  update public.qualifications set points=p_points,threshold_points=v_threshold,qualified=(p_points>=v_threshold),finalized_at=clock_timestamp()
    where team_id=p_team and round_id=p_round;
  insert into public.audit_log(actor,action,detail) values(auth.uid(),'score_adjusted',jsonb_build_object(
    'team',p_team,'round',p_round,'points',p_points,'reason',trim(p_reason)));
end $$;

create or replace function public.get_event_state()
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if exists(select 1 from public.event_config e join public.rounds r on r.id=e.current_round
            where e.singleton and r.status='active' and r.deadline_at<=clock_timestamp()) then
    perform public.finalize_expired_round();
  end if;
  return jsonb_build_object(
    'server_now',clock_timestamp(),
    'event',(select to_jsonb(e)-'singleton' from public.event_config e where singleton),
    'rounds',coalesce((select jsonb_agg(to_jsonb(r) order by id) from public.rounds r),'[]'::jsonb)
  );
end $$;

create or replace function public.get_round_debrief(p_round smallint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_team uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select team_id into v_team from public.team_members where user_id=auth.uid();
  if v_team is null or not exists(select 1 from public.scores where team_id=v_team and round_id=p_round) then
    raise exception 'team did not participate in this round' using errcode='42501';
  end if;
  if not exists(select 1 from public.rounds where id=p_round and status='revealed') then raise exception 'round results are not revealed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('challenge_id',c.id,'answer',k.answer,'explanation',k.explanation,'verification_notes',k.verification_notes) order by c.sort_order)
    from public.challenges c join public.challenge_keys k on k.challenge_id=c.id where c.round_id=p_round and c.published),'[]'::jsonb);
end $$;

create or replace function public.get_leaderboard()
returns table(rank bigint,team_name text,total_score bigint,final_round_score integer,round_scores jsonb,completed_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if (select status from public.event_config where singleton)<>'completed' then raise exception 'final leaderboard is not published yet'; end if;
  return query
  with finish_times as (
    select team_id,max(received_at) completed from public.submissions where round_id=4 group by team_id
  ), totals as (
    select t.id,t.name,coalesce(sum(s.points),0)::bigint total,
      coalesce(max(s.points) filter(where s.round_id=4),0) final_score,
      jsonb_object_agg(s.round_id,s.points) filter(where s.round_id is not null) scores
    from public.teams t left join public.scores s on s.team_id=t.id group by t.id,t.name
  )
  select row_number() over(order by x.total desc,x.final_score desc,f.completed asc nulls last,x.id asc),x.name,x.total,x.final_score,
    coalesce(x.scores,'{}'::jsonb),f.completed from totals x left join finish_times f on f.team_id=x.id;
end $$;

create or replace function public.get_admin_event_state()
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_organizer();
  return jsonb_build_object(
    'teams',(select count(*) from public.teams),
    'participants',(select count(*) from public.team_members),
    'submissions',(select count(*) from public.submissions),
    'published_challenges',(select count(*) from public.challenges where published),
    'qualified',(select count(*) from public.qualifications where qualified and round_id=(select current_round from public.event_config where singleton)),
    'teams_detail',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'members',coalesce(m.cnt,0)) order by t.name),'[]'::jsonb)
      from public.teams t left join (select team_id,count(*) cnt from public.team_members group by team_id) m on m.team_id=t.id),
    'results',(select coalesce(jsonb_agg(jsonb_build_object('team_id',t.id,'team_name',t.name,'round_id',s.round_id,'points',s.points,
      'qualified',q.qualified,'threshold_points',q.threshold_points) order by s.round_id,t.name),'[]'::jsonb)
      from public.scores s join public.teams t on t.id=s.team_id left join public.qualifications q on q.team_id=s.team_id and q.round_id=s.round_id),
    'submissions_detail',(select coalesce(jsonb_agg(to_jsonb(x) order by x.received_at desc),'[]'::jsonb) from (
      select s.id,t.name team_name,s.round_id,s.challenge_id,s.answer,s.reasoning,s.received_at
      from public.submissions s join public.teams t on t.id=s.team_id order by s.received_at desc limit 200
    ) x),
    'event',public.get_event_state()
  );
end $$;

do $$ declare f text; begin
  foreach f in array array['create_team(text,text)','join_team(text,text)','set_round_threshold(smallint,smallint)','set_round_duration(smallint,integer)','set_event_details(text,text)',
    'publish_challenge(smallint,integer,jsonb,jsonb,jsonb,text,jsonb,text)',
    'start_event()','start_next_round(smallint)','pause_round()','resume_round()','close_round_early()',
    'submit_answer(uuid,jsonb,text,uuid)','finalize_expired_round()','end_event()','end_event_no_qualifiers()',
    'get_event_state()','get_admin_event_state()','get_round_debrief(smallint)','get_leaderboard()','adjust_score(uuid,smallint,integer,text)'] loop
    execute format('revoke all on function public.%s from public',f);
    execute format('grant execute on function public.%s to authenticated',f);
  end loop;
end $$;

revoke all on function public.finalize_round(smallint) from public,anon,authenticated;

drop policy if exists "read scores" on public.scores;
create policy "read own scores" on public.scores for select using (
  exists(select 1 from public.team_members m where m.team_id=scores.team_id and m.user_id=auth.uid())
);
create policy "organizers read all scores" on public.scores for select using (public.is_organizer());
create policy "organizers read submissions" on public.submissions for select using (public.is_organizer());
create policy "organizers read teams" on public.teams for select using (public.is_organizer());
create policy "organizers read team members" on public.team_members for select using (public.is_organizer());
create policy "organizers read audit log" on public.audit_log for select using (public.is_organizer());
grant select on public.audit_log to authenticated;

do $$ declare t text; begin
  foreach t in array array['event_config','rounds','qualifications','submissions'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I',t);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end $$;

