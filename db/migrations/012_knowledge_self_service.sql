-- SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
-- SPDX-License-Identifier: Apache-2.0
-- W5-08: bài tri thức Wiki.js gợi ý theo danh mục và lượt "Đã tự xử lý được".
-- Ánh xạ danh mục -> bài là dữ liệu tham chiếu, giao diện không viết cứng.

CREATE TABLE public.knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9-]{1,59}$'),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 500),
  -- Đường dẫn trang trong Wiki.js (không gồm máy chủ); API ghép với WIKI_PUBLIC_URL.
  wiki_path text NOT NULL UNIQUE CHECK (wiki_path ~ '^[a-z0-9][a-z0-9/-]{0,199}$'),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.category_articles (
  category_id uuid NOT NULL REFERENCES public.categories(id),
  article_id uuid NOT NULL REFERENCES public.knowledge_articles(id),
  sort_order smallint NOT NULL DEFAULT 1 CHECK (sort_order BETWEEN 1 AND 20),
  PRIMARY KEY (category_id, article_id)
);
CREATE TABLE public.self_service_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT private.user_id(),
  category_id uuid NOT NULL,
  article_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Chỉ ghi nhận cặp danh mục/bài đã được gợi ý, không nhận bài tùy ý.
  FOREIGN KEY (category_id, article_id) REFERENCES public.category_articles(category_id, article_id)
);
CREATE INDEX self_service_user_created_idx ON public.self_service_resolutions(user_id, created_at DESC);
CREATE INDEX self_service_created_idx ON public.self_service_resolutions(created_at);

INSERT INTO public.knowledge_articles(id, slug, title, summary, wiki_path) VALUES
('20000000-0000-4000-8000-000000000001', 'vpn', 'Kết nối VPN của trường từ xa',
 'Cài OpenVPN, nhập hồ sơ cấu hình và xử lý lỗi xác thực, lỗi hết thời gian kết nối.', 'ho-tro/vpn'),
('20000000-0000-4000-8000-000000000002', 'email', 'Hộp thư điện tử của trường',
 'Đăng nhập webmail, cấu hình ứng dụng thư trên điện thoại, xử lý thư không gửi được.', 'ho-tro/email'),
('20000000-0000-4000-8000-000000000003', 'wifi', 'Kết nối Wi-Fi trong khuôn viên',
 'Chọn đúng mạng, đăng nhập bằng tài khoản trường, quên mạng cũ khi đổi mật khẩu.', 'ho-tro/wifi'),
('20000000-0000-4000-8000-000000000004', 'lms', 'Hệ thống học tập trực tuyến (LMS)',
 'Đăng nhập LMS, không thấy lớp học phần, nộp bài bị lỗi và giới hạn dung lượng tệp.', 'ho-tro/lms'),
('20000000-0000-4000-8000-000000000005', 'mat-khau', 'Đổi và khôi phục mật khẩu tài khoản trường',
 'Quy tắc mật khẩu, tự đổi mật khẩu, tài khoản bị khóa sau nhiều lần nhập sai.', 'ho-tro/mat-khau'),
('20000000-0000-4000-8000-000000000006', 'phan-mem-ban-quyen', 'Phần mềm bản quyền của trường',
 'Danh sách phần mềm trường cấp phép, cách kích hoạt và khi nào cần gửi yêu cầu cài đặt.', 'ho-tro/phan-mem-ban-quyen');

INSERT INTO public.category_articles(category_id, article_id, sort_order) VALUES
('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1), -- vpn -> VPN
('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 2), -- vpn -> Wi-Fi
('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005', 1), -- account -> mật khẩu
('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 2), -- account -> email
('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 3), -- account -> LMS
('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 1), -- hardware -> Wi-Fi
('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000006', 1), -- software -> bản quyền
('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 1), -- access -> mật khẩu
('10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000004', 1), -- system-error -> LMS
('10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', 2); -- system-error -> email

ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_service_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_articles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.category_articles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.self_service_resolutions FORCE ROW LEVEL SECURITY;

CREATE POLICY articles_read ON public.knowledge_articles FOR SELECT TO authenticated
USING (private.user_id() IS NOT NULL AND (active OR private.is_staff()));
CREATE POLICY category_articles_read ON public.category_articles FOR SELECT TO authenticated
USING (private.user_id() IS NOT NULL);
-- Mỗi người chỉ thấy lượt của chính mình; số liệu tổng hợp đi qua view reporting.
CREATE POLICY self_service_read ON public.self_service_resolutions FOR SELECT TO authenticated
USING (user_id = private.user_id());
CREATE POLICY self_service_create ON public.self_service_resolutions FOR INSERT TO authenticated WITH CHECK (
  user_id = private.user_id()
  AND (private.has_role('Employee') OR private.is_staff())
  AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.active)
  AND EXISTS (SELECT 1 FROM public.knowledge_articles a WHERE a.id = article_id AND a.active)
);
GRANT SELECT ON public.knowledge_articles, public.category_articles, public.self_service_resolutions TO authenticated;
-- Không cho tự đặt user_id/created_at: chủ thể luôn lấy từ JWT đã xác minh.
GRANT INSERT (category_id, article_id) ON public.self_service_resolutions TO authenticated;

-- Báo cáo cho Metabase (W5-06): chỉ số đếm theo tuần, không có định danh người dùng.
CREATE SCHEMA IF NOT EXISTS reporting;
REVOKE ALL ON SCHEMA reporting FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reporting_reader') THEN
    CREATE ROLE reporting_reader NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA reporting TO reporting_reader;
CREATE VIEW reporting.self_service_weekly AS
SELECT date_trunc('week', r.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS week_start,
       c.code AS category_code, a.slug AS article_slug, count(*)::bigint AS resolutions,
       count(DISTINCT r.user_id)::bigint AS distinct_users
FROM public.self_service_resolutions r
JOIN public.categories c ON c.id = r.category_id
JOIN public.knowledge_articles a ON a.id = r.article_id
GROUP BY 1, 2, 3;
REVOKE ALL ON reporting.self_service_weekly FROM PUBLIC;
GRANT SELECT ON reporting.self_service_weekly TO reporting_reader;
