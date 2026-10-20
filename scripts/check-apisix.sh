#!/bin/sh
# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0
#
# Kiểm tra infra/apisix/apisix.yaml bằng chính image APISIX trong .env.example:
#   1. tệp kết thúc bằng dòng #END (thiếu thì APISIX bỏ qua cả tệp);
#   2. APISIX nạp được tệp: route /healthz (khai báo trong apisix.yaml) trả về "ok";
#   3. nhật ký không có lỗi cú pháp hoặc lỗi schema;
#   4. mọi uri khai báo trong tệp đều có route (không trả về 404).
# Chạy: sh scripts/check-apisix.sh   (cần docker và curl; không cần .env)
set -eu

ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)/}"
PORT="${APISIX_CHECK_PORT:-19080}"
NAME="dx-desk-apisix-check"
ROUTES="${ROOT}infra/apisix/apisix.yaml"

VERSION="$(sed -n 's/^APISIX_VERSION=//p' "${ROOT}.env.example")"
[ -n "$VERSION" ] || { echo "Không đọc được APISIX_VERSION từ .env.example" >&2; exit 1; }

if [ "$(tail -n 1 "$ROUTES" | tr -d '\r')" != "#END" ]; then
  echo "${ROUTES} phải kết thúc bằng dòng #END" >&2
  exit 1
fi

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run -d --name "$NAME" -p "127.0.0.1:${PORT}:9080" \
  -v "${ROOT}infra/apisix/config.yaml:/usr/local/apisix/conf/config.yaml:ro" \
  -v "${ROUTES}:/usr/local/apisix/conf/apisix.yaml:ro" \
  "apache/apisix:${VERSION}" >/dev/null

ready=""
for _ in $(seq 1 30); do
  if [ "$(curl -s "http://127.0.0.1:${PORT}/healthz" || true)" = "ok" ]; then ready=1; break; fi
  sleep 1
done

LOG="$(docker logs "$NAME" 2>&1)"
if [ -z "$ready" ]; then
  echo "APISIX không nạp được apisix.yaml (/healthz không trả về ok sau 30 giây):" >&2
  echo "$LOG" | tail -n 30 >&2
  exit 1
fi

# Chờ thêm một nhịp để các lỗi khi nạp route kịp ghi vào nhật ký.
sleep 2
LOG="$(docker logs "$NAME" 2>&1)"
if echo "$LOG" | grep -E 'failed to (check|parse|read)|invalid|\[error\]' >&2; then
  echo "Nhật ký APISIX có lỗi cấu hình ở trên." >&2
  exit 1
fi

status=0
for uri in $(sed -n 's/^[[:space:]]*uri:[[:space:]]*//p' "$ROUTES" | tr -d '\r'); do
  probe="$(printf '%s' "$uri" | sed 's/\*/probe/')"
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}${probe}" || true)"
  if [ "$code" = "404" ]; then
    echo "Route ${uri} khai báo trong apisix.yaml nhưng APISIX không nạp (404)" >&2
    status=1
  else
    echo "OK ${uri} -> HTTP ${code}"
  fi
done
exit "$status"
