#!/bin/sh
# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0
#
# PostgREST không tải khóa công khai từ URL, nên lấy JWKS của realm Keycloak về tệp,
# rồi khởi động lại PostgREST nếu khóa thay đổi (ví dụ sau `make reset`).
set -eu

ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)/}"
set -a
# shellcheck disable=SC1090,SC1091
. "${ROOT}.env"
set +a

URL="http://localhost:${KEYCLOAK_PORT}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs"
TARGET="${ROOT}infra/postgrest/jwks.json"
TMP="${TARGET}.new"

curl -sf "$URL" -o "$TMP" || { echo "Không lấy được JWKS từ $URL" >&2; rm -f "$TMP"; exit 1; }

if cmp -s "$TMP" "$TARGET"; then
  rm -f "$TMP"
else
  # Ghi đè nội dung (giữ nguyên inode) vì tệp được bind-mount vào container PostgREST.
  cat "$TMP" > "$TARGET"
  rm -f "$TMP"
  docker compose --env-file "${ROOT}.env" -f "${ROOT}infra/compose/docker-compose.yml" restart postgrest
fi
