#!/bin/sh
# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0
#
# Chạy một lần khi khởi tạo PostgreSQL (docker-entrypoint-initdb.d).
# Tạo database và người dùng riêng cho Keycloak, n8n; tạo vai trò cho PostgREST.
# Lưu ý: tệp được "source" bởi entrypoint nên không dùng `set -e` ở đây.

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<EOSQL
CREATE ROLE ${KEYCLOAK_DB} LOGIN PASSWORD '${KEYCLOAK_DB_PASSWORD}';
CREATE DATABASE ${KEYCLOAK_DB} OWNER ${KEYCLOAK_DB};

CREATE ROLE ${N8N_DB} LOGIN PASSWORD '${N8N_DB_PASSWORD}';
CREATE DATABASE ${N8N_DB} OWNER ${N8N_DB};

-- Vai trò cho PostgREST: authenticator đăng nhập rồi chuyển sang anon/authenticated theo token.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '${AUTHENTICATOR_PASSWORD}';
GRANT anon, authenticated TO authenticator;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
EOSQL
