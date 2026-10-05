# Hard Bans — CẤM TUYỆT ĐỐI

> Khai báo các điều cấm toàn repo. Các điều cấm được kiểm soát tự động qua hệ thống gates (`scripts/gates/`), hook cục bộ (`.claude/hooks/stop-gates.ps1`), và GitHub Actions CI. Xem chi tiết tại `.claude/rules/gates.md`.

## Danh mục cấm

| # | Điều cấm | Cơ chế thực thi | Trạng thái |
|---|---|---|---|
| 1 | Type `any` (code mới) | `scripts/gates/diff-bans.mjs` + TypeScript `strict` + CI job | **ĐÃ LẮP**. `diff-bans` quét diff chặn `any` (bypass bằng `// allow-any: <lý do>`). ESLint nói chung **chưa có** trong repo. |
| 2 | Directive mới `@ts-nocheck` / `@ts-ignore` | `scripts/gates/diff-bans.mjs` + CI job | **ĐÃ LẮP**. Chặn thêm mới trong diff (bypass bằng `// allow-ts-ignore: <lý do>` hoặc `// allow-ts-nocheck: <lý do>`). |
| 3 | God file > **400 dòng hiệu dụng** (không tính dòng trống và chú thích thuần) | `scripts/gates/size-gate.mjs` + ratchet baseline (`frontend/size-gate-baseline.json`, `backend/size-gate-baseline.json`) | **ĐÃ LẮP**. Chạy tự động qua `stop-gates.ps1` và CI; ratchet chỉ cho phép giảm số dòng hoặc cập nhật có phê duyệt (`--update`). |
| 4 | Báo task DONE khi chưa chạy Open-Codereview (`ocr`) trên diff mã nguồn | `scripts/gates/ocr-gate.mjs` + CI job + Output Contract | **ĐÃ LẮP (Delegation Mode)**. Tự động kiểm tra hoặc ủy quyền preview; exit 0 an toàn khi môi trường thiếu công cụ `ocr`. |

> **Ghi chú thực thi (Dependency Guard):** Toàn bộ gate scripts được viết bằng vanilla Node.js ESM trong `scripts/gates/`, không thêm dependencies ngoài. Frontend đã tích hợp script `size-gate:strict` trong `package.json`, hook `stop-gates.ps1` kích hoạt kiểm tra tự động trước khi kết thúc task.

## Quy ước áp dụng
- Áp dụng cho **code mới và code bị sửa** trong diff (không đòi hỏi xử lý toàn bộ nợ cũ ngay).
- Vi phạm điều cấm trong diff phải sửa trước khi merge, không accept "TODO làm sau".
- Hệ thống hook `.claude/hooks/stop-gates.ps1` tự động kích hoạt kiểm tra khi kết thúc task; CI workflow `.github/workflows/gates.yml` bảo đảm kiểm soát trước khi merge PR.

> **Ngoại lệ điều cấm #4**: không phải chạy `ocr` khi task chỉ chạm docs thuần (`.md`), governance files (`.claude/rules`, `.claude/workflows`, `CLAUDE.md`), hoặc tác vụ Git/CI — nhưng phải ghi rõ lý do bỏ qua trong báo cáo task.
