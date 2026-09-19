# Workflow: Kiểm Toán & Đánh Giá Mã Nguồn (Code Review & Audit)

> **Tiêu chuẩn tích hợp**: Tích hợp quy chuẩn chuyên sâu từ `mattpocock/skills` (code-review), các nguyên tắc bảo mật, type-safety, token-economy và kiểm toán chú thích code bằng Tiếng Việt.

---

## Quy Trình Thực Hiện (SOP Flow)

```
[Bước 1: Rà Soát Type Safety] ──> [Bước 2: Quét Bảo Mật & Secrets] ──> [Bước 3: Dọn Rác & Debug Code] ──> [Bước 4: Kiểm Toán Chú Thích Tiếng Việt & Rules] ──> [Bước 5: Chạy Open-Codereview Bắt Buộc]
```

> **Bước 5 là cổng chặn (hard gate)**: Tuyệt đối không báo task hoàn thành khi chưa chạy xong `ocr` theo hướng dẫn Bước 5.

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

---

### Bước 5: Chạy Open-Codereview Bắt Buộc (Gate Hoàn Thành Task)

> **Công cụ**: `@alibaba-group/open-code-review` (CLI `ocr`) — <https://github.com/alibaba/open-code-review>.
> Đây là **cổng chặn cuối cùng**: mọi task có thay đổi mã nguồn (backend/frontend) đều phải chạy xong bước này mới được báo DONE.

#### 5.1. Cài đặt & cấu hình (lần đầu)
```bash
npm install -g @alibaba-group/open-code-review

# Bắt buộc cấu hình LLM trước khi review (trừ khi dùng Delegation Mode)
ocr config provider          # chọn provider built-in hoặc thêm custom
ocr config model             # chọn model cho provider đang active
```
- Lưu ý: không hardcode API key vào mã nguồn hay commit cấu hình chứa key; đặt key trong biến môi trường.
- Xác nhận key đã nằm trong `.gitignore` nếu cấu hình ghi ra file local.

#### 5.2. Chạy review
```bash
cd your-project

# Workspace mode — review toàn bộ thay đổi staged, unstaged, untracked
ocr review

# Khoảng branch — review diff của feature-branch kể từ khi tách khỏi main
ocr review --from main --to feature-branch

# Commit đơn lẻ
ocr review --commit abc123

# Quét toàn file thay vì diff (không cần git history)
ocr scan                          # quét toàn repo
ocr scan --path internal/agent    # quét theo thư mục/file cụ thể

# Lưu kết quả ra file (bắt buộc đối với AI host agent)
ocr review --format json --output result.json
```

- **Resume**: dùng `ocr session list` và `--resume <session-id>` để nối lại review bị gián đoạn.
- **Delegation Mode** (khi chưa cấu hình LLM): `ocr delegate preview` / `ocr delegate rule <files...>` — OCR lo phần chọn file và giải quy tắc, AI agent thực hiện review.

#### 5.3. Xử lý kết quả
1. Phân loại từng finding theo mức độ: **critical / major / minor**.
2. **Critical & major**: bắt buộc sửa hoặc đưa ra lý do kỹ thuật chính đáng (kèm chú thích Tiếng Việt tại chỗ) trước khi báo DONE.
3. **Minor**: ghi nhận vào danh sách tồn đọng; không được phép bỏ qua im lặng.
4. Xoá file `result.json` tạm khỏi working tree sau khi đã trích xuất kết quả (nếu đã thêm vào `.gitignore` thì bỏ qua bước này).

#### 5.4. Báo cáo kết quả OCR trong Output Contract
Mọi báo cáo hoàn thành task phải kèm dòng xác minh:
```
VERIFICATION (Open-Codereview):
- ocr review --format json --output result.json: <số> findings (critical=<x>, major=<y>, minor=<z>)
- Đã xử lý: <mô tả ngắn> | Tồn đọng: <mô tả hoặc "None">
```

#### 5.5. Ngoại lệ không chạy OCR
Chỉ được bỏ qua khi task **không động đến mã nguồn**, ví dụ: sửa docs thuần (`.md`), governance files (`.claude/rules`, `.claude/workflows`, `CLAUDE.md`), hoặc tác vụ Git/CI. Nếu bỏ qua, phải ghi rõ lý do trong báo cáo.
