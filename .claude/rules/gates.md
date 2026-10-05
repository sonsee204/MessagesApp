# Quality Gates Matrix & Enforcement Guide

> **Mục tiêu**: Tra cứu nhanh toàn bộ ma trận kiểm soát chất lượng mã nguồn (Quality Gates), bao gồm các gate scripts tự động (`scripts/gates/`), hook cục bộ (`.claude/hooks/`), và GitHub Actions CI.

---

## 1. Ma Trận Quality Gates (Scripts)

| Gate | Script | Chạy tại đâu | Điều kiện kích hoạt | Mã thoát | Cách bypass hợp lệ |
|---|---|---|---|---|---|
| **Hard Bans** | `scripts/gates/diff-bans.mjs` | Local Hook (`stop-gates.ps1`) + CI | Có diff mã nguồn TypeScript/JavaScript | 0 = sạch, 1 = có vi phạm | `// allow-any: <lý do>`, `// allow-ts-ignore: <lý do>`, `// allow-ts-nocheck: <lý do>`, `// allow-console: <lý do>` |
| **Size Gate** | `scripts/gates/size-gate.mjs` | Local Hook (`stop-gates.ps1`) + CI | Toàn bộ tệp `.ts`/`.tsx` trong `src/` (backend & frontend) | 0 = đạt, 1 = vượt baseline | Ratchet baseline: chỉ cho phép giảm số dòng hoặc chạy `--update` khi có phê duyệt kiến trúc |
| **Type Check** | `scripts/gates/tsc-gate.mjs` | Local Hook (`stop-gates.ps1`) + CI | Có diff mã nguồn backend hoặc frontend | 0 = pass, 1 = lỗi type | Bắt buộc sửa lỗi type, không bypass |
| **Tests** | `scripts/gates/affected-tests.mjs` | CI (và chạy thủ công) | PR / CI push khi có thay đổi mã nguồn | 0 = pass, 1 = test fail | Sửa test hoặc cập nhật test case |
| **OCR Gate** | `scripts/gates/ocr-gate.mjs` | CI (Delegation Mode) | PR / CI push | 0 = pass / skipped | Miễn trừ tự động khi task chỉ sửa docs, governance files hoặc Git/CI |

---

## 2. Ma Trận Claude Hooks Cục Bộ (`.claude/settings.json`)

| Hook Event | Script Hook | Mục đích & Các Gate Kích Hoạt | Hành vi xử lý |
|---|---|---|---|
| **Stop** | `.claude/hooks/stop-gates.ps1` | Kiểm tra tự động trước khi kết thúc task khi có thay đổi mã nguồn trong `backend/src` hoặc `frontend/src`. Chạy tuần tự: `diff-bans.mjs`, `size-gate.mjs` (frontend & backend), và `tsc-gate.mjs`. Tự động bỏ qua nếu chỉ thay đổi docs/config. | Exit 1 nếu bất kỳ gate nào thất bại, buộc agent sửa lỗi trước khi hoàn tất task. |
| **PreToolUse** (`EnterWorktree`) | `.claude/hooks/block-worktree.ps1` | Chặn hoàn toàn việc tạo git worktree theo quy định Git Workflow của repo. | Exit 1, ngăn chặn công cụ `EnterWorktree` thực thi và yêu cầu dùng git branch trên cùng checkout. |
| **UserPromptSubmit** | `.claude/hooks/routing-reminder.ps1` | Nhắc nhở định tuyến task theo Tier (Tier 1 Haiku, Tier 2 Sonnet, Tier 3 Opus) ngay khi nhận prompt từ người dùng. | Exit 0, in cảnh báo gợi ý Tier vào ngữ cảnh phiên. |

---

## 3. Hướng Dẫn Chạy Thủ Công & Kiểm Tra Cục Bộ

Khi cần chạy kiểm tra cục bộ độc lập:

```bash
# 1. Kiểm tra các điều cấm trong diff
node scripts/gates/diff-bans.mjs

# 2. Kiểm tra kích thước tệp (Size Gate)
npm --prefix frontend run size-gate:strict
node scripts/gates/size-gate.mjs --src backend/src --baseline backend/size-gate-baseline.json --strict

# Cập nhật baseline khi được phê duyệt
npm --prefix frontend run size-gate:update
node scripts/gates/size-gate.mjs --src backend/src --baseline backend/size-gate-baseline.json --update

# 3. Kiểm tra TypeScript type-check
node scripts/gates/tsc-gate.mjs

# 4. Kiểm tra tests bị ảnh hưởng
node scripts/gates/affected-tests.mjs

# 5. Chạy Open-Codereview Gate (Delegation Preview)
node scripts/gates/ocr-gate.mjs
```

---

## 4. Danh Mục Miễn Trừ (Exemption Policy)
- **Ngoại lệ OCR Gate**: Task chỉ chạm vào tài liệu markdown (`.md`), tệp cấu hình quản trị governance (`.claude/rules/`, `.claude/workflows/`, `CLAUDE.md`), hoặc các tác vụ Git/CI được tự động miễn trừ chạy `ocr`.
- **Bypass Diff Bans**: Chỉ áp dụng khi có lý do kỹ thuật chính đáng và bắt buộc phải kèm chú thích tiếng Việt giải thích:
  - `// allow-any: <lý do kỹ thuật bắt buộc dùng any>`
  - `// allow-ts-ignore: <lý do lỗi thư viện bên thứ ba>`
  - `// allow-ts-nocheck: <lý do file cũ chưa kịp sửa type>`
  - `// allow-console: <lý do debug trong môi trường dev/script>`
