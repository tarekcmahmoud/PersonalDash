-- PersonalDash database setup — PART 6 of 6: substreams (a workstream inside a workstream)
--
-- Run the parts in order (0001 to 0006) in Supabase > SQL Editor > New query: paste ONE whole part,
-- click Run with nothing selected, then do the next part. Each part is short so it can't get cut off, and each
-- is safe to run again (anything that already exists is skipped).
--
-- Requires part 4 (part 5, storage, may have been set up by hand in the dashboard instead).

do $$
begin
  if to_regclass('public.resources') is null then
    raise exception 'Run part 4 first (table public.resources is missing).';
  end if;
end;
$$;

-- A substream is a milestone whose parent_id is a workstream of the same project. Deleting a workstream deletes
-- its substreams (and, through milestone_id, their tasks). Row Level Security on milestones already applies.
alter table public.milestones
  add column if not exists parent_id uuid references public.milestones (id) on delete cascade;
create index if not exists milestones_parent_id_idx on public.milestones (parent_id);

-- Summary: should show parent_id as a uuid column.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'milestones' and column_name = 'parent_id';
