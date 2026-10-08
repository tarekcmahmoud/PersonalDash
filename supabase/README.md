# Database setup (Supabase)

Run the seven files in `migrations/` **in order**, each as its own query in Supabase → SQL Editor → New query:

1. `0001_core_tables.sql`: types, `projects`, `milestones`, `tasks`
2. `0002_more_tables.sql`: `task_dependencies`, `checklist_items`, `templates`, `weeks`, `settings`
3. `0003_security.sql`: the system-project guard and Row Level Security. It ends with a summary that should
   list 8 tables, each with `rls_enabled = true` and 4 policies.
4. `0004_resources.sql`: the `resources` table (project links with an image and description), its Row Level
   Security policies, and a trigger that removes a deleted milestone from resources' workstream links. Its
   summary should show `rls_enabled = true`, 4 policies and 1 milestone trigger.
5. `0005_storage.sql`: the private `resource-images` Storage bucket (images only, 5 MB each) and its access
   policies. Its summary should show `public = false`, `5242880` and 4 policies.
6. `0006_substreams.sql`: `milestones.parent_id`, so a workstream can hold substreams (deleting a workstream
   deletes its substreams and their tasks). Its summary should show `parent_id` as a `uuid` column.
7. `0007_collaborators.sql`: the `people` table (names of people you delegate to; Row Level Security like the
   other tables), `projects.collaborator_ids` and `tasks.assignee_id`. Deleting a person removes them from
   projects (trigger) and unassigns their tasks. Its summary should show `rls_enabled = true`, 4 policies and
   2 new columns.

Open each file on GitHub, click **Copy raw file**, paste it into an empty query and click **Run** with nothing
selected. Each part checks that the previous one ran, and every part is safe to run again. Anything that
already exists is skipped. With the Supabase CLI, `supabase db push` applies all seven.

Then create the single user in Authentication → Users (Add user, email + password, tick "Auto Confirm User")
and turn off "Allow new users to sign up". There is deliberately no sign-up flow in the app.

## Design notes

- Mirrors `src/domain/types.ts` (Snapshot). camelCase fields become snake_case columns (mappers in
  `src/data/supabaseMappers.ts`).
- Ids are client-generated uuids (optimistic writes); `default gen_random_uuid()` is only a fallback.
- Every table carries `user_id` (defaults to `auth.uid()`), and Row Level Security restricts
  select/insert/update/delete to `user_id = auth.uid()`.
- `ON DELETE CASCADE` mirrors the cascade rules documented in `src/data/changes.ts`.
- Resource images are uploaded to the private `resource-images` bucket under `<user id>/<uuid>.<ext>`; the app
  shows them through signed links that expire after an hour. Storage policies only allow a user to read and write
  their own folder. Deleting a resource row does not delete its image: the app removes it separately.
- A substream is a `milestones` row whose `parent_id` is a workstream of the same project; the app shows it as a
  card inside the workstream's card. Only one level of nesting is used.
- The system "Admin / Misc" project (`is_system`) cannot be deleted or un-flagged, and there is at most one per
  user.
