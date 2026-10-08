-- PersonalDash database setup — PART 2 of 5: remaining tables (dependencies, checklist, templates, weeks, settings)
--
-- Run the five parts in order (0001 to 0005) in Supabase > SQL Editor > New query: paste ONE whole part,
-- click Run with nothing selected, then do the next part. Each part is short so it can't get cut off, and each
-- is safe to run again (anything that already exists is skipped).
--
-- Requires part 1.

do $$
begin
  if to_regclass('public.tasks') is null then
    raise exception 'Run part 1 first (table public.tasks is missing).';
  end if;
end;
$$;
-- task_dependencies: task_id cannot start until blocked_by_task_id is done
create table if not exists public.task_dependencies (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  blocked_by_task_id uuid not null references public.tasks (id) on delete cascade,
  primary key (task_id, blocked_by_task_id),
  check (task_id <> blocked_by_task_id)
);
create index if not exists task_dependencies_user_id_idx on public.task_dependencies (user_id);
create index if not exists task_dependencies_blocked_by_idx on public.task_dependencies (blocked_by_task_id);

-- checklist_items
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position double precision not null default 0
);
create index if not exists checklist_items_user_id_idx on public.checklist_items (user_id);
create index if not exists checklist_items_task_id_idx on public.checklist_items (task_id);

-- templates
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  outline text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists templates_user_id_idx on public.templates (user_id);

-- weeks (per-week metadata; week_start is a Monday)
create table if not exists public.weeks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  capacity_override double precision check (capacity_override is null or capacity_override >= 0),
  reviewed_at timestamptz,
  primary key (user_id, week_start)
);

-- settings (one row per user)
create table if not exists public.settings (
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

select 'Part 2 of 5 done: dependencies, checklist, templates, weeks, settings. Now run part 3.' as result;
