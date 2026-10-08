-- PersonalDash — initial schema.
--
-- HOW TO APPLY
--   Option A (no tooling): open your Supabase project > SQL Editor > New query, paste this whole file, Run.
--   Option B (Supabase CLI): from the repo root run `supabase link --project-ref <ref>` once, then
--   `supabase db push` (this file lives in supabase/migrations/ so the CLI picks it up).
--
-- Then create the single user in Dashboard > Authentication > Users (Add user, email + password; tick
-- "Auto Confirm User"). There is deliberately no sign-up flow in the app.
--
-- Design notes
--   * Mirrors src/domain/types.ts (Snapshot). camelCase fields become snake_case columns.
--   * Ids are client-generated uuids (optimistic writes); `default gen_random_uuid()` is only a fallback.
--   * Every table carries user_id (defaults to auth.uid()) and has Row Level Security enabled with
--     select/insert/update/delete policies restricted to user_id = auth.uid().
--   * ON DELETE CASCADE mirrors the cascade rules documented in src/data/changes.ts.
--   * The system "Admin / Misc" project (is_system) cannot be deleted or un-flagged, and there is at
--     most one per user.
--
-- Run once. It is not written to be re-run (create type / create table without IF NOT EXISTS).

-- ---------------------------------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------------------------------
create type public.project_status as enum ('active', 'on_hold', 'done');
create type public.date_kind as enum ('hard', 'soft');
create type public.task_size as enum ('S', 'M', 'L', 'XL');
create type public.task_status as enum ('todo', 'waiting', 'done');

-- ---------------------------------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------------------------------
create table public.projects (
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
create index projects_user_id_idx on public.projects (user_id);
-- At most one system project per user.
create unique index projects_one_system_per_user_idx on public.projects (user_id) where is_system;

-- ---------------------------------------------------------------------------------------------------
-- milestones
-- ---------------------------------------------------------------------------------------------------
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  position double precision not null default 0,
  target_date date,
  date_kind public.date_kind
);
create index milestones_user_id_idx on public.milestones (user_id);
create index milestones_project_id_idx on public.milestones (project_id);

-- ---------------------------------------------------------------------------------------------------
-- tasks (project_id null = Inbox)
-- ---------------------------------------------------------------------------------------------------
create table public.tasks (
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
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_milestone_id_idx on public.tasks (milestone_id);
create index tasks_week_start_idx on public.tasks (user_id, week_start);

-- ---------------------------------------------------------------------------------------------------
-- task_dependencies: task_id cannot start until blocked_by_task_id is done
-- ---------------------------------------------------------------------------------------------------
create table public.task_dependencies (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  blocked_by_task_id uuid not null references public.tasks (id) on delete cascade,
  primary key (task_id, blocked_by_task_id),
  check (task_id <> blocked_by_task_id)
);
create index task_dependencies_user_id_idx on public.task_dependencies (user_id);
create index task_dependencies_blocked_by_idx on public.task_dependencies (blocked_by_task_id);

-- ---------------------------------------------------------------------------------------------------
-- checklist_items
-- ---------------------------------------------------------------------------------------------------
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position double precision not null default 0
);
create index checklist_items_user_id_idx on public.checklist_items (user_id);
create index checklist_items_task_id_idx on public.checklist_items (task_id);

-- ---------------------------------------------------------------------------------------------------
-- templates
-- ---------------------------------------------------------------------------------------------------
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  outline text not null default '',
  updated_at timestamptz not null default now()
);
create index templates_user_id_idx on public.templates (user_id);

-- ---------------------------------------------------------------------------------------------------
-- weeks (per-week metadata; week_start is a Monday)
-- ---------------------------------------------------------------------------------------------------
create table public.weeks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  capacity_override double precision check (capacity_override is null or capacity_override >= 0),
  reviewed_at timestamptz,
  primary key (user_id, week_start)
);

-- ---------------------------------------------------------------------------------------------------
-- settings (one row per user)
-- ---------------------------------------------------------------------------------------------------
create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Record<'mon'..'sun', {start:'HH:MM', end:'HH:MM'} | null>
  work_hours jsonb not null,
  focus_factor double precision not null default 0.7 check (focus_factor >= 0 and focus_factor <= 1),
  -- Record<'S'|'M'|'L', number> (hours)
  size_hours jsonb not null,
  active_cap integer not null default 6 check (active_cap >= 0),
  deadline_warning_days integer not null default 14 check (deadline_warning_days >= 0),
  calendar_connected boolean not null default false,
  gcal_calendar_id text
);

-- ---------------------------------------------------------------------------------------------------
-- System project guard.
-- Blocks deleting a system project, and flipping is_system on an existing row (which would be a way
-- around the delete guard). Deleting the whole account (auth.users row removed, cascading to the
-- projects) is still allowed: in that case the owning auth.users row no longer exists.
-- ---------------------------------------------------------------------------------------------------
create function public.guard_system_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system and exists (select 1 from auth.users u where u.id = old.user_id) then
      raise exception 'The system project cannot be deleted' using errcode = 'restrict_violation';
    end if;
    return old;
  end if;

  -- UPDATE
  if new.is_system is distinct from old.is_system then
    raise exception 'projects.is_system cannot be changed' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger projects_guard_system_delete
  before delete on public.projects
  for each row execute function public.guard_system_project();

create trigger projects_guard_system_update
  before update on public.projects
  for each row execute function public.guard_system_project();

-- ---------------------------------------------------------------------------------------------------
-- Row Level Security: enabled on EVERY table; each user sees and writes only their own rows.
-- ---------------------------------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.checklist_items enable row level security;
alter table public.templates enable row level security;
alter table public.weeks enable row level security;
alter table public.settings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'milestones', 'tasks', 'task_dependencies',
    'checklist_items', 'templates', 'weeks', 'settings'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end;
$$;
