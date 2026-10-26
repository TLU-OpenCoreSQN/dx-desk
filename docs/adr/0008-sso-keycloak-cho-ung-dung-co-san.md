# 0008. SSO Keycloak cho Wiki.js, Mattermost Team Edition, Metabase OSS

- Trạng thái: QĐ-2 chốt theo tài liệu chính thức — chưa thử runtime (máy không có Docker)
- Ngày: 27/10/2026
- Người ghi: TV1 (Nền tảng và DevOps)
- Mã kế hoạch: W3-08, TN-04, QĐ-2

## Bối cảnh

Kế hoạch triển khai (mục 5.2 W3-08, TN-04) đưa ba ứng dụng "có sẵn" vào Tầng 3 của DX-OS: Wiki.js (tài liệu vận hành), Mattermost (thông báo ticket cho Agent/Manager), Metabase (báo cáo SLA). Câu hỏi QĐ-2: từng ứng dụng có thể đăng nhập một cửa qua Keycloak (OIDC) **bản miễn phí** hay không; nếu không thì dùng phương án dự phòng đã ghi trong kế hoạch. Nguyên tắc TN-04: chỉ kết luận theo tài liệu chính thức của nhà phát hành; không được suy từ blog bên thứ ba. Máy phát triển không có Docker nên toàn bộ nội dung dưới đây là kiểm chứng tài liệu, chưa phải kiểm chứng chạy thật — các mục runtime đều ghi "chờ Docker/CI".

Bản chất câu hỏi là giấy phép: cả ba ứng dụng đều open-core, tính năng SSO trưởng thành thường nằm ở gói trả phí.

## Kết quả xác minh theo nguồn chính thức

### Wiki.js — OIDC miễn phí: ĐẠT

- Repository chính thức `requarks/wiki` mang nhãn **AGPL-3.0** (GitHub API, 27/10/2026), mã nguồn phát hành dưới dạng tag ổn định mới nhất `v2.5.315`; cây thư mục tag này chứa icon và strategy OIDC ngay trong lõi miễn phí (`client/static/svg/auth-icon-oidc.svg`, `auth-icon-keycloak.svg` — Wiki.js đóng sẵn biểu tượng Keycloak cho trang đăng nhập).
- Nhánh phát triển 3.0 (`scarlett`) có module xác thực OIDC độc lập, không có phân tách "edition" trong cùng kho: `backend/modules/authentication/oidc/` (kèm `saml`, `ldap`, `local`, `entra`…). Không tìm thấy bất kỳ mô-đun xác thực nào bị tách sang kho trả phí trong tài liệu chính thức.
- Kết luận: **SSO Keycloak qua OIDC làm được ở bản miễn phí**. Cần thêm client `wikijs` vào realm (tuần 4, TV1) và cấu hình OIDC trỏ `.well-known/openid-configuration` của realm `dxdesk`. Ghi chú: trang tài liệu chiến lược xác thực (docs.requarks.io/auth) dựng bằng JavaScript nên không trích được nguyên văn trong tuần này; bằng chứng lấy từ kho mã chính thức — đủ cho kết luận "có trong bản miễn phí", còn thao tác cấu hình cụ thể chờ lúc chạy container.

### Mattermost Team Edition — SSO không thuộc bản mã nguồn mở: KHÔNG ĐẠT, dùng dự phòng

- Trang "Editions and Offerings" chính thức mô tả Team Edition là bản nguồn mở cấp phép MIT "where single sign-on (SSO) is not required" (tạm dịch: dành cho trường hợp không yêu cầu SSO) — https://docs.mattermost.com/product-overview/editions-and-offerings.
- Các trang hướng dẫn SAML và OpenID Connect trên docs.mattermost.com đều ghi dòng "Available on Entry, Professional, Enterprise, and Enterprise Advanced plans"; trang giá chính thức (mattermost.com/pricing, 27/10/2026) liệt kê SSO/OIDC và AD/LDAP ở mức Professional trở lên, còn "Entry" là chế độ miễn phí của binary **Enterprise Edition** (thương mại, "functionally equivalent to the open source Mattermost Team Edition… " theo trang self-hosted-subscriptions) — tức không phải image Team Edition mà kế hoạch đã chọn. Hai nguồn có chỗ mâu thuẫn/nhập nhằng (docs ghi cả "Entry", pricing chỉ từ Professional) — tự thân mâu thuẫn đó là tín hiệu rủi ro giấy phép, đúng loại rủi ro kế hoạch muốn tránh khi cam kết với giám khảo.
- Kết luận: **không dựa vào SAML/OIDC của Mattermost Team Edition** cho SSO demo. Áp dụng dự phòng đã chốt trong kế hoạch: Mattermost chỉ là **kênh bot thông báo ticket** — bot dùng personal access token / webhook (có trong bản miễn phí), người dùng không đăng nhập bằng Keycloak vào Mattermost trong phạm vi cam kết của đề tài. Nếu sau này cần SSO thật cho chat, chỉ còn đường binary Enterprise ở chế độ Entry (rủi ro giấy phép) hoặc thay bằng ứng dụng chat khác — ghi thành nợ cần theo dõi, không thuộc cam kết M2.

### Metabase OSS — OIDC là tính năng trả phí: KHÔNG ĐẠT, dùng dự phòng

- Trang chính thức "OIDC-based authentication" (metabase.com/docs/latest/people-and-groups/authenticating-with-oidc): "OIDC authentication is only available on Pro and Enterprise plans."
- Trang "Authentication" nguồn mở trong kho `metabase/metabase` (docs/people-and-groups/start.md): SSO cho bản Open Source/Starter chỉ gồm **Google Sign-in và LDAP**; JWT, OIDC, SAML nằm ở Pro/Enterprise. Google Sign-in trong bản miễn phí giới hạn theo miền Google Workspace, không phải OIDC tổng quát nên không khớp thẳng vào Keycloak realm `dxdesk` như một IdP bất kỳ.
- Kết luận: **Metabase OSS không làm được SSO Keycloak chuẩn OIDC miễn phí**. Dự phòng theo kế hoạch: Metabase chạy với tài khoản nội bộ cho demo; dashboard nghiệp vụ expose bằng **linked/embedded question dùng token chia sẻ** (có trong bản mã nguồn mở), đăng nhập Metabase không qua Keycloak. Phương án thay thế nếu tiêu chí giám khảo bắt buộc SSO đủ mọi ứng dụng: **Apache Superset** (mã nguồn mở Apache 2.0, hỗ trợ OIDC qua Flask-AppBuilder `AUTH_OIDC` trong chính tài liệu chính thức superset.apache.org) — chưa đánh giá chi tiết, ghi là lựa chọn dự phòng cấp 2, chờ PoC Docker.

## Quyết định (QĐ-2)

| Ứng dụng | SSO Keycloak bản miễn phí? | Quyết định cho demo |
|---|---|---|
| Wiki.js | Có (OIDC trong lõi AGPL) | Nối SSO Keycloak ở tuần 4 (thêm client `wikijs` vào realm) |
| Mattermost Team Edition | Không chắc chắn, theo tài liệu là không thuộc bản nguồn mở | Chỉ dùng làm kênh bot thông báo ticket (API token miễn phí), không hứa SSO |
| Metabase OSS | Không (OIDC chỉ có ở Pro/Enterprise) | Tài khoản nội bộ + dashboard nhúng/token chia sẻ; Superset là dự phòng cấp 2 nếu buộc phải SSO |

Quyết định chưa đụng tới `infra/compose/docker-compose.yml`: ba ứng dụng sẽ được bổ sung nguyên tử trong tuần 4 kèm cấu hình OIDC/tài khoản, để tránh thay đổi Tầng 1 khi chưa có Docker kiểm chứng.

## Phương án đã xem xét

| Phương án | Ưu điểm | Nhược điểm | Kết luận |
|---|---|---|---|
| Cả ba đều SSO Keycloak | Đẹp nhất trên slide | Hai trong ba ứng dụng cần gói trả phí theo tài liệu chính thức | Loại |
| Chốt theo tài liệu, dự phòng theo kế hoạch (làm ở trên) | Không vi phạm giấy phép; demo vẫn đủ 3 ứng dụng ở mức đã cam kết; rủi ro được ghi rõ | Câu chuyện "SSO toàn Tầng 3" chỉ thật với Wiki.js | **Chọn** |
| Chuyển hết sang binary "Entry" của Mattermost EE + tự xây lớp SSO phía trước Metabase | Đỡ được phần cứng | Mâu thuẫn giấy phép nhập nhằng; thêm tầng reverse-proxy tự xây vượt phạm vi sinh viên 3 người | Loại |

## Kết quả

- Biên bản tài liệu hoàn thành, đủ nguồn dẫn từng nhận định (mục trên). Không có kiểm chứng runtime: không Docker trên máy; toàn bộ quyền cấu hình OIDC thực tế (client `wikijs`, màn hình đăng nhập Keycloak của Wiki.js, token bot Mattermost, trang admin Metabase) **chờ Docker/CI**.
- Harness `tools/testing/check-config.mjs` PASS (realm hiện hành không đổi phần client; chưa thêm client `wikijs` vì ứng dụng chưa chạy).

## Hệ quả

- Tiêu chí M2/TN-04 đạt ở mức "kết luận có bằng chứng tài liệu + dự phòng đã định", đúng tinh thần kế hoạch; không tổng kết sai rằng "cả stack đều SSO".
- Việc kế tiếp (tuần 4, cần Docker): thêm client `wikijs` realm; chạy thử Wiki.js + OIDC; xác nhận lại một lần nữa trạng thái giấy phép Mattermost khi dựng image thật (nếu Entry cho phép SAML miễn phí thì nâng quyết định Mattermost — ghi lại bằng ADR mới thay 0008); đo RAM ba ứng dụng cho TN-05.

## Nguồn tham khảo chính thức

- Wiki.js repository (AGPL-3.0; tag v2.5.315; module OIDC trong lõi): https://github.com/requarks/wiki
- Mattermost — Editions and Offerings: https://docs.mattermost.com/product-overview/editions-and-offerings
- Mattermost — OpenID Connect Single Sign-On: https://docs.mattermost.com/administration-guide/onboard/sso-openidconnect
- Mattermost — SAML Single Sign-On: https://docs.mattermost.com/administration-guide/onboard/sso-saml
- Mattermost — Self-hosted subscriptions (Entry là bản EE thương mại miễn phí): https://docs.mattermost.com/product-overview/self-hosted-subscriptions
- Mattermost pricing (SSO/OIDC từ Professional): https://mattermost.com/pricing/
- Metabase — OIDC-based authentication: https://www.metabase.com/docs/latest/people-and-groups/authenticating-with-oidc
- Metabase — start.md trong kho chính thức (SSO cho Open Source/Starter): https://github.com/metabase/metabase/blob/master/docs/people-and-groups/start.md
- Metabase — Google Sign-In: https://www.metabase.com/docs/latest/people-and-groups/google-sign-in
- Apache Superset — OIDC (dự phòng cấp 2 cho lớp báo cáo): https://superset.apache.org/docs/security/
