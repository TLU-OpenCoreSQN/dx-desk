#!/bin/sh
# SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
# SPDX-License-Identifier: Apache-2.0
#
# Chạy các tệp SQL trong db/migrations rồi db/policies theo thứ tự tên tệp
# (đặt tên 001_..., 002_...). Chỉ chạy khi PostgreSQL được khởi tạo lần đầu;
# `make reset` xóa dữ liệu để chạy lại từ đầu.

for dir in /migrations /policies; do
  for f in "$dir"/*.sql; do
    [ -e "$f" ] || continue
    echo "Áp dụng $f"
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
  done
done
