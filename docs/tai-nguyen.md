# Tài nguyên stack — W4-09 (TN-05)

- Mã việc: W4-09 (issue #23), đầu vào cho TN-05 vòng 2 (W6-05). Người đo: Nguyên.
- Ngày đo: 03/11/2026. Commit: `6a4f5a7` (v0.1.0) cộng tài liệu của PR này, không đổi mã dịch vụ.
- **Số đo tạm:** đo trên máy dev, chưa phải máy demo được duyệt (`target_machine_approved: false`).

## Máy đo

| Mục | Giá trị |
|---|---|
| CPU | Intel Core i7-1360P, 16 luồng |
| RAM vật lý | 16 GB (15,66 GiB hệ điều hành thấy) |
| Hệ điều hành | Windows 11 Pro 10.0.26300 |
| Docker | Docker Desktop, Engine 29.8.2, Compose v5.6.0, backend WSL2 |
| RAM cấp cho Docker | 7,59 GiB (mặc định Docker Desktop, không có `.wslconfig`) |

RAM host dùng 14,3–15,0 GiB trong lúc đo, nhưng gồm cả IDE, trình duyệt và VM WSL;
không cộng số host với tổng container.

## Cách đo

1. Dựng stack sạch bằng `node scripts/dxdesk.mjs up` từ `.env.example` (project Compose riêng, volume mới).
2. Chạy luồng VPN tuần 4 bằng `node tools/testing/week4-stack.mjs` (8/8 kiểm thử đạt ở cả hai hồ sơ):
   tạo phiếu VPN, phân công Network Team, bot Mattermost, claim, phê duyệt, khởi động lại n8n, SLA.
3. Ngay sau đó: `node scripts/benchmark-stack.mjs --profile=<hồ sơ> --project=<project> --duration=30 --interval=1000`.
4. Đổi `COMPOSE_PROFILES=full` trong `.env`, chạy lại `up` (thêm Ollama), lặp bước 2–3.

Mỗi lượt lấy 14 mẫu trong 30 giây: một lệnh `docker stats` trên Docker Desktop mất khoảng
2 giây nên không đạt nhịp 1 giây. Đỉnh là đỉnh của các mẫu, có thể bỏ sót đỉnh ngắn giữa hai mẫu.
JSON/CSV gốc nằm ở `.local/reports/stack-memory-*.json|csv` trên máy đo (không đưa vào git).

## RAM theo dịch vụ (MiB)

| Dịch vụ | `demo-light` đỉnh | `demo-light` TB | `full` đỉnh | `full` TB |
|---|---:|---:|---:|---:|
| clamav | 1013 | 1013 | 933 | 933 |
| keycloak | 853 | 853 | 782 | 781 |
| mattermost | 418 | 368 | 223 | 223 |
| n8n | 411 | 409 | 417 | 415 |
| apisix | 343 | 342 | 346 | 346 |
| postgres | 98 | 98 | 92 | 91 |
| mattermost-db | 70 | 70 | 64 | 61 |
| api | 45 | 45 | 65 | 51 |
| seaweedfs | 29 | 29 | 36 | 36 |
| web | 13 | 13 | 13 | 13 |
| postgrest | 12 | 11 | 10 | 9 |
| ollama (chưa nạp mô hình) | — | — | 29 | 29 |
| **Tổng container** | **3300** | **3249** | **3003** | **2988** |

`n8n-import` và `n8n-publish` là job một lần, đã thoát nên không tính.

Đọc bảng:

- Hai hồ sơ chênh nhau gần như chỉ do thời điểm: lượt `full` dựng lại container, Mattermost
  và Keycloak chưa "ấm" như lượt `demo-light`. Ollama khi chưa nạp mô hình chỉ ~29 MiB.
- ClamAV (~1 GB, chủ yếu cơ sở dữ liệu chữ ký) và Keycloak (~0,8 GB, JVM) chiếm hơn một nửa tổng.
- Cả hai hồ sơ dùng ~3 GiB, dưới mức 7,59 GiB Docker Desktop cấp mặc định trên máy 16 GB.

## Bổ sung tuần 5 — Wiki.js (W5-08, 04/11/2026)

Một lần chụp `docker stats --no-stream` trên máy dev, hồ sơ `full` (chưa nạp mô hình), sau khi
`up` nạp 6 bài và chạy `tools/testing/week5-wiki.mjs`. **Một mẫu, chưa phải ba lượt** như quy trình
W4-09; số đo đủ quy trình ở mục *Đo lại tuần 5* bên dưới.

| Dịch vụ | MiB |
|---|---|
| wikijs | 151 |
| wiki-db | 40 |
| **Cộng thêm do Wiki.js** | **~191** |

Tổng container lúc chụp khoảng 3,8 GiB (gồm ClamAV ~1,0 GiB, Keycloak ~0,7 GiB). Wiki.js không
làm thay đổi kết luận ngân sách 16 GB.

## Đo lại tuần 5 — Wiki.js + Metabase (W5-09, 12/11/2026)

Cùng máy dev và Docker Desktop như bảng W4-09. Commit nguồn `4a4f2dc` (`develop-nguyenpn`, gồm PR #38
và nội dung PR #39). Stack dev hiện có (không dựng project mới), mỗi hồ sơ: `up`, chạy
`week4-stack` (8/8) và `week5-wiki` (5/5) — riêng `full` chạy thêm `week5-metabase` (thoát 0) —
rồi **ba lượt** `benchmark-stack.mjs --duration=30 --interval=1000` liên tiếp (44 mẫu mỗi hồ sơ).
Đổi hồ sơ bằng cách dừng Metabase/Ollama và chạy lại `up` với `COMPOSE_PROFILES=demo-light`.
**Chưa có ứng dụng 2 (W5-01)**; Ollama chưa nạp mô hình. Vẫn là số đo tạm.

| Dịch vụ (MiB) | `demo-light` đỉnh | `demo-light` TB | `full` đỉnh | `full` TB |
|---|---:|---:|---:|---:|
| clamav | 842 | 838 | 838 | 838 |
| keycloak | 658 | 653 | 618 | 617 |
| n8n | 430 | 427 | 425 | 423 |
| apisix | 351 | 346 | 343 | 340 |
| mattermost | 215 | 215 | 227 | 223 |
| wikijs | 209 | 204 | 211 | 200 |
| seaweedfs | 143 | 143 | 142 | 142 |
| postgres | 69 | 68 | 76 | 76 |
| api | 54 | 54 | 94 | 83 |
| mattermost-db | 42 | 42 | 50 | 45 |
| wiki-db | 32 | 30 | 35 | 30 |
| postgrest | 12 | 11 | 22 | 18 |
| web | 15 | 15 | 15 | 15 |
| metabase | — | — | 1274 | 1271 |
| metabase-db | — | — | 115 | 113 |
| ollama (chưa nạp mô hình) | — | — | 16 | 15 |
| **Tổng container** | **2,98 GiB** | **2,97 GiB** | **4,36 GiB** | **4,34 GiB** |

Nhận xét:

- Metabase là khoản thêm lớn nhất của tuần 5: ~1,4 GiB cả CSDL riêng, khớp ước lượng 1,0–1,3 GiB
  của ADR 0010. Wiki.js + CSDL thêm ~0,24 GiB.
- `demo-light` vẫn ~3 GiB vì Metabase chỉ có trong `full`; `full` ~4,4 GiB, dưới trần 7,59 GiB của
  Docker Desktop và dưới 8 GB của VPS đã chốt (ADR 0010), kể cả khi bật Metabase trên VPS.
- Còn phải đo lại khi W5-01 (ứng dụng 2) gộp `main`, trước khi gắn thẻ v0.5.0.

## So sánh với W2-10

W2-10 (ADR [0005](adr/0005-tn05-tai-nguyen.md)) chỉ có công cụ và quy trình, **chưa có số đo**
vì máy làm việc lúc đó thiếu Docker. Không có số tuần 2 để so; bảng trên là lần đo đầu tiên
của stack. Phần đo mô hình (token/s, RAM khi nạp mô hình) của TN-05 vẫn chờ W6-05.

## Ngân sách 16 GB và đầu vào cho TN-05 vòng 2 (W6-05)

Hồ sơ `full` **không vượt** ngân sách 16 GB ở trạng thái hiện tại (chưa nạp mô hình).
Rủi ro nằm ở phần sẽ thêm ở W6-05, không phải ở dịch vụ đang có:

- **Mô hình Ollama** là khoản lớn nhất chưa đo. Phải đo bằng `scripts/benchmark.mjs` với mô hình thật;
  không suy RAM từ số tham số.
- **Trần Docker Desktop**: mặc định chỉ ~50% RAM máy (7,59 GiB ở đây). Nếu stack + mô hình vượt mức này,
  container bị OOM trước khi máy hết RAM. Ghi `.wslconfig` `[wsl2] memory=` vào hướng dẫn cài đặt máy demo
  khi đã chốt mô hình.
- **ClamAV** tạm thời cần gần gấp đôi RAM khi tải lại cơ sở chữ ký (`ConcurrentDatabaseReload` mặc định bật).
  Nếu sát trần: đặt `ConcurrentDatabaseReload no` (chấp nhận quét bị chặn vài chục giây khi cập nhật)
  hoặc tắt freshclam trong buổi demo. Không bỏ ClamAV vì QĐ-3 ([ADR 0007](adr/0007-vi-tri-quet-clamav.md)).
- **Keycloak**: có thể giới hạn heap JVM (`JAVA_OPTS_KC_HEAP`) nếu cần thêm chỗ cho mô hình.
- Ứng viên giới hạn `mem_limit` khi cần: mattermost, n8n, apisix — đặt trần trên đỉnh đo được ít nhất 50%,
  đo lại sau khi đặt.
- Đo lại trên máy demo thật (nếu khác máy này) trước khi bỏ chữ "tạm".
