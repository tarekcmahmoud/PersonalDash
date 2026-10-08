-- PersonalDash database setup — PART 3 of 3: system-project guard and Row Level Security
--
-- Run the three parts in order (0001, 0002, 0003) in Supabase > SQL Editor > New query: paste ONE whole part,
-- click Run with nothing selected, then do the next part. Each part is short so it can't get cut off, and each
-- is safe to run again (anything that already exists is skipped).
--
-- Requires parts 1 and 2.


do $$
begin
  if to_regclass('public.settings') is null then
    raise exception 'Run part 2 first (table public.settings is missing).';
  end if;
end;
$$;
-- System project guard.
-- Blocks deleting a system project, and flipping is_system on an existing row (which would be a way
-- around the delete guard). Deleting the whole account (auth.users row removed, cascading to the
-- projects) is still allowed: in that case the owning auth.users row no longer exists.
create or replace function public.guard_system_project()
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

drop trigger if exists projects_guard_system_delete on public.projects;
create trigger projects_guard_system_delete
  before delete on public.projects
  for each row execute function public.guard_system_project();

drop trigger if exists projects_guard_system_update on public.projects;
create trigger projects_guard_system_update
  before update on public.projects
  for each row execute function public.guard_system_project();

-- Row Level Security: enabled on EVERY table; each user sees and writes only their own rows.
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
  op text;
begin
  foreach t in array array[
    'projects', 'milestones', 'tasks', 'task_dependencies',
    'checklist_items', 'templates', 'weeks', 'settings'
  ]
  loop
    foreach op in array array['select', 'insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on public.%I', t || '_' || op || '_own', t);
    end loop;
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

-- Summary: should list 8 tables, each with rls_enabled = true and 4 policies.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('projects', 'milestones', 'tasks', 'task_dependencies', 'checklist_items', 'templates', 'weeks', 'settings')
order by c.relname;
