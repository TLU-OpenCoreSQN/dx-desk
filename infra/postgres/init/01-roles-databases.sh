#!/bin/sh
# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0
#
# Chạy một lần khi khởi tạo PostgreSQL (docker-entrypoint-initdb.d).
# Tạo database và người dùng riêng cho Keycloak, n8n; tạo vai trò cho PostgREST.
# Lưu ý: tệp được "source" bởi entrypoint nên không dùng `set -e` ở đây.

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v keycloak_db="$KEYCLOAK_DB" -v keycloak_password="$KEYCLOAK_DB_PASSWORD" \
  -v n8n_db="$N8N_DB" -v n8n_password="$N8N_DB_PASSWORD" \
  -v authenticator_password="$AUTHENTICATOR_PASSWORD" -v api_password="$API_DB_PASSWORD" <<'EOSQL'
CREATE ROLE :"keycloak_db" LOGIN PASSWORD :'keycloak_password';
CREATE DATABASE :"keycloak_db" OWNER :"keycloak_db";

CREATE ROLE :"n8n_db" LOGIN PASSWORD :'n8n_password';
CREATE DATABASE :"n8n_db" OWNER :"n8n_db";

-- Vai trò cho PostgREST: authenticator đăng nhập rồi chuyển sang anon/authenticated theo token.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE authenticator LOGIN NOINHERIT NOBYPASSRLS PASSWORD :'authenticator_password';
CREATE ROLE api_login LOGIN NOINHERIT NOBYPASSRLS PASSWORD :'api_password';
GRANT anon, authenticated TO authenticator;
GRANT authenticated TO api_login;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
EOSQL
