-- PersonalDash database setup — PART 5 of 7: image storage for resource cards
--
-- Run the seven parts in order (0001 to 0007) in Supabase > SQL Editor > New query: paste ONE whole part,
-- click Run with nothing selected, then do the next part. Each part is short so it can't get cut off, and each
-- is safe to run again (anything that already exists is skipped).
--
-- Requires part 4.

do $$
begin
  if to_regclass('public.resources') is null then
    raise exception 'Run part 4 first (table public.resources is missing).';
  end if;
end;
$$;

-- Private bucket: images only, at most 5 MB each. The app shows them through short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resource-images', 'resource-images', false, 5242880, array['image/*'])
on conflict (id) do nothing;

-- Each user may only touch objects in their own folder: <user id>/<file>.
drop policy if exists resource_images_select on storage.objects;
create policy resource_images_select on storage.objects for select to authenticated
  using (bucket_id = 'resource-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists resource_images_insert on storage.objects;
create policy resource_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'resource-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists resource_images_update on storage.objects;
create policy resource_images_update on storage.objects for update to authenticated
  using (bucket_id = 'resource-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'resource-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists resource_images_delete on storage.objects;
create policy resource_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'resource-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Summary: should show the private bucket (public = false, 5242880 bytes) and 4 policies.
select b.id as bucket, b.public, b.file_size_limit, b.allowed_mime_types,
       (select count(*) from pg_policies p
         where p.schemaname = 'storage' and p.tablename = 'objects' and p.policyname like 'resource\_images\_%') as policies
from storage.buckets b
where b.id = 'resource-images';
