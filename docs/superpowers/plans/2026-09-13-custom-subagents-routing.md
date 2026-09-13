# Custom Subagents Model Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết lập hệ thống tự động phân loại tác vụ tại phiên chính và điều phối (dispatch) tới 3 Custom Subagents chuyên biệt tương ứng với 3 tầng model (`haiku`, `sonnet`, `opus`) thông qua Claude Code Native Subagent System.

**Architecture:** Phiên chính đóng vai trò Dispatcher áp dụng quy tắc phân loại trong `.claude/rules/task-routing.md`, tự động ủy quyền thực thi cho 3 subagents trong `.claude/agents/` (`quick-worker`, `feature-builder`, `deep-architect`) qua công cụ `Agent`, sau đó tổng hợp kết quả trả về cho người dùng.

**Tech Stack:** Claude Code Agent Framework (Markdown + YAML Frontmatter), Local Proxy Model Mapping (`http://127.0.0.1:20128/v1`).

**Spec:** `docs/superpowers/specs/2026-09-13-custom-subagents-routing-design.md`

## Global Constraints
- Ánh xạ model cố định: `haiku` -> `BAi/qwen3.8-flash`, `sonnet` -> `ag/gemini-3.8-flash-high`, `opus` -> `BAi/deepseek-v4.1-flash`.
- Tuân thủ nguyên tắc Token Economy (`token-economy.md`): không lặp lại mã nguồn, `quick-worker` chỉ được cấp quyền đọc dữ liệu, không ghi/sửa file.
- Mọi ghi chú và hướng dẫn trong các file agent bắt buộc có chú thích Tiếng Việt theo quy định của dự án (`CLAUDE.md`).

---

### Task 1: Khởi tạo Custom Subagent `quick-worker` (Tier 1 - Haiku)

**Files:**
- Create: `.claude/agents/quick-worker.md`

**Interfaces:**
- Model: `haiku`
- Allowed Tools: `Read`, `Glob`, `Grep`, `WebSearch`, `WebFetch`

- [x] **Step 1: Tạo file cấu hình `.claude/agents/quick-worker.md`**

Nội dung file:
```markdown
---
name: quick-worker
description: Lightweight agent chuyên đọc, tra cứu tài liệu, tìm kiếm file, grep regex và giải thích cú pháp đơn giản.
model: haiku
tools:
  - Read
  - Glob
  - Grep
  - WebSearch
  - WebFetch
---

# Quick Worker Agent

Bạn là **quick-worker**, một subagent siêu nhẹ chuyên trách các tác vụ đọc, đối soát và tra cứu thông tin nhanh trong dự án.

## Nguyên tắc hoạt động
- **Phạm vi quyền hạn**: Chỉ đọc và phân tích dữ liệu, tuyệt đối không can thiệp sửa đổi hoặc tạo mới file.
- **Tiết kiệm token**: Trả lời ngắn gọn, trực diện, không rườm rà.
- **Ngôn ngữ**: Phản hồi kết quả bằng Tiếng Việt.
```

- [x] **Step 2: Xác minh cú pháp frontmatter YAML**

Kiểm tra file đã được tạo với frontmatter chuẩn: `name: quick-worker`, `model: haiku`.

- [x] **Step 3: Commit Task 1**

```bash
git add .claude/agents/quick-worker.md
git commit -m "feat(agents): create quick-worker subagent for lightweight tier"
```

---

### Task 2: Khởi tạo Custom Subagent `feature-builder` (Tier 2 - Sonnet)

**Files:**
- Create: `.claude/agents/feature-builder.md`

**Interfaces:**
- Model: `sonnet`
- Allowed Tools: `Read`, `Edit`, `Write`, `Glob`, `Grep`, `Bash`, `PowerShell`

- [x] **Step 1: Tạo file cấu hình `.claude/agents/feature-builder.md`**

Nội dung file:
```markdown
---
name: feature-builder
description: Developer agent chuyên triển khai tính năng fullstack, viết API, React component và sửa bug thông thường.
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - Bash
  - PowerShell
---

# Feature Builder Agent

Bạn là **feature-builder**, một lập trình viên Fullstack chuyên triển khai tính năng và sửa lỗi cho dự án `appmessaging` (Express.js + TypeScript + MongoDB + Socket.IO + React).

## Nguyên tắc hoạt động
- **Backend Architecture**: Tuân thủ nghiêm ngặt mô hình 3 tầng (Controller -> Service -> Repository) trong `.claude/rules/backend.md`.
- **Frontend Architecture**: Tuân thủ Atomic Design và Headless Pattern trong `.claude/rules/frontend.md`.
- **Bắt buộc comment Tiếng Việt**: Mọi hàm, schema, component sinh mới hoặc cập nhật bắt buộc có chú thích Tiếng Việt rõ ràng.
- **Sửa đổi chuẩn xác**: Sử dụng công cụ `Edit` để thay đổi mã nguồn chính xác theo từng đoạn ngắn.
```

- [x] **Step 2: Xác minh cú pháp frontmatter YAML**

Kiểm tra file có `name: feature-builder`, `model: sonnet`.

- [x] **Step 3: Commit Task 2**

```bash
git add .claude/agents/feature-builder.md
git commit -m "feat(agents): create feature-builder subagent for standard tier"
```

---

### Task 3: Khởi tạo Custom Subagent `deep-architect` (Tier 3 - Opus)

**Files:**
- Create: `.claude/agents/deep-architect.md`

**Interfaces:**
- Model: `opus`
- Allowed Tools: `Read`, `Edit`, `Write`, `Glob`, `Grep`, `Bash`, `PowerShell`

- [x] **Step 1: Tạo file cấu hình `.claude/agents/deep-architect.md`**

Nội dung file:
```markdown
---
name: deep-architect
description: Senior Architect agent chuyên thiết kế hệ thống, audit bảo mật, tối ưu hóa database và xử lý bài toán kỹ thuật phức tạp.
model: opus
tools:
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - Bash
  - PowerShell
---

# Deep Architect Agent

Bạn là **deep-architect**, một Chuyên gia Kiến trúc Hệ thống Cao cấp chuyên giải quyết các bài toán kỹ thuật hóc búa, tối ưu hiệu năng và audit an toàn thông tin cho dự án `appmessaging`.

## Trọng tâm chuyên môn
- **Cơ sở dữ liệu**: Tối ưu hóa MongoDB transactions đa collection, xử lý chống race-condition, deadlock, phòng ngừa N+1 query.
- **Thời gian thực (Real-time)**: Kiến trúc luồng Socket.IO, xử lý phân tán và cơ chế đồng bộ tin nhắn khi mất kết nối mạng.
- **Bảo mật & Chuẩn hóa**: Rà soát lỗ hổng logic, zero-trust input validation, phân tầng kiến trúc nghiêm ngặt.
- **Bắt buộc comment Tiếng Việt**: Ghi chú kiến trúc và mã nguồn bằng Tiếng Việt súc tích, chuẩn xác.
```

- [x] **Step 2: Xác minh cú pháp frontmatter YAML**

Kiểm tra file có `name: deep-architect`, `model: opus`.

- [x] **Step 3: Commit Task 3**

```bash
git add .claude/agents/deep-architect.md
git commit -m "feat(agents): create deep-architect subagent for complex tier"
```

---

### Task 4: Thiết lập Quy Tắc Điều Phối Tự Động (`task-routing.md` & `CLAUDE.md`)

**Files:**
- Create: `.claude/rules/task-routing.md`
- Modify: `CLAUDE.md`

- [x] **Step 1: Tạo file `.claude/rules/task-routing.md`**

Nội dung:
```markdown
# Task Routing & Model Dispatching Governance

> **Mục tiêu**: Tự động phân loại độ phức tạp của câu lệnh người dùng và điều phối tới Custom Subagent chạy model phù hợp nhất nhằm tối ưu chi phí token và chất lượng kỹ thuật.

---

## 1. Ma Trận Điều Phối (Routing Matrix)

| Tầng (Tier) | Tiêu chuẩn nhận diện | Subagent mục tiêu | Model thực tế |
| :--- | :--- | :--- | :--- |
| **Tier 1 (Nhẹ)** | Đọc file, tìm kiếm regex/text, tóm tắt dữ liệu, giải thích cú pháp | `quick-worker` | `haiku` (`BAi/qwen3.8-flash`) |
| **Tier 2 (Chuẩn)** | Viết CRUD, tạo API endpoint, dựng React component, sửa bug thông thường | `feature-builder` | `sonnet` (`ag/gemini-3.8-flash-high`) |
| **Tier 3 (Phức tạp)** | Thiết kế kiến trúc, audit bảo mật, xử lý transaction DB phức tạp, tối ưu concurrency | `deep-architect` | `opus` (`BAi/deepseek-v4.1-flash`) |

---

## 2. Quy Trình Điều Phối Bắt Buộc Của Phiên Chính (Dispatcher Protocol)
1. **Phân loại tức thì**: Ngay khi nhận yêu cầu, phiên chính xác định Tier tương ứng.
2. **Ủy quyền qua công cụ `Agent`**:
   - Gọi `Agent(subagent_type: "<tên-agent>", prompt: "<yêu cầu chi tiết kèm ngữ cảnh>")`.
3. **Phản hồi**: Nhận kết quả từ subagent và trình bày trực tiếp cho người dùng, không thêm văn phong dẫn dắt thừa thãi.
4. **Cơ chế leo thang (Escalation)**:
   - Nếu `quick-worker` cần can thiệp sửa file -> leo thang lên `feature-builder`.
   - Nếu `feature-builder` sửa thất bại quá 2 lần -> leo thang lên `deep-architect`.
```

- [x] **Step 2: Cập nhật `CLAUDE.md` để kích hoạt quy tắc điều phối**

Sửa mục `## 🧩 Domain Rules & Skills Mapping` trong `CLAUDE.md`, thêm dòng:
```markdown
- **Task Routing**: Tuân thủ nghiêm ngặt quy tắc tự động phân loại và dispatch subagents tại `.claude/rules/task-routing.md`.
```

- [x] **Step 3: Commit Task 4**

```bash
git add .claude/rules/task-routing.md CLAUDE.md
git commit -m "feat(governance): add task-routing rule and link in CLAUDE.md"
```

---

### Task 5: Kiểm Thử Xác Minh Tính Năng Điều Phối (Verification Testing)

- [x] **Step 1: Test Tier 1 (Haiku Routing)**
  - Chạy lệnh dispatch thủ công hoặc qua câu lệnh mẫu kiểm tra đọc file.
  - Xác nhận `quick-worker` thực thi và hoàn thành mà không có lỗi.
- [x] **Step 2: Test Tier 2 (Sonnet Routing)**
  - Chạy thử nghiệm phân loại tác vụ tạo hàm tiện ích hoặc kiểm tra logic.
  - Xác nhận `feature-builder` thực thi đúng quy chuẩn code comment Tiếng Việt.
- [x] **Step 3: Test Tier 3 (Opus Routing)**
  - Chạy thử nghiệm phân tích bài toán race-condition Socket.IO.
  - Xác nhận `deep-architect` suy luận và đưa ra khuyến nghị chuẩn.
- [x] **Step 4: Commit tổng kết hoàn tất tính năng**

```bash
git add docs/superpowers/plans/2026-09-13-custom-subagents-routing.md
git commit -m "docs: finalize implementation plan for custom subagents routing"
```
