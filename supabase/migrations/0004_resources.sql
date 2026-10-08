-- PersonalDash database setup — PART 4 of 5: project resources (links with an image and a description)
--
-- Run the five parts in order (0001 to 0005) in Supabase > SQL Editor > New query: paste ONE whole part,
-- click Run with nothing selected, then do the next part. Each part is short so it can't get cut off, and each
-- is safe to run again (anything that already exists is skipped).
--
-- Requires parts 1 to 3.

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'settings' and policyname = 'settings_select_own'
  ) then
    raise exception 'Run part 3 first (the security policies are missing).';
  end if;
end;
$$;

-- resources: workstream_ids holds milestone ids (empty = project-wide); image_path is a Storage path (part 5)
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  url text not null,
  title text not null default '',
  description text not null default '',
  image_url text,
  image_path text,
  workstream_ids uuid[] not null default '{}',
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists resources_user_id_idx on public.resources (user_id);
create index if not exists resources_project_id_idx on public.resources (project_id);

-- Deleting a milestone removes it from every resource's workstream_ids (an array has no foreign key).
create or replace function public.remove_milestone_from_resources()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.resources
     set workstream_ids = array_remove(workstream_ids, old.id)
   where user_id = old.user_id and workstream_ids @> array[old.id];
  return old;
end;
$$;

drop trigger if exists milestones_remove_from_resources on public.milestones;
create trigger milestones_remove_from_resources
  after delete on public.milestones
  for each row execute function public.remove_milestone_from_resources();

-- Row Level Security: each user sees and writes only their own resources.
alter table public.resources enable row level security;

drop policy if exists resources_select_own on public.resources;
create policy resources_select_own on public.resources for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists resources_insert_own on public.resources;
create policy resources_insert_own on public.resources for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists resources_update_own on public.resources;
create policy resources_update_own on public.resources for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists resources_delete_own on public.resources;
create policy resources_delete_own on public.resources for delete to authenticated
  using (user_id = (select auth.uid()));

-- Summary: should show rls_enabled = true, 4 policies and 1 milestone trigger.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = 'resources') as policies,
       (select count(*) from pg_trigger t where t.tgrelid = 'public.milestones'::regclass
          and t.tgname = 'milestones_remove_from_resources') as milestone_trigger
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'resources';
