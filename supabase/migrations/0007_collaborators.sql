-- PersonalDash database setup — PART 7 of 7: collaborators (people you delegate tasks to)
--
-- Run the parts in order (0001 to 0007) in Supabase > SQL Editor > New query: paste ONE whole part,
-- click Run with nothing selected, then do the next part. Each part is short so it can't get cut off, and each
-- is safe to run again (anything that already exists is skipped).
--
-- Requires part 6.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'milestones' and column_name = 'parent_id'
  ) then
    raise exception 'Run part 6 first (milestones.parent_id is missing).';
  end if;
end;
$$;

-- people: names only (they never sign in), shared by all of your projects
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists people_user_id_idx on public.people (user_id);

-- A project's collaborators (people ids), and who a task is delegated to (null = yours).
alter table public.projects add column if not exists collaborator_ids uuid[] not null default '{}';
alter table public.tasks
  add column if not exists assignee_id uuid references public.people (id) on delete set null;
create index if not exists tasks_assignee_id_idx on public.tasks (assignee_id);

-- Deleting a person removes them from every project's collaborators (an array has no foreign key);
-- their tasks are unassigned by the foreign key above.
create or replace function public.remove_person_from_projects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.projects
     set collaborator_ids = array_remove(collaborator_ids, old.id)
   where user_id = old.user_id and collaborator_ids @> array[old.id];
  return old;
end;
$$;

drop trigger if exists people_remove_from_projects on public.people;
create trigger people_remove_from_projects
  after delete on public.people
  for each row execute function public.remove_person_from_projects();

-- Row Level Security: each user sees and writes only their own people.
alter table public.people enable row level security;

drop policy if exists people_select_own on public.people;
create policy people_select_own on public.people for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists people_insert_own on public.people;
create policy people_insert_own on public.people for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists people_update_own on public.people;
create policy people_update_own on public.people for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists people_delete_own on public.people;
create policy people_delete_own on public.people for delete to authenticated
  using (user_id = (select auth.uid()));

-- Summary: should show rls_enabled = true, 4 policies and both new columns.
select c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = 'people') as policies,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and column_name in ('collaborator_ids', 'assignee_id')) as new_columns
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'people';
