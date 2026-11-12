#!/usr/bin/env bash
# Runs supabase/tests/sync.test.sql against a throwaway local Postgres (needs a local postgres server).
set -euo pipefail
cd "$(dirname "$0")/.."
as_pg() { if [ "$(id -un)" = postgres ]; then "$@"; elif command -v sudo >/dev/null; then sudo -u postgres "$@"; else su postgres -c "$*"; fi; }
as_pg dropdb --if-exists elbow_sync_test
as_pg createdb elbow_sync_test
as_pg psql -q -v ON_ERROR_STOP=1 -d elbow_sync_test -f "$PWD/supabase/tests/sync.test.sql"
