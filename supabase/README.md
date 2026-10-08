# Database setup (Supabase)

Run the three files in `migrations/` **in order**, each as its own query in Supabase → SQL Editor → New query:

1. `0001_core_tables.sql`: types, `projects`, `milestones`, `tasks`
2. `0002_more_tables.sql`: `task_dependencies`, `checklist_items`, `templates`, `weeks`, `settings`
3. `0003_security.sql`: the system-project guard and Row Level Security. It ends with a summary that should
   list 8 tables, each with `rls_enabled = true` and 4 policies.

Open each file on GitHub, click **Copy raw file**, paste it into an empty query and click **Run** with nothing
selected. Each part checks that the previous one ran, and every part is safe to run again. Anything that
already exists is skipped. With the Supabase CLI, `supabase db push` applies all three.

Then create the single user in Authentication → Users (Add user, email + password, tick "Auto Confirm User")
and turn off "Allow new users to sign up". There is deliberately no sign-up flow in the app.

## Design notes

- Mirrors `src/domain/types.ts` (Snapshot). camelCase fields become snake_case columns (mappers in
  `src/data/supabaseMappers.ts`).
- Ids are client-generated uuids (optimistic writes); `default gen_random_uuid()` is only a fallback.
- Every table carries `user_id` (defaults to `auth.uid()`), and Row Level Security restricts
  select/insert/update/delete to `user_id = auth.uid()`.
- `ON DELETE CASCADE` mirrors the cascade rules documented in `src/data/changes.ts`.
- The system "Admin / Misc" project (`is_system`) cannot be deleted or un-flagged, and there is at most one per
  user.
