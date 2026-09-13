# Workflow: Kiểm Toán & Đánh Giá Mã Nguồn (Code Review & Audit)

> **Tiêu chuẩn tích hợp**: Tích hợp quy chuẩn chuyên sâu từ `mattpocock/skills` (code-review), các nguyên tắc bảo mật, type-safety, token-economy và kiểm toán chú thích code bằng Tiếng Việt.

---

## Quy Trình Thực Hiện (SOP Flow)

```
[Bước 1: Rà Soát Type Safety] ──> [Bước 2: Quét Bảo Mật & Secrets] ──> [Bước 3: Dọn Rác & Debug Code] ──> [Bước 4: Kiểm Toán Chú Thích Tiếng Việt & Rules]
```

---

### Bước 1: Rà Soát Type Safety Toàn Diện
1. **Truy Quét Kiểu `any`**:
   - Sử dụng ripgrep/grep quét toàn bộ codebase để phát hiện việc sử dụng kiểu `any` lỏng lẻo:
     - Bắt buộc thay thế bằng kiểu dữ liệu chính xác, `unknown` (kèm type guard) hoặc generics.
2. **Boundary Validation**:
   - Đảm bảo tất cả dữ liệu từ bên ngoài (API response, DB query result, Form input) đều có runtime validation (Zod) trước khi type-cast.
3. **Strict Null Checks**:
   - Kiểm tra các vị trí tiềm ẩn lỗi `TypeError: Cannot read properties of undefined/null`.

---

### Bước 2: Kiểm Tra An Toàn & Rò Rỉ Bí Mật (Secrets & Security Scan)
1. **Quét Hardcoded Credentials**:
   - Tuyệt đối không để lộ API keys, JWT secrets, database connection strings, hoặc token bí mật trong mã nguồn.
   - Xác thực rằng mọi giá trị nhạy cảm đều được đọc từ biến môi trường (`process.env.*` hoặc config loader).
2. **Xác Thực File `.env*`**:
   - Đảm bảo các tệp bí mật cục bộ nằm trong danh sách ignore (`.agentignore`, `.claudeignore`, `.gitignore`).
   - Kiểm tra xem `.env.example` đã được cập nhật đầy đủ các biến mới (với giá trị placeholder) hay chưa.

---

### Bước 3: Quét Rác & Debug Logs Thừa
1. **Console Logs & Print Statements**:
   - Quét và loại bỏ toàn bộ `console.log`, `print()`, `debugger`, `alert()` được dùng tạm thời trong quá trình phát triển.
   - Thay thế các log cần thiết cho việc vận hành hệ thống bằng Logger chuyên dụng (`logger.info`, `logger.error`).
2. **Dead Code & Commented-out Blocks**:
   - Xóa bỏ các khối mã nguồn bị comment bỏ không còn sử dụng.
   - Xóa bỏ các import dư thừa (unused imports).

---

### Bước 4: Kiểm Toán Chú Thích Code Tiếng Việt & Domain Rules
1. **Kiểm Toán Chú Thích Tiếng Việt (Vietnamese Comments Audit)**:
   - **Bắt buộc**: Mỗi khối code (DTO schema, Controller handler, Service logic, UI Component state, Custom Hooks, Helper) đều phải có chú thích bằng Tiếng Việt rõ ràng, súc tích.
   - Ghi nhận `[ACTION REQUIRED]` nếu phát hiện các khối logic phức tạp bị thiếu chú thích giải thích.
2. **Frontend Compliance (`rules/frontend.md`)**:
   - Có tuân thủ Atomic Design không?
   - Có tách biệt logic nghiệp vụ sang Custom Hooks không?
   - Có hardcode mã màu `#hex` hoặc `rgb()` không? Có dùng Tailwind Semantic Tokens không?
   - Đã xử lý đầy đủ 4 trạng thái UI (Loading Skeleton, Empty, Error, Success) chưa?
   - Đã có `aria-label`, trạng thái focus/hover/disabled chưa?
3. **Backend Compliance (`rules/backend.md`)**:
   - Có tuân thủ mô hình 3 tầng (Controller -> Service -> Repository) không?
   - Dữ liệu input có được validate bằng Schema trước khi vào Service không?
   - Lỗi trả về có đúng chuẩn `{ success: false, error: { code, message } }` và không lộ stack trace không?
   - Có nguy cơ N+1 query không? Thao tác ghi đa bảng đã bọc trong Transaction chưa?
4. **Xuất Báo Cáo Audit**:
   - Tóm tắt kết quả theo định dạng ngắn gọn: [PASS] / [ACTION REQUIRED], kèm số dòng cụ thể cần sửa.
