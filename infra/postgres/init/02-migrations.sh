#!/bin/sh
# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0
#
# Initial bootstrap and repeatable `make migrate`. Each file is atomic and checksummed.
# Sourced by postgres entrypoint; variables are prefixed to avoid clobbering its state.
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v api_password="$API_DB_PASSWORD" <<'SQL'
-- Supports upgrading a week-2 foundation volume created before api_login existed.
SELECT 'CREATE ROLE api_login LOGIN NOINHERIT NOBYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_login')
\gexec
ALTER ROLE api_login NOINHERIT NOBYPASSRLS PASSWORD :'api_password';
GRANT authenticated TO api_login;
CREATE SCHEMA IF NOT EXISTS migration_meta;
REVOKE ALL ON SCHEMA migration_meta FROM PUBLIC;
CREATE TABLE IF NOT EXISTS migration_meta.applied (
  name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
);
SQL
migration_status=$?
[ "$migration_status" -eq 0 ] || exit "$migration_status"
for migration_dir in "${MIGRATIONS_DIR:-/migrations}" "${POLICIES_DIR:-/policies}"; do
  for migration_file in "$migration_dir"/*.sql; do
    [ -e "$migration_file" ] || continue
    migration_name="$(basename "$migration_dir")/$(basename "$migration_file")"
    migration_hash="$(sha256sum "$migration_file" | cut -d ' ' -f 1)"
    psql -X -v ON_ERROR_STOP=1 --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      -v name="$migration_name" -v checksum="$migration_hash" -v file="$migration_file" <<'SQL'
SELECT pg_advisory_xact_lock(20261021);
SELECT EXISTS(SELECT 1 FROM migration_meta.applied WHERE name = :'name') AS already_applied,
       EXISTS(SELECT 1 FROM migration_meta.applied WHERE name = :'name' AND checksum <> :'checksum') AS changed
\gset
\if :changed
  \echo 'ERROR: applied migration changed. Add a new migration instead.'
  DO $$ BEGIN RAISE EXCEPTION 'migration checksum mismatch'; END $$;
\endif
\if :already_applied
  \echo 'Skip' :name
\else
  \echo 'Apply' :name
  \i :file
  INSERT INTO migration_meta.applied(name, checksum) VALUES (:'name', :'checksum');
\endif
SQL
    migration_status=$?
    [ "$migration_status" -eq 0 ] || exit "$migration_status"
  done
done
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "NOTIFY pgrst, 'reload schema';"
