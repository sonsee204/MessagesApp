# Hard Bans — CẤM TUYỆT ĐỐI (shell mỏng)

> Rule vỏ mỏng: khai báo các điều cấm toàn repo. Công cụ gate tương ứng sẽ
> lắp dần theo milestone (F2). Cập nhật trạng thái "thực thi" khi có tool.

## Danh mục cấm

| # | Điều cấm | Cơ chế thực thi | Trạng thái |
|---|---|---|---|
| 1 | Type `any` (code mới) | TypeScript `strict` + ESLint `@typescript-eslint/no-explicit-any` | `strict: true` **đã bật** ở frontend; ESLint **chưa có** trong repo — enforce bằng code review cho tới khi lắp ESLint |
| 2 | Directive mới `@ts-nocheck` / `@ts-ignore` | Cấm thêm mới; code cũ phải có lý do + chú thích Tiếng Việt | Enforce bằng code review + grep |
| 3 | God file > **400 dòng hiệu dụng** (không tính dòng trống và chú thích thuần) | `npm run size-gate:strict` (baseline ratchet — chỉ cho phép giảm, không được tăng) | **CHƯA có** script `size-gate` trong package.json — sẽ lắp sau F2; tạm thời enforce bằng code review |
| 4 | Báo task DONE khi chưa chạy Open-Codereview (`ocr`) trên diff mã nguồn | `.claude/workflows/code-review-audit.md` Bước 5 (hard gate) | Enforce bằng code review + Output Contract (bắt buộc kèm khối `VERIFICATION (Open-Codereview)`) |

> **Ghi chú thực thi (Dependency Guard):** Repo hiện là npm-based (`frontend/package-lock.json`); chưa thấy script `size-gate` trong bất kỳ `package.json` nào. Lệnh gate sẽ được bổ sung đúng theo toolchain đang dùng; không giả định pnpm hay package chưa khai báo.

## Quy ước áp dụng
- Áp dụng cho **code mới và code bị sửa** trong diff (không đòi hỏi xử lý toàn bộ nợ cũ ngay).
- Vi phạm điều cấm trong diff phải sửa trước khi merge, không accept "TODO làm sau".
- Khi tool gate chưa tồn tại, Claude Code tự kiểm trước khi báo xong task:
  grep `any`/`@ts-ignore` trong diff và đếm dòng hiệu dụng của file chạm vào.

> **Ngoại lệ điều cấm #4**: không phải chạy `ocr` khi task chỉ chạm docs thuần (`.md`), governance files (`.claude/rules`, `.claude/workflows`, `CLAUDE.md`), hoặc tác vụ Git/CI — nhưng phải ghi rõ lý do bỏ qua trong báo cáo task.
