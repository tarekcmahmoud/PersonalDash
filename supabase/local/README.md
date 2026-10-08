# Local Supabase stand-in (for testing `supabaseRepo`)

A throwaway stack that runs the real data layer against the real migrations without a Supabase project. It is
for development only. It is not part of the app or of the setup guide.

- Postgres 16 with `stub.sql`. The stub provides the API roles, `auth.users` with two users, `auth.uid()`, a
  minimal `storage` schema and Supabase's default grants. Then `supabase/migrations/*.sql` run twice.
- PostgREST (the same REST server Supabase uses) on port 54321. Its config is `postgrest.conf`.
- `gateway.mjs` on port 54320. It serves `/rest/v1/*` from PostgREST. It also fakes the few GoTrue endpoints
  that `supabase-js` calls for email and password sign-in. The users are `a@x.com` and `b@x.com`, and both
  passwords are `pw`.

Not covered: Storage uploads and signed URLs (there is no storage server), real GoTrue, and Google Calendar.

## Run

```sh
supabase/local/start.sh /some/empty/dir
SUPABASE_LOCAL_URL=http://localhost:54320 npx vitest run src/data/supabaseRepo.local.test.ts
```

`src/data/supabaseRepo.local.test.ts` is skipped in `npm test` unless `SUPABASE_LOCAL_URL` is set.

Requirements: Postgres 16 binaries in `/usr/lib/postgresql/16/bin` (or set `PGBIN`), Node, and network access to
GitHub for the PostgREST download on the first run. When the script runs as root, Postgres runs as the
`postgres` user, so every directory above the work dir needs `o+x`.

To run the app against the stack, use `npm run dev` with this `.env.local`. The anon key is a JWT with
`{"role":"anon"}`, signed with the secret in `postgrest.conf`.

```text
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=http://localhost:54320
VITE_SUPABASE_ANON_KEY=<anon JWT>
```
