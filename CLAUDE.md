# CLAUDE.md - Claude Code Operating Manual & Governance

> **Project Identity**:
> - **PROJECT_NAME**: appmessaging
> - **PROJECT_TYPE**: Fullstack
> - **PRIMARY_STACK**: Express.js + TypeScript + MongoDB + Socket.IO

---

## ⚡ Direct Communication & Token Minimization
- **Direct Output**: Trả lời trực diện vào kết quả kỹ thuật, không chào hỏi, không kết luận xã giao.
- **Diff-First Presentation**: Không in lại toàn bộ file trên 30 dòng. Bắt buộc xuất diff hoặc hàm cần sửa kèm `// ... existing code ...`.
- **Architectural Brevity**: Giải thích lý do kiến trúc tối đa trong 1-2 câu ngắn gọn.
- **Context Boundary**: Chỉ đọc các tệp được nhắc tên trực tiếp hoặc gắn tag `@`. Không tự ý duyệt file rộng khắp repo.
- **Dependency Guard**: Tuyệt đối không phỏng đoán packages, chỉ dùng packages đã khai báo trong cấu hình dependencies của dự án.
- **Vietnamese Comments Mandatory**: Mọi khối code sinh mới hoặc cập nhật (Schema, Model, Repository, Service, Controller, Routes, Component, Hook, Helper) bắt buộc phải có chú thích bằng Tiếng Việt giải thích rõ mục đích, luồng nghiệp vụ và logic quan trọng. Không được lược bỏ comment với lý do tiết kiệm token.

---

## 🛡️ Strict Token Economy & Quota Shield
- **Token Economy**: Áp dụng nghiêm ngặt toàn bộ nguyên tắc tại `.claude/rules/token-economy.md`.
- **Surgical Inspection**: Dùng `offset` và `limit` với các file >100 dòng. Ưu tiên Grep với `head_limit: 50`.
- **Surgical Edits**: Luôn dùng công cụ thay thế chuỗi chính xác (`Edit`). Không đọc lại file vừa sửa nếu công cụ báo thành công.
- **Context Pollution Defense**: Tôn trọng `.claudeignore`, không dump raw JSON/logs lớn vào context.

---

## 🧩 Domain Rules & Skills Mapping
- **Skill Mapping**: Trước khi xử lý giao diện hoặc tác vụ phức tạp, tra cứu các skills trong `.claude/skills/`.
- **Domain Rules**:
  - Task Routing: Tuân thủ nghiêm ngặt quy tắc tự động phân loại và dispatch subagents tại `.claude/rules/task-routing.md`.
  - Frontend tasks: Tuân thủ `.claude/rules/frontend.md`.
  - Backend tasks: Tuân thủ `.claude/rules/backend.md`.
  - Mọi task (code mới/sửa): Tuân thủ danh mục CẤM tại `.claude/rules/hard-bans.md`.
  - **Open-Codereview Gate**: Mọi task có thay đổi mã nguồn **bắt buộc chạy `ocr`** trước khi báo hoàn thành (xem `.claude/workflows/code-review-audit.md` Bước 5). Cài: `npm install -g @alibaba-group/open-code-review`; chạy `ocr review --format json --output result.json` và kèm kết quả vào báo cáo dưới dạng `VERIFICATION (Open-Codereview)`. Ngoại lệ: task chỉ chạm docs/governance files hoặc Git/CI — ghi rõ lý do bỏ qua.
  - Git Workflow: KHÔNG được tạo worktree (`EnterWorktree`). Tách biệt công việc bằng cách tạo branch mới trên cùng checkout. Merge vào `main` khi hoàn tất rồi xoá branch.
- **Workflows SOP**: Phân tích và thực thi theo các kịch bản chuẩn trong `.claude/workflows/` (`create-component.md`, `create-api-endpoint.md`, `fix-bug.md`, `code-review-audit.md`, `write-implementation-plan.md`).
