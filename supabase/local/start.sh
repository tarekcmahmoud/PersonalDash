#!/usr/bin/env bash
# Starts a throwaway local "Supabase": Postgres 16 with stubbed auth/storage schemas and the five migrations
# (each applied twice, to prove they are re-runnable), PostgREST, and a tiny auth gateway. See README.md.
#
# Usage: supabase/local/start.sh <work-dir>
set -euo pipefail

WORK=$(realpath -m "${1:?usage: start.sh <work-dir>}")
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGRST_VERSION=v12.2.3
PG_PORT=54329

as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }

mkdir -p "$WORK"
if [ "$(id -u)" = 0 ]; then chown postgres "$WORK"; fi
as_pg "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
as_pg "$PGBIN/pg_ctl" -D "$WORK/data" -l "$WORK/postgres.log" \
  -o "-p $PG_PORT -k $WORK -c listen_addresses=localhost" start >/dev/null

PSQL=("$PGBIN/psql" -h localhost -p "$PG_PORT" -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null)
"${PSQL[@]}" -f "$HERE/stub.sql"
for run in 1 2; do
  for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f" 2>/dev/null; done
done

if [ ! -x "$WORK/postgrest" ]; then
  curl -sSL "https://github.com/PostgREST/postgrest/releases/download/$PGRST_VERSION/postgrest-$PGRST_VERSION-linux-static-x64.tar.xz" |
    tar -xJ -C "$WORK"
fi
nohup "$WORK/postgrest" "$HERE/postgrest.conf" >"$WORK/postgrest.log" 2>&1 &
nohup node "$HERE/gateway.mjs" >"$WORK/gateway.log" 2>&1 &
sleep 2
echo "Ready: SUPABASE_LOCAL_URL=http://localhost:54320 (users a@x.com and b@x.com, password pw)"
