-- Guest team registration with server-issued, HttpOnly-cookie sessions.
-- Existing teams, memberships, scores, and organizer records are preserved.

alter table public.teams
  alter column captain_user_id drop not null,
  add column lead_name text,
  add column usn text,
  add column usn_normalized text;

create unique index teams_usn_normalized_unique
  on public.teams(usn_normalized)
  where usn_normalized is not null;

alter table public.submissions alter column submitted_by drop not null;
alter table public.teams add constraint teams_registration_identity_check check (
  (lead_name is null and usn is null and usn_normalized is null and captain_user_id is not null)
  or
  (lead_name is not null and usn is not null and usn_normalized is not null and captain_user_id is null)
);

create table public.participant_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  team_id uuid not null unique references public.teams(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null
);
alter table public.participant_sessions enable row level security;
revoke all on public.participant_sessions from public, anon, authenticated;

create table public.participant_registration_attempts (
  id bigint generated always as identity primary key,
  rate_key text not null check (rate_key ~ '^[a-f0-9]{64}$'),
  attempted_at timestamptz not null default clock_timestamp()
);
create index participant_registration_attempts_recent_idx
  on public.participant_registration_attempts(rate_key, attempted_at desc);
alter table public.participant_registration_attempts enable row level security;
revoke all on public.participant_registration_attempts from public, anon, authenticated;

create or replace function public.participant_check_registration_rate(p_rate_key text)
returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_attempts integer;
begin
  if p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$' then raise exception 'invalid registration request'; end if;
  perform pg_advisory_xact_lock(hashtext(p_rate_key));
  delete from public.participant_registration_attempts
    where attempted_at < clock_timestamp()-interval '2 days';
  select count(*) into v_attempts from public.participant_registration_attempts
    where rate_key=p_rate_key and attempted_at > clock_timestamp()-interval '1 hour';
  if v_attempts >= 10 then return false; end if;
  insert into public.participant_registration_attempts(rate_key) values(p_rate_key);
  return true;
end $$;

create or replace function public.participant_register(
  p_team_name text,
  p_lead_name text,
  p_usn text,
  p_session_hash text
) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_name text := trim(coalesce(p_team_name,''));
  v_lead text := trim(coalesce(p_lead_name,''));
  v_usn text := trim(coalesce(p_usn,''));
  v_usn_normalized text := upper(regexp_replace(trim(coalesce(p_usn,'')), '\s+', '', 'g'));
  v_team_id uuid;
begin
  if p_session_hash is null or p_session_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid registration request';
  end if;

  if length(v_name) not between 2 and 40 then raise exception 'Team name must be 2 to 40 characters.'; end if;
  if length(v_lead) not between 2 and 50 then raise exception 'Team Lead Name must be 2 to 50 characters.'; end if;
  if length(v_usn_normalized) not between 3 and 32 then raise exception 'Enter a valid USN (3 to 32 non-space characters).'; end if;
  if v_usn_normalized !~ '^[A-Z0-9/-]+$' then raise exception 'USN may contain letters, numbers, hyphens, and slashes only.'; end if;
  if p_session_hash is null or exists(select 1 from public.participant_sessions where token_hash=p_session_hash) then
    raise exception 'Could not create a participant session.';
  end if;
  if (select status from public.event_config where singleton) is distinct from 'registration' then
    raise exception 'Team registration is closed.';
  end if;

  insert into public.teams(name,join_code_hash,captain_user_id,lead_name,usn,usn_normalized)
  values(v_name,encode(extensions.digest(gen_random_bytes(32),'sha256'),'hex'),null,v_lead,v_usn,v_usn_normalized)
  returning id into v_team_id;

  insert into public.participant_sessions(token_hash,team_id,expires_at)
  values(p_session_hash,v_team_id,clock_timestamp()+interval '180 days');

  return jsonb_build_object('id',v_team_id,'name',v_name,'lead_name',v_lead);
exception
  when unique_violation then
    if exists(select 1 from public.teams where usn_normalized=v_usn_normalized) then
      raise exception 'That USN already has a team registration.' using errcode='23505', constraint='teams_usn_normalized_unique';
    end if;
    if exists(select 1 from public.teams where lower(name)=lower(v_name)) then
      raise exception 'That team name is already registered.' using errcode='23505', constraint='teams_name_ci_unique';
    end if;
    raise;
end $$;

create or replace function public.get_participant_leaderboard()
returns table(rank bigint,team_name text,total_score bigint,final_round_score integer,round_scores jsonb,completed_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  with finish_times as (
    select team_id,max(received_at) completed from public.submissions where round_id=4 group by team_id
  ), totals as (
    select t.id,t.name,coalesce(sum(s.points),0)::bigint total,
      coalesce(max(s.points) filter(where s.round_id=4),0) final_score,
      jsonb_object_agg(s.round_id,s.points) filter(where s.round_id is not null) scores
    from public.teams t left join public.scores s on s.team_id=t.id group by t.id,t.name
  )
  select row_number() over(order by x.total desc,x.final_score desc,f.completed asc nulls last,x.id asc),
    x.name,x.total,x.final_score,coalesce(x.scores,'{}'::jsonb),f.completed
  from totals x left join finish_times f on f.team_id=x.id
$$;

create or replace function public.participant_get_state(p_session_hash text)
returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_team_id uuid;
  v_round smallint;
  v_qualified boolean;
  v_event jsonb;
begin
  select team_id into v_team_id from public.participant_sessions
   where token_hash=p_session_hash and expires_at>clock_timestamp();
  if v_team_id is null then raise exception 'Participant session expired or invalid.' using errcode='42501'; end if;

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

  return v_event || jsonb_build_object(
    'team',(select jsonb_build_object('id',t.id,'name',t.name,'lead_name',t.lead_name) from public.teams t where t.id=v_team_id),
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
    'leaderboard',case when (select status from public.event_config where singleton)='completed' then
      coalesce((select jsonb_agg(to_jsonb(l) order by l.rank) from public.get_participant_leaderboard() l),'[]'::jsonb) else '[]'::jsonb end
  );
end $$;

create or replace function public.participant_submit_answer(
  p_session_hash text,p_challenge uuid,p_answer jsonb,p_reasoning text,p_idempotency uuid
) returns uuid
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_team uuid; v_round smallint; v_event_round smallint; v_status text; v_deadline timestamptz; v_previous boolean; v_submission uuid;
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
  if v_round>1 then
    select qualified into v_previous from public.qualifications where team_id=v_team and round_id=v_round-1;
    if not coalesce(v_previous,false) then raise exception 'This team is not qualified for this round.' using errcode='42501'; end if;
  end if;
  insert into public.submissions(team_id,round_id,challenge_id,submitted_by,answer,reasoning,idempotency_key)
    values(v_team,v_round,p_challenge,null,coalesce(p_answer,'null'::jsonb),coalesce(p_reasoning,''),p_idempotency)
    on conflict(team_id,challenge_id) do nothing returning id into v_submission;
  if v_submission is null then
    select id into v_submission from public.submissions where team_id=v_team and challenge_id=p_challenge;
  end if;
  return v_submission;
end $$;

-- These APIs are callable only by the trusted server runtime, which validates
-- an opaque cookie and never sends its service-role key to the browser.
revoke all on function public.participant_check_registration_rate(text) from public,anon,authenticated;
revoke all on function public.participant_register(text,text,text,text) from public,anon,authenticated;
revoke all on function public.participant_get_state(text) from public,anon,authenticated;
revoke all on function public.get_participant_leaderboard() from public,anon,authenticated;
revoke all on function public.participant_submit_answer(text,uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.participant_check_registration_rate(text) to service_role;
grant execute on function public.participant_register(text,text,text,text) to service_role;
grant execute on function public.participant_get_state(text) to service_role;
grant execute on function public.get_participant_leaderboard() to service_role;
grant execute on function public.participant_submit_answer(text,uuid,jsonb,text,uuid) to service_role;

create or replace function public.start_event()
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare v_now timestamptz := clock_timestamp();
begin
  perform public.assert_organizer();
  perform 1 from public.event_config where singleton for update;
  if (select status from public.event_config where singleton)<>'registration' then raise exception 'event is not in registration state'; end if;
  if not exists(select 1 from public.teams) or exists(
    select 1 from public.teams t left join public.team_members m on m.team_id=t.id
    group by t.id,t.lead_name
    having (t.lead_name is null and count(m.user_id)<>3)
       or (t.lead_name is not null and count(m.user_id)<>0)
  ) then
    raise exception 'all legacy teams must have exactly three members; each guest registration must have one team lead';
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

revoke all on function public.start_event() from public;
grant execute on function public.start_event() to authenticated;

create or replace function public.get_admin_event_state()
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_organizer();
  return jsonb_build_object(
    'teams',(select count(*) from public.teams),
    'participants',(select count(*) from public.team_members)+(select count(*) from public.teams where lead_name is not null),
    'submissions',(select count(*) from public.submissions),
    'published_challenges',(select count(*) from public.challenges where published),
    'qualified',(select count(*) from public.qualifications where qualified and round_id=(select current_round from public.event_config where singleton)),
    'teams_detail',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'lead_name',t.lead_name,'usn',t.usn,'members',coalesce(m.cnt,0)+case when t.lead_name is null then 0 else 1 end) order by t.name),'[]'::jsonb)
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

revoke all on function public.get_admin_event_state() from public;
grant execute on function public.get_admin_event_state() to authenticated;
