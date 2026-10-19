#!/bin/sh
# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0
#
# Sinh các tệp cấu hình cần giá trị từ .env (không lưu bí mật vào kho mã):
#   - infra/seaweedfs/s3.json   danh tính S3 cho SeaweedFS
#   - infra/postgrest/jwks.json giá trị tạm; scripts/sync-jwks.sh thay bằng khóa thật của Keycloak
set -eu

ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)/}"
set -a
# shellcheck disable=SC1091
. "${ROOT}.env"
set +a

cat > "${ROOT}infra/seaweedfs/s3.json" <<EOF
{
  "identities": [
    {
      "name": "dxdesk",
      "credentials": [
        { "accessKey": "${S3_ACCESS_KEY}", "secretKey": "${S3_SECRET_KEY}" }
      ],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
EOF

if [ ! -s "${ROOT}infra/postgrest/jwks.json" ]; then
  printf '{"keys":[]}\n' > "${ROOT}infra/postgrest/jwks.json"
fi
