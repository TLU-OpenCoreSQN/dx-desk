# 0005. TN-05 vòng 1 — đo tài nguyên Tầng 1 và Ollama

- Trạng thái: Có công cụ và quy trình; chưa có số đo máy demo.
- Ngày: 21/10/2026.
- Người phụ trách: Séc (TV3), Nguyên hỗ trợ môi trường, Quyền phối hợp.
- Mã: W2-10, TN-05.

## Mục tiêu

Đo RAM bảy dịch vụ Tầng 1 và tốc độ mô hình khoảng 1,5B/3B/4B khi cùng chạy trên
máy demo 16 GB. Tuần 2 chưa chọn mô hình cuối, việc đó thuộc vòng 2 tuần 6.

## Quy trình

1. Chạy stack tuần 2, xác nhận bảy dịch vụ healthy.
2. `docker compose --env-file .env -f infra/compose/docker-compose.yml --profile benchmark up -d ollama`.
3. Cài từng model bằng `docker compose ... exec ollama ollama pull <model>`.
   Mặc định công cụ đo `qwen2.5:1.5b`, `qwen2.5:3b`, `qwen3:4b`.
   Có thể chỉ định `--models=<tag1>,<tag2>,<tag3>`.
4. Chạy `node scripts/benchmark.mjs`.
5. Lưu JSON/CSV trong `.local/reports/`, rà lại digest, cấu hình máy và kết quả.
6. Chép kết quả đã rà soát vào tài liệu báo cáo của đội và cập nhật file kế hoạch.

Script kiểm đủ bảy dịch vụ healthy; ghi RAM Docker, CPU, RAM máy, phiên bản Docker/
Ollama, model digest và quantization. Mỗi model có một lượt warmup rồi ba lượt đo,
prompt cố định, temperature 0, seed 42, context 2048 và tối đa 128 token.
Tốc độ = eval_count / eval_duration; thời gian của Ollama có đơn vị nanosecond.
Unload model trước khi chuyển sang model tiếp theo để không giữ nhiều model trong RAM.

RAM Docker là ảnh chụp thời điểm đo, không phải giá trị peak đã được chứng minh.
Ghi nhận thêm Windows/WSL VM overhead nếu dùng Docker Desktop và không cộng RAM
Ollama vào số Tầng 1. Không so sánh số liệu giữa các máy như thể cùng một cấu hình.

## Kết quả hiện tại

**Chưa đo:** máy làm việc thiếu Docker và Ollama. Không có bảng số liệu giả.
Script thất bại rõ ràng khi thiếu dịch vụ/model, vẫn lưu báo cáo lỗi và các số đo
đã có, đặt `completed:false`.

Nếu vượt ngân sách 16 GB hoặc tốc độ không phù hợp, vòng 2 thử model nhỏ hơn,
ít công cụ hơn, câu hỏi demo cố định. Không chọn model chỉ dựa vào số tham số.
