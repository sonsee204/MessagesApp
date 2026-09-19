---
name: fable-plan-guide
description: Hướng dẫn sử dụng model Fable khi soạn Implementation Plan — cấu hình kỹ thuật, khung prompt, rủi ro và Output Contract.
model: fable
tools:
  - Read
  - Glob
  - Grep
---

# Hướng Dẫn Agent Dùng Model Fable Khi Viết Plan

> **Mục đích**: Quy chuẩn cách nuôi prompt và dùng model **Fable** (`fable` → `ANTHROPIC_DEFAULT_FABLE_MODEL`) cho tác vụ soạn Implementation Plan. Fable khác họ Opus/Sonnet ở hành vi reasoning nên prompt phải tinh chỉnh lại — không dùng lại prompt viết cho model cũ.
>
> **Vai trò**: Tài liệu tham chiếu kỹ thuật cho `deep-architect` khi soạn plan theo `.claude/workflows/write-implementation-plan.md`.

---

## 1. Khi Nào Dùng Fable Cho Tác Vụ Plan

| Tiêu chí | Dùng Fable? | Lý do |
| :--- | :--- | :--- |
| Tính năng chạm ≥ 3 tầng (FE + BE + DB + Socket.IO) | **NÊN** | Mạnh long-horizon, giữ mạch lập luận qua nhiều màn |
| Spec dày, cần output plan ngay lập tức | **NÊN** | Xử lý tốt yêu cầu đầu vào lớn |
| Cần khảo sát/đối chứng trước khi lên ý tưởng | **KHÔNG** | Dispatch `quick-worker` (Tier 1) song song trước, bồi kết quả đã làm sạch |
| Tác vụ < 3 module, chỉ CRUD đơn lẻ | **KHÔNG** | Về `feature-builder` (Tier 2) theo `task-routing.md` |

---

## 2. Khác Biệt Hành Vi Của Fable (Cần Biết Trước Khi Viết Prompt)

1. **Thinking luôn bật** — không truyền `thinking` hay `budget_tokens`; kiểm soát độ sâu qua `effort` (`low` → `max`).
2. **Không ép buộc tool** — `tool_choice: any`/`tool` bị từ chối; dùng `auto` + câu lệnh nêu rõ tool cần gọi.
3. **Prompt quá chỉ thị sẽ giảm chất lượng** — viết dạng spec dày + chỉ mục tiêu, không micro-manage từng bước.
4. **Turn có thể rất dài** — luôn chạy streaming và để timeout rộng khi quy hoạch lớn.
5. **Chain-of-thought thô không trả về** — không dò reasoning nội bộ; chỉ đọc output cuối.
6. **`stop_reason: "refusal"` có thể xảy ra** — luôn kiểm `stop_reason` trước khi đọc `content`.

---

## 3. Khung Prompt Chuẩn Cho Tác Vụ Plan (Bắt Buộc Theo Dúng)

```markdown
[MỤC TIÊU]: Soạn Implementation Plan cho <tính năng>. Output là tài liệu Markdown tại
docs/plans/<ten-tinh-nang>.md, KHÔNG viết code.

[BỐI CẢNH]:
- Yêu cầu gốc: <dán nguyên văn yêu cầu người dùng>.
- Phạm vi hệ thống liên quan: <liệt kê module/tầng>.
- Kết quả khảo sát sẵn có (từ quick-worker hoặc từ người dùng): <file:line, schema, hợp đồng API>.
- Ràng buộc kiến trúc hiện hành: backend.md (3 tầng, Zero-Trust Validation, transaction đa bảng),
  frontend.md (Atomic Design, Headless Pattern, 4 UI states).

[GIẢ ĐỊNH CẦN KIỂM TRA TRƯỚC KHI LẬP PLAN]:
- Liệt kê rõ các giả định; nếu thiếu thông tin thì gọi tool khảo sát (Read/Grep/Glob)
  để xác minh trước, KHÔNG đoán.

[YÊU CẦU ĐẦU RA]:
- Tuân thủ cấu trúc 5 mục trong .claude/workflows/write-implementation-plan.md
  (Bối cảnh, Thiết kế kỹ thuật, Task Breakdown T1..Tn kèm tier phụ trách, Test Gate,
  Rủi ro & Phương án lùi).
- Mỗi task: đúng 1 block trách nhiệm, file đích dự kiến, và phụ thuộc vào task nào.
- Không sao code lớn vào plan; chỉ mô tả chữ ký hàm/schema + dẫn file:line.
- Trả về theo Output Contract ở Mục 7.
```

> **Quy tắc tinh chỉnh**: nếu Fable đi lạc chủ đề hoặc plan quá rườm rà, sửa tại `[GIẢ ĐỊNH CẦN KIỂM TRA]` (bổ sung dữ liệu thực) hoặc siết `[YÊU CẦU ĐẦU RA]` — không viết thêm bước trung gian.

---

## 4. Cài Đặt Kỹ Thuật Khi Chạy Fable

| Tham số | Giá trị | Lý do |
| :--- | :--- | :--- |
| `model` | `fable` (alias env) hoặc `claude-fable-5-1` | Model ổn định, turn dài |
| `thinking` | **BỎ QUA** (luôn bật) | Truyền giá trị khác sẽ bị 400 |
| `output_config.effort` | `high` → `xhigh` cho plan phức tạp | Cân bằng chất lượng/token |
| `max_tokens` | ≥ 32000 + **streaming** | Plan dài, tránh đứt giữa dòng |
| `tool_choice` | `auto` (KHÔNG `any`/`tool`) | Fable từ chối forced tool choice |
| `fallbacks` | `"default"` + beta `server-side-fallback-2026-07-01` | Xử lý `stop_reason: refusal` |
| Sampling (`temperature`/`top_p`/`top_k`) | **BỎ QUA** | Đã bị loại bỏ trên Fable |
| Prefill | **KHÔNG DÙNG** | Bị từ chối 400 |

---

## 5. Quy Trình Đi Kèm (SOP)

```
[Bước 0: Xác định phạm vi]
  → [Bước 1: quick-worker khảo sát song song (Tier 1)]
  → [Bước 2: Fable nhận spec + kết quả khảo sát, soạn plan]
  → [Bước 3: Kiểm stop_reason + Output Contract]
  → [Bước 4: Người dùng duyệt giả định]
  → [Bước 5: Dispatch feature-builder theo task T1..Tn]
```

- **Bước 1** chạy song song nhiều `quick-worker` khi đối chứng nhiều module (theo `task-routing.md` Mục 4).
- **Bước 2** chỉ nạp kết quả đã làm sạch (file:line, schema signature), không nạp raw log.
- **Bước 4** là cổng bắt buộc: KHÔNG cho `feature-builder` khởi động khi còn giả định chưa xác nhận.
- **Bước 5** mỗi lượt dispatch kèm Context Package trỏ thẳng tới mục task trong file plan.

---

## 6. Rủi Ro Thường Gặp & Cách Khắc Phục

| Rủi ro | Dấu hiệu | Khắc phục |
| :--- | :--- | :--- |
| Plan bị đoán thay vì kiểm chứng | Có file/schema không tồn tại trong repo | Bổ sung `[GIẢ ĐỊNH CẦN KIỂM TRA]`, bắt buộc Grep/Read trước |
| Output bị cắt giữa chừng | `stop_reason == "max_tokens"` | Tăng `max_tokens`, bật streaming |
| Refusal không rõ nguyên nhân | `stop_reason == "refusal"` | Bật `fallbacks: "default"` rồi chạy lại |
| Prompt quá micro | Fable tuân thủ cứng nhắc, thiếu sáng kiến kiến trúc | Chuyển sang spec dày, gỡ bỏ chỉ dẫn từng bước nhỏ |
| Task breakdown mập (1 task làm 2 việc) | File đích > 1 module/task | Chia thêm task, gắn rõ tier phụ trách |

---

## 7. Output Contract (Bắt Buộc)

```markdown
TRẠNG THÁI: DONE | PROPOSAL_PENDING | BLOCKED
ĐƯỜNG DẪN PLAN: docs/plans/<file>.md
TÓM TẮT KIẾN TRÚC: 2-4 gạch đầu dòng quyết định cốt lõi.
BẢNG TASK -> TIER PHỤ TRÁCH -> ĐỘ PHỤ THUỘC: T1..Tn
GIẢ ĐỊNH CẦN XÁC NHẬN: liệt kê hoặc "None".
STOP_REASON CUỐI CÙNG: <end_turn | refusal | max_tokens>
```

---

## 8. Ánh Xạ Luồng Hiện Tại

- **Tier 1** → `quick-worker` (model `fable`) — đọc/tra cứu.
- **Soạn Plan** → `deep-architect` (model `opus`) chạy Fable theo hướng dẫn này + `write-implementation-plan.md`.
- **Tier 2** → `feature-builder` (model `sonnet`) — triển khai task từ plan.
- **Tier 3** → `deep-architect` (model `opus`) — kiến trúc nền tảng / xung đột.
