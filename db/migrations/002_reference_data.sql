-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
INSERT INTO public.categories(id, code, name, description) VALUES
('10000000-0000-4000-8000-000000000001', 'vpn', 'Kết nối VPN', 'Không kết nối được mạng nội bộ từ xa'),
('10000000-0000-4000-8000-000000000002', 'account', 'Tài khoản', 'Đăng nhập và quyền truy cập'),
('10000000-0000-4000-8000-000000000003', 'hardware', 'Thiết bị', 'Sự cố máy tính và thiết bị ngoại vi'),
('10000000-0000-4000-8000-000000000004', 'software', 'Phần mềm', 'Cài đặt và lỗi phần mềm');
INSERT INTO public.sla_policies(priority, response_minutes, resolution_minutes) VALUES
('low', 480, 2880), ('normal', 240, 1440), ('high', 60, 480), ('critical', 15, 120);
INSERT INTO public.routing_rules(category_id, team) VALUES
('10000000-0000-4000-8000-000000000001', 'Network Team'),
('10000000-0000-4000-8000-000000000002', 'Identity Team'),
('10000000-0000-4000-8000-000000000003', 'IT Support'),
('10000000-0000-4000-8000-000000000004', 'IT Support');
