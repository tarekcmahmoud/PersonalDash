-- PersonalDash database setup — PART 1 of 7: types and core tables (projects, milestones, tasks)
--
-- Run the seven parts in order (0001 to 0007) in Supabase > SQL Editor > New query: paste ONE whole part,
-- click Run with nothing selected, then do the next part. Each part is short so it can't get cut off, and each
-- is safe to run again (anything that already exists is skipped).
--
-- Design notes: supabase/README.md.
-- Enums
do $$ begin create type public.project_status as enum ('active', 'on_hold', 'done'); exception when duplicate_object then null; end $$;
do $$ begin create type public.date_kind as enum ('hard', 'soft'); exception when duplicate_object then null; end $$;
do $$ begin create type public.task_size as enum ('S', 'M', 'L', 'XL'); exception when duplicate_object then null; end $$;
do $$ begin create type public.task_status as enum ('todo', 'waiting', 'done'); exception when duplicate_object then null; end $$;

-- projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  outcome text not null default '',
  target_date date,
  date_kind public.date_kind not null default 'soft',
  status public.project_status not null default 'active',
  rank double precision not null default 0,
  weekly_min integer check (weekly_min is null or weekly_min >= 0),
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists projects_user_id_idx on public.projects (user_id);
-- At most one system project per user.
create unique index if not exists projects_one_system_per_user_idx on public.projects (user_id) where is_system;

-- milestones
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  position double precision not null default 0,
  target_date date,
  date_kind public.date_kind
);
create index if not exists milestones_user_id_idx on public.milestones (user_id);
create index if not exists milestones_project_id_idx on public.milestones (project_id);

-- tasks (project_id null = Inbox)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete cascade,
  title text not null,
  notes text not null default '',
  done_when text not null default '',
  size public.task_size not null default 'S',
  position double precision not null default 0,
  status public.task_status not null default 'todo',
  waiting_on text,
  follow_up_date date,
  week_start date,
  pinned_day date,
  slip_count integer not null default 0 check (slip_count >= 0),
  completed_at timestamptz,
  gcal_event_id text,
  gcal_dirty boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_milestone_id_idx on public.tasks (milestone_id);
create index if not exists tasks_week_start_idx on public.tasks (user_id, week_start);

select 'Part 1 of 7 done: types, projects, milestones, tasks. Now run part 2.' as result;
