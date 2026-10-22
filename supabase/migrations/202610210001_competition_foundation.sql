-- Foundation schema for AI Detective. Apply with `supabase db push` after linking a project.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 50),
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 40),
  join_code_hash text not null unique,
  captain_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('captain','member')),
  joined_at timestamptz not null default now(),
  primary key (team_id,user_id)
);
create index team_members_team_idx on public.team_members(team_id);

create table public.event_config (
  singleton boolean primary key default true check (singleton),
  status text not null default 'registration' check (status in ('registration','waiting','active','completed')),
  qualification_percent smallint not null default 70 check (qualification_percent between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.event_config(singleton) values (true) on conflict do nothing;

create table public.rounds (
  id smallint primary key check (id between 1 and 4),
  title text not null,
  duration_seconds integer not null check (duration_seconds > 0),
  max_points integer not null check (max_points > 0),
  status text not null default 'locked' check (status in ('locked','active','closed','revealed')),
  starts_at timestamptz,
  deadline_at timestamptz,
  qualification_percent smallint check (qualification_percent between 0 and 100),
  check ((starts_at is null and deadline_at is null) or deadline_at > starts_at)
);
insert into public.rounds(id,title,duration_seconds,max_points) values
 (1,'Human or Machine?',600,20),(2,'Fake or Fact?',720,25),
 (3,'Deepfake Detective',780,25),(4,'The Final Investigation',900,30)
 on conflict (id) do nothing;

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  round_id smallint not null references public.rounds(id),
  content jsonb not null,
  sort_order integer not null default 0,
  published boolean not null default false,
  provenance jsonb not null default '{}'::jsonb,
  unique(round_id,sort_order)
);
-- Answer keys live in a separate table and are never selectable by participant policies.
create table public.challenge_keys (
  challenge_id uuid primary key references public.challenges(id) on delete cascade,
  answer jsonb not null,
  scoring jsonb not null,
  explanation text not null,
  verification_notes text not null
);
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id),
  round_id smallint not null references public.rounds(id),
  challenge_id uuid not null references public.challenges(id),
  submitted_by uuid not null references auth.users(id),
  answer jsonb not null,
  reasoning text not null default '' check (length(reasoning) <= 5000),
  received_at timestamptz not null default clock_timestamp(),
  idempotency_key uuid not null,
  unique(team_id,challenge_id),
  unique(team_id,idempotency_key)
);
create index submissions_team_round_idx on public.submissions(team_id,round_id);
create table public.scores (
  team_id uuid not null references public.teams(id),
  round_id smallint not null references public.rounds(id),
  points integer not null default 0 check (points >= 0),
  evaluated_at timestamptz,
  primary key(team_id,round_id)
);
create table public.organizers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.event_config enable row level security;
alter table public.rounds enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_keys enable row level security;
alter table public.submissions enable row level security;
alter table public.scores enable row level security;
alter table public.organizers enable row level security;
alter table public.audit_log enable row level security;

create policy "read own profile" on public.profiles for select using (user_id = auth.uid());
create policy "edit own profile" on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "read own team" on public.teams for select using (exists (select 1 from public.team_members m where m.team_id=id and m.user_id=auth.uid()));
create policy "read own membership" on public.team_members for select using (user_id=auth.uid());
create policy "read event state" on public.event_config for select using (auth.uid() is not null);
create policy "read round state" on public.rounds for select using (auth.uid() is not null);
create policy "read published active challenges" on public.challenges for select using (
  published and exists(select 1 from public.rounds r where r.id=round_id and r.status in ('active','closed','revealed'))
  and exists(select 1 from public.team_members m where m.user_id=auth.uid())
);
create policy "read own submissions" on public.submissions for select using (
  exists(select 1 from public.team_members m where m.team_id=submissions.team_id and m.user_id=auth.uid())
);
create policy "read scores" on public.scores for select using (auth.uid() is not null);
-- No participant policies are created for keys, organizer records, or audit logs.

create or replace function public.is_organizer() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.organizers where user_id=auth.uid());
$$;
revoke all on function public.is_organizer() from public;
grant execute on function public.is_organizer() to authenticated;

-- Mutations are deliberately exposed only through later, reviewed RPCs. No client table writes.
revoke insert,update,delete on public.teams,public.team_members,public.rounds,public.challenges,
  public.challenge_keys,public.submissions,public.scores,public.event_config,public.organizers,public.audit_log
  from anon,authenticated;

grant select on public.profiles,public.teams,public.team_members,public.event_config,public.rounds,
  public.challenges,public.submissions,public.scores to authenticated;
