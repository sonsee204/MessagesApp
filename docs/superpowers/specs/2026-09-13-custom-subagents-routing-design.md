# Design Spec: Hệ Thống Tự Động Phân Loại Và Điều Phối Model Qua Custom Subagents

> **Ngày lập**: 2026-09-13  
> **Trạng thái**: Chờ phê duyệt  
> **Phạm vi**: Cấu hình quy tắc điều phối và bộ custom subagents chuyên trách cho dự án `appmessaging`

---

## 1. Bối Cảnh & Mục Tiêu (Context & Objectives)

### 1.1. Bối cảnh
- Phiên làm việc chính của Claude Code CLI gắn cố định với một model khởi tạo (`ag/gemini-3.8-flash-high`) và không tự động chuyển đổi model động cho từng prompt riêng lẻ.
- Dự án sử dụng hệ thống proxy cục bộ (`http://127.0.0.1:20128/v1`) với ánh xạ các model theo năng lực:
  - `haiku`: `BAi/qwen3.8-flash` (Tốc độ cao, chi phí siêu thấp, tác vụ nhẹ).
  - `sonnet`: `ag/gemini-3.8-flash-high` (Cân bằng tốt, năng lực code fullstack mạnh mẽ).
  - `opus`: `BAi/deepseek-v4.1-flash` (Suy luận sâu, giải quyết vấn đề phức tạp, kiến trúc).
- Cần cơ chế tự động hóa việc lựa chọn và ủy quyền tác vụ cho đúng model mà không yêu cầu người dùng phải tự gõ lệnh chỉ định model thủ công.

### 1.2. Mục tiêu
- Thiết lập phiên chính làm **Dispatcher**: tự động phân tích độ phức tạp của câu lệnh đầu vào và ủy quyền (dispatch) cho subagent phù hợp qua công cụ `Agent`.
- Tạo 3 custom subagents chuyên trách trong `.claude/agents/` khai thác đúng 3 tầng model.
- Bổ sung quy tắc điều phối vào hệ thống rules của dự án (`.claude/rules/task-routing.md`).
- Đảm bảo tuân thủ nguyên tắc Token Economy và bảo vệ quota tối đa.

---

## 2. Kiến Trúc Hệ Thống (Architecture Overview)

```
                       [Người dùng nhập Prompt]
                                  │
                                  ▼
               [Phiên chính: Dispatcher & Orchestrator]
                   (Model: gemini-3.8-flash-high)
                                  │
                     Phân tích độ phức tạp tác vụ
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
     [Tier 1]                 [Tier 2]                 [Tier 3]
  Độ phức tạp: Thấp        Độ phức tạp: Vừa         Độ phức tạp: Cao
         │                        │                        │
         ▼                        ▼                        ▼
   `quick-worker`         `feature-builder`        `deep-architect`
  (Model: haiku)           (Model: sonnet)          (Model: opus)
  - Read, Grep, Glob       - Read, Edit, Write      - Read, Edit, Write
  - WebSearch, WebFetch    - Shell (Bash/PS)        - Shell (Bash/PS)
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                                  ▼
                 [Tổng hợp kết quả & phản hồi User]
```

---

## 3. Đặc Tả Chi Tiết Các Thành Phần (Detailed Component Specs)

### 3.1. Subagent `quick-worker` (`.claude/agents/quick-worker.md`)
- **Tầng model**: Tier 1 (`model: haiku` -> `BAi/qwen3.8-flash`).
- **Danh sách công cụ**: `Read`, `Glob`, `Grep`, `WebSearch`, `WebFetch`.
- **Phạm vi quyền hạn**: Chỉ đọc và tra cứu, không có quyền can thiệp sửa đổi filesystem nhằm loại bỏ hoàn toàn nguy cơ sinh code lỗi từ model nhỏ.
- **Nhiệm vụ chính**:
  - Tìm kiếm và đối soát file trong dự án.
  - Regex grep, tóm tắt nội dung file lớn.
  - Tra cứu tài liệu kỹ thuật trên mạng hoặc giải thích cú pháp đơn giản.

### 3.2. Subagent `feature-builder` (`.claude/agents/feature-builder.md`)
- **Tầng model**: Tier 2 (`model: sonnet` -> `ag/gemini-3.8-flash-high`).
- **Danh sách công cụ**: `Read`, `Edit`, `Write`, `Glob`, `Grep`, `Bash`, `PowerShell`.
- **Phạm vi quyền hạn**: Đọc và ghi mã nguồn, chạy kiểm thử và script liên quan.
- **Nhiệm vụ chính**:
  - Triển khai tính năng mới (APIs, Controller, Service, Repository).
  - Xây dựng React Components (tuân thủ Atomic Design).
  - Sửa lỗi logic nghiệp vụ, viết unit tests.
  - Bắt buộc comment code bằng Tiếng Việt theo `CLAUDE.md`.

### 3.3. Subagent `deep-architect` (`.claude/agents/deep-architect.md`)
- **Tầng model**: Tier 3 (`model: opus` -> `BAi/deepseek-v4.1-flash`).
- **Danh sách công cụ**: `Read`, `Edit`, `Write`, `Glob`, `Grep`, `Bash`, `PowerShell`.
- **Phạm vi quyền hạn**: Toàn quyền phân tích, tái cấu trúc và tối ưu hóa hệ thống.
- **Nhiệm vụ chính**:
  - Thiết kế kiến trúc tổng thể, hoạch định giải pháp hệ thống.
  - Xử lý race-condition, deadlock, tối ưu hóa transaction MongoDB đa collection.
  - Audit bảo mật, kiểm tra kiến trúc phân tầng và bảo vệ quota.

### 3.4. Quy Tắc Điều Phối (`.claude/rules/task-routing.md`)
File quy chuẩn được nạp tự động vào ngữ cảnh của phiên chính, quy định:
- Tiêu chí định lượng để nhận diện Tier 1, Tier 2, Tier 3.
- Mẫu câu lệnh gọi công cụ `Agent` tiêu chuẩn.
- Quy tắc trực tiếp hóa câu trả lời (không thêm bước rườm rà).

---

## 4. Cơ Chế Xử Lý Lỗi & Leo Thang (Error Handling & Escalation)

1. **Leo thang tầng tự động (Auto-Escalation)**:
   - Nếu `quick-worker` không thể đưa ra câu trả lời chính xác hoặc phát hiện tác vụ yêu cầu can thiệp sửa code, phiên chính điều phối chuyển tiếp sang `feature-builder`.
   - Nếu `feature-builder` sửa lỗi không thành công sau 2 lần thử (tuân thủ nguyên tắc Zero-Loop trong `token-economy.md`), phiên chính chuyển tiếp yêu cầu lên `deep-architect` để tái đánh giá giả định kiến trúc.
2. **Bảo vệ toàn vẹn mã nguồn (Code Integrity Guard)**:
   - Các subagent thực thi độc lập; kết quả trả về được phiên chính tổng hợp trước khi phản hồi người dùng.

---

## 5. Kế Hoạch Xác Minh (Verification Plan)

Sau khi tạo các file cấu hình, tiến hành 3 bài test thực tế:
1. **Test 1 (Tier 1 Check)**: Yêu cầu tìm kiếm và kiểm tra danh sách routes hiện có trong backend -> Kỳ vọng phiên chính dispatch `quick-worker`.
2. **Test 2 (Tier 2 Check)**: Yêu cầu viết một hàm tiện ích validate dữ liệu bằng Zod -> Kỳ vọng phiên chính dispatch `feature-builder`.
3. **Test 3 (Tier 3 Check)**: Yêu cầu thiết kế giải pháp chống duplicate message trong Socket.IO khi mất mạng -> Kỳ vọng phiên chính dispatch `deep-architect`.
