# Workflow: Soạn Thảo Kế Hoạch Triển Khai (Write Implementation Plan)

> **Mục tiêu**: phân tích yêu cầu phức tạp và sản xuất bản kế hoạch triển khai (Implementation Plan) dạng bước-ready, đóng vai trò hợp đồng chuyển giao cho `feature-builder` thực thi. Kế hoạch KHÔNG thực thi code, chỉ vạch đường đi.
>
> **Model**: mặc định `deep-architect` (opus). Tác vụ plan ≥ 3 tầng có thể chạy trên **Fable** — bắt buộc đọc `.claude/agents/fable-plan-guide.md` trước khi bắt đầu (Fable khác họ Opus/Sonnet ở hành vi reasoning: thinking luôn bật, không ép buộc tool, prompt dạng spec-dày).

---

## Khi Nào Dispatch Kế Hoạch Này (Trigger Matrix)
- Tính năng chạm từ 3 module/tầng trở lên (FE + BE + DB + Socket.IO).
- Cần quyết định kiến trúc: schema MongoDB mới, luồng transaction đa collection, hạ tầng realtime, hàng đợi (BullMQ), storage/media pipeline.
- Yêu cầu từ người dùng dạng "lên kế hoạch / thiết kế / split task cho tính năng X".
- Các trường hợp khác: giữ nguyên routing tại `.claude/rules/task-routing.md` (Tier 1/2).

---

## Quy Trình Thực Hiện (SOP Flow)

```
[Bước 0: Xác định phạm vi & model] ──> [Bước 1: Khảo Sát Hiện Trạng Trong Phạm Vi] ──> [Bước 2: Quyết Định Kiến Trúc & Trade-off] ──> [Bước 3: Soạn Plan Cấu Trúc Chuẩn] ──> [Bước 4: Định Nghĩa Test Gate & Handoff Contract]
```

### Bước 0: Xác Định Phạm Vi & Chọn Model
1. Chốt danh sách module/tầng bị ảnh hưởng; nếu < 3 tầng thì trả về Tier 2 (`task-routing.md`).
2. Nếu chạy trên Fable: nạp `.claude/agents/fable-plan-guide.md` — không truyền `thinking`/`budget_tokens`, không ép `tool_choice`, prompt dạng spec-dày, `max_tokens ≥ 32000` + streaming.

---

### Bước 1: Khảo Sát Hiện Trạng (Read-Only, Đúng Phạm Vi)
1. Chỉ đọc các file/thư mục nằm trong `[PHẠM VI]` của Context Package.
2. Lập bản đồ ánh xạ: endpoint/schema/store/event hiện có nào sẽ bị ảnh hưởng (kèm `file:line`).
3. Ghi chú điểm xung đột tiềm tàng: migration dữ liệu, hợp đồng FE-BE đang chạy, auth/permission hiện hành.
4. Khảo sát diện rộng → dispatch `quick-worker` song song (Tier 1), không tự quét toàn repo.

---

### Bước 2: Quyết Định Kiến Trúc & Trade-off
1. Chốt 1 phương án kiến trúc duy nhất; nêu tối đa 2 câu giải thích trade-off so với phương án bị loại.
2. Mọi quyết định phải bám sát `.claude/rules/backend.md` (3 tầng, Zero-Trust Validation, Transaction đa bảng) và `.claude/rules/frontend.md` (Atomic Design, Headless Pattern).
3. Nếu có 2 hướng giải quyết xung đột ở tầng nền tảng -> dừng, trả `TRẠNG THÁI: PROPOSAL_PENDING` kèm 2 phương án ngắn gọn cho người dùng chọn.

---

### Bước 3: Soạn Plan Cấu Trúc Chuẩn (Bắt Buộc Đủ 5 Mục)
Plan lưu tại `docs/plans/<kebab-case-ten-tinh-nang>.md`, cấu trúc:

```markdown
# Implementation Plan: <Tên tính năng>

## 1. Bối cảnh & Mục tiêu
- 1-3 câu: vấn đề giải quyết, phạm vi KHÔNG làm (out-of-scope).

## 2. Thiết kế kỹ thuật
- Schema/DTO mới (Zod + Mongoose index), ảnh hưởng dữ liệu cũ (migration?).
- Hợp đồng API: method + path + request/response + error code chuẩn.
- Luồng Socket.IO / realtime nếu có (event, payload, room, ack).
- Giao dịch DB: chỉ rõ bước nào bọc transaction, fallback standalone.

## 3. Danh sách công việc (Task Breakdown)
- Đánh số T1, T2, ... Mỗi task: 1 block trách nhiệm duy nhất, ghi rõ tier phụ trách
  (`feature-builder` hay `deep-architect` tự làm), file đích dự kiến tạo/sửa, task nào phụ thuộc task nào.

## 4. Test Gate
- Mỗi task gắn tiêu chí nghiệm thu đo được (test pass, typecheck, curl checklist, 4 UI states).

## 5. Rủi ro & Phương án lùi
- Rủi ro hiệu năng/bảo mật/dữ liệu + cách giảm thiểu; feature flag hoặc rollback point nếu cần.
```

---

### Bước 4: Test Gate & Handoff Contract
1. Agent soạn plan KHÔNG tự code toàn bộ; các task gắn `feature-builder` được dispatch tuần tự theo thứ tự phụ thuộc, mỗi lượt kèm Context Package trỏ thẳng tới `docs/plans/<file>.md` + mục task tương ứng.
2. Task của Tier 1 (đọc/tra cứu đối chứng) -> dispatch `quick-worker` song song trước khi vào Tier 2.
3. Kết thúc plan phải ghi rõ giả định (assumptions) để người dùng phản biện trước khi tốn token thực thi.
4. Nếu chạy Fable: kiểm `stop_reason` cuối cùng trước khi trả kết quả (xử lý `refusal`/`max_tokens` theo `fable-plan-guide.md` Mục 6).

---

## 📝 Quy Chuẩn Chú Thích & Ngôn Ngữ
- Toàn bộ plan viết bằng Tiếng Việt kỹ thuật, súc tích; không sao chép nguyên code lớn vào plan, chỉ mô tả chữ ký hàm/schema và dẫn `file:line`.
- Code mẫu trong plan (nếu có) phải kèm chú thích Tiếng Việt và tuân Diff-First.

## Output Contract Của Bước Soạn Plan
```
TRẠNG THÁI: DONE | PROPOSAL_PENDING | BLOCKED
ĐƯỜNG DẪN PLAN: docs/plans/<file>.md
TÓM TẮT KIẾN TRÚC: 2-4 gạch đầu dòng quyết định cốt lõi.
Bảng task -> tier phụ trách -> độ phụ thuộc.
GIẢ ĐỊNH CẦN XÁC NHẬN: liệt kê hoặc "None".
STOP_REASON (nếu chạy Fable): <end_turn | refusal | max_tokens>.
```
