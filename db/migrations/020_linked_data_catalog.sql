-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- W5-04: dữ liệu tham chiếu cho JSON-LD/DCAT công khai tại /ld/*.
-- Người ẩn danh không có JWT nên không đi qua RLS của authenticated. Chỉ api_login
-- được gọi hai hàm SECURITY DEFINER dưới đây, và hàm chỉ trả cột công khai của dữ
-- liệu tham chiếu (danh mục đang dùng, loại thiết bị, chính sách SLA, mô tả bộ dữ
-- liệu giả lập). Không đọc phiếu, người dùng hay sự kiện thật.

-- Loại thiết bị: trước đây chỉ là CHECK của device_requests. Bảng tham chiếu đặt
-- trong schema private (PostgREST không phơi ra) và khóa ngoại giữ hai nơi đồng bộ.
CREATE TABLE private.device_types (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_-]{1,39}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  active boolean NOT NULL DEFAULT true
);
INSERT INTO private.device_types(code, name) VALUES
('laptop', 'Máy tính xách tay'), ('monitor', 'Màn hình'), ('keyboard', 'Bàn phím'),
('mouse', 'Chuột'), ('other', 'Thiết bị khác');
ALTER TABLE public.device_requests ADD CONSTRAINT device_requests_device_type_fkey
  FOREIGN KEY (device_type) REFERENCES private.device_types(code);

-- Mô tả ba bộ dữ liệu giả lập trong danh mục DCAT. Bản phân phối là tệp tĩnh do
-- scripts/export-demo-samples.mjs sinh ở apps/web/public/data/synthetic/{code}.json.
CREATE TABLE private.linked_datasets (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9-]{1,39}$'),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 1000),
  license_url text NOT NULL CHECK (license_url ~ '^https://[^\s@]+$'),
  modified date NOT NULL,
  sort_order smallint NOT NULL UNIQUE
);
INSERT INTO private.linked_datasets(code, title, description, license_url, modified, sort_order) VALUES
('tickets', 'Phiếu hỗ trợ',
 'Mẫu phiếu VPN trước và sau khi cập nhật client trong kịch bản giả lập.',
 'https://creativecommons.org/publicdomain/zero/1.0/', DATE '2026-11-02', 1),
('ticket-events', 'Sự kiện phiếu hỗ trợ',
 'Mẫu lịch sử phân loại, phân công, nhận việc và giải quyết của các phiếu giả lập.',
 'https://creativecommons.org/publicdomain/zero/1.0/', DATE '2026-11-02', 2),
('sla-policies', 'Chính sách SLA',
 'Mẫu thời hạn phản hồi và xử lý theo mức ưu tiên của cấu hình demo.',
 'https://creativecommons.org/publicdomain/zero/1.0/', DATE '2026-11-02', 3);
REVOKE ALL ON private.device_types, private.linked_datasets FROM PUBLIC;

-- Một tài nguyên theo nhóm URI (services | request-types | device-types) và mã.
-- Danh mục ngừng dùng (active = false) coi như không tồn tại.
CREATE FUNCTION private.linked_resource(p_kind text, p_code text)
RETURNS TABLE(code text, name text, description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT c.code, c.name, c.description FROM public.categories c
   WHERE p_kind IN ('services', 'request-types') AND c.code = p_code AND c.active
  UNION ALL
  SELECT d.code, d.name, ''::text FROM private.device_types d
   WHERE p_kind = 'device-types' AND d.code = p_code AND d.active
$$;

-- Ba bộ dữ liệu của danh mục; mô tả SLA ghép số mức ưu tiên từ sla_policies.
CREATE FUNCTION private.linked_catalog()
RETURNS TABLE(code text, title text, description text, license_url text, modified date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT d.code, d.title,
         d.description || CASE WHEN d.code = 'sla-policies' THEN coalesce((
           SELECT format(' Gồm %s mức ưu tiên: %s.', count(*),
                         string_agg(s.priority, ', ' ORDER BY s.response_minutes DESC))
             FROM public.sla_policies s HAVING count(*) > 0), '') ELSE '' END,
         d.license_url, d.modified
    FROM private.linked_datasets d ORDER BY d.sort_order
$$;
REVOKE ALL ON FUNCTION private.linked_resource(text, text), private.linked_catalog() FROM PUBLIC, authenticated, anon;
GRANT USAGE ON SCHEMA private TO api_login;
GRANT EXECUTE ON FUNCTION private.linked_resource(text, text), private.linked_catalog() TO api_login;
