# 0011. Mô hình AI qua API bên thứ ba thay cho Ollama cục bộ

- Trạng thái: **Đã chốt** 23/11/2026 (quyết định của nhóm)
- Ngày: 23/11/2026
- Người ghi: TV1 (Nguyên, nền tảng)
- Mã kế hoạch: QĐ-5, TN-05 vòng 2; thay phần mô hình của [ADR 0005](0005-tn05-tai-nguyen.md)

## Bối cảnh

Hồ sơ `full` chạy Ollama trong Compose cho ba việc: chat có gọi công cụ của trợ lý IT
(`qwen3:4b`), gợi ý phân loại phiếu ở API và nhúng bài Wiki vào Qdrant (`bge-m3:567m`).
Mô hình phải tải tay; khi chưa tải, trợ lý chỉ báo "Trợ lý chưa xử lý được yêu cầu" và
`wiki-index` lỗi HTTP 404 liên tục. Mô hình 1,5–4B còn cần thêm 2–4 GiB RAM và nhiều CPU
([ADR 0010](0010-noi-chay-ban-internet.md)), vượt khả năng của máy demo và VPS.

## Quyết định

- Bỏ dịch vụ `ollama`, volume `ollama-data` và `scripts/benchmark.mjs` (chỉ đo Ollama).
- Mọi lời gọi mô hình đi qua **API chuẩn OpenAI-compatible** (`chat/completions`, `embeddings`):
  - trợ lý: `apps/assistant/llm.mjs` (chat stream SSE có công cụ, embedding);
  - gợi ý phân loại phiếu: `apps/api/src/ticket-ai-suggestion.ts` (`response_format` JSON Schema).
- Nhà cung cấp trước mắt là **Google Gemini** qua endpoint tương thích OpenAI
  `https://generativelanguage.googleapis.com/v1beta/openai/`; model mặc định `gemini-2.5-flash`
  (chat) và `gemini-embedding-001` (nhúng).
- Cấu hình trong `.env`: `AI_API_BASE_URL`, `AI_API_KEY`, `ASSISTANT_CHAT_MODEL`,
  `ASSISTANT_EMBED_MODEL`. Đổi nhà cung cấp không cần sửa mã.
- Qdrant và `wiki-index` giữ nguyên. Tên collection băm theo model nhúng, nên đổi model sẽ
  tự lập chỉ mục lại vào collection mới.

## Phương án đã xem xét

| Phương án | Ưu điểm | Nhược điểm | Kết luận |
|---|---|---|---|
| Giữ Ollama cục bộ | Dữ liệu không rời hạ tầng | Tải model tay, +2–4 GiB RAM, chậm trên CPU | Bỏ |
| API Gemini gốc | Đủ chat và nhúng | Khóa chặt một nhà cung cấp | Không chọn |
| API OpenAI-compatible, mặc định Gemini | Đổi nhà cung cấp bằng `.env`, đủ chat + công cụ + nhúng | Phụ thuộc mạng và hạn mức của nhà cung cấp | **Chọn** |
| Bỏ tìm kiếm vector, tìm Wiki theo từ khóa | Không gửi nội dung Wiki ra ngoài | Kém chính xác với câu hỏi tự nhiên | Không chọn |

## Hệ quả

- **Dữ liệu ra ngoài.** Câu hỏi trợ lý, đoạn bài Wiki liên quan, kết quả công cụ (thống kê,
  phiếu tương tự) và tiêu đề/mô tả phiếu khi gợi ý phân loại được gửi tới nhà cung cấp.
  Chỉ dùng dữ liệu tổng hợp/synthetic khi demo; xem lại điều khoản dữ liệu của gói API trước
  khi dùng dữ liệu thật.
- **Bí mật.** `AI_API_KEY` chỉ đặt trong `.env` (đã ignore). Lỗi từ nhà cung cấp chỉ ghi mã HTTP,
  không ghi nội dung phản hồi.
- **Thiếu khóa hoặc hết hạn mức**: trợ lý và gợi ý AI báo lỗi chung; phần còn lại của DX-Desk
  chạy bình thường. Log `assistant`/`wiki-index` ghi nguyên nhân.
- **RAM** hồ sơ `full` giảm phần Ollama; không còn bước tải mô hình.
- **Việc tiếp:** `tools/testing/week6-evaluate.mjs` vẫn gọi trực tiếp API Ollama (`/api/tags`,
  `/api/chat`) để đánh giá chất lượng; cần chuyển sang API mới trước khi chạy lại đánh giá W6.
