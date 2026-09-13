---
name: zod
description: Zod schema validation best practices for type safety, parsing, and error handling. This skill should be used when defining z.object schemas, using z.string validations, safeParse, or z.infer. Quy chuẩn xác thực dữ liệu đầu vào (Zero-Trust Validation) với Zod trong TypeScript, xuất type an toàn qua `z.infer`, xử lý safeParse và chuẩn hóa lỗi.
---

# Zod Best Practices (Quy Chuẩn Xác Thực Dữ Liệu Zod)

Hướng dẫn toàn diện về kiểm tra tính hợp lệ dữ liệu (schema validation) bằng Zod trong ứng dụng TypeScript. Bao gồm 43 quy tắc được phân bổ theo 8 danh mục, sắp xếp theo mức độ ảnh hưởng từ cao xuống thấp để hướng dẫn tái cấu trúc và sinh mã nguồn chuẩn xác.

## Khi Nào Áp Dụng Skill Này

Tham khảo các hướng dẫn này khi:
- Viết mới các Zod Schema cho `req.body`, `req.query`, `req.params`.
- Lựa chọn giữa `parse()` và `safeParse()`.
- Trích xuất kiểu dữ liệu tĩnh an toàn với `z.infer<typeof Schema>`.
- Xử lý lỗi validation và format thông báo phản hồi thân thiện cho client.
- Ghép nối các object schema phức tạp (`extend`, `pick`, `omit`, `merge`).
- Sử dụng biến đổi dữ liệu (`transform`), ép kiểu (`coerce`) và bộ lọc tùy biến (`refine`).
- Tối ưu kích thước bundle và hiệu năng kiểm tra dữ liệu trong các hot paths.
- Review mã nguồn Zod theo các tiêu chuẩn kỹ thuật tốt nhất.

## 8 Nhóm Quy Tắc Theo Mức Độ Ưu Tiên

| Mức Ưu Tiên | Danh Mục Quy Tắc | Tác Động | Tiền Tố File |
|---|---|---|---|
| **1** | Định Nghĩa Schema (Schema Definition) | **NGHIÊM TRỌNG (CRITICAL)** | `schema-` |
| **2** | Phân Tích & Xác Thực (Parsing & Validation) | **NGHIÊM TRỌNG (CRITICAL)** | `parse-` |
| **3** | Suy Luận Kiểu Dữ Liệu (Type Inference) | **CAO (HIGH)** | `type-` |
| **4** | Xử Lý Lỗi (Error Handling) | **CAO (HIGH)** | `error-` |
| **5** | Object Schemas | **TRUNG BÌNH - CAO** | `object-` |
| **6** | Ghép Nối Schema (Schema Composition) | **TRUNG BÌNH** | `compose-` |
| **7** | Refinements & Transforms | **TRUNG BÌNH** | `refine-` |
| **8** | Hiệu Năng & Bundle Size (Performance) | **THẤP - TRUNG BÌNH** | `perf-` |

---

## Bảng Tra Cứu Nhanh (Quick Reference)

### 1. Định Nghĩa Schema (CRITICAL)
- `schema-use-primitives-correctly` - Sử dụng đúng primitive schema (`z.string()`, `z.number()`, `z.boolean()`).
- `schema-use-unknown-not-any` - Luôn dùng `z.unknown()` thay vì `z.any()` để giữ vững type safety.
- `schema-avoid-optional-abuse` - Tránh lạm dụng trường optional không cần thiết.
- `schema-string-validations` - Áp dụng các ràng buộc chuỗi ngay tại schema (`min`, `max`, `trim`, `email`, `regex`).
- `schema-use-enums` - Dùng `z.enum()` cho các tập giá trị chuỗi cố định.
- `schema-coercion-for-form-data` - Dùng `z.coerce` cho dữ liệu chuỗi từ form và query params (chuyển đổi số, boolean, ngày).

### 2. Phân Tích & Xác Thực (CRITICAL)
- `parse-use-safeparse` - Luôn dùng `safeParse()` để tránh throw exception không kiểm soát tại controller/middleware.
- `parse-async-for-async-refinements` - Dùng `parseAsync` khi có refine bất đồng bộ (e.g. check DB unique).
- `parse-handle-all-issues` - Xử lý toàn bộ danh sách lỗi validation, không chỉ dừng ở lỗi đầu tiên.
- `parse-validate-early` - Kiểm tra dữ liệu ngay tại ranh giới hệ thống (ngay khi request vào controller).
- `parse-avoid-double-validation` - Tránh parse lặp lại cùng một dữ liệu ở nhiều tầng.
- `parse-never-trust-json` - Tuyệt đối không tin tưởng output của `JSON.parse` mà không bọc qua Zod.

### 3. Suy Luận Kiểu Dữ Liệu (HIGH)
- `type-use-z-infer` - Luôn suy luận type bằng `type DTO = z.infer<typeof Schema>` thay vì viết tay interface.
- `type-input-vs-output` - Phân biệt `z.input` (dữ liệu đầu vào) và `z.infer` (dữ liệu sau transform).
- `type-export-schemas-and-types` - Xuất song song cả schema runtime và kiểu tĩnh TypeScript từ file schema.
- `type-branded-types` - Sử dụng branded types (`z.string().brand<'UserId'>()`) cho domain ID an toàn.
- `type-enable-strict-mode` - Bật chế độ `strict: true` trong `tsconfig.json`.

### 4. Xử Lý Lỗi (HIGH)
- `error-custom-messages` - Cung cấp thông báo lỗi Tiếng Việt rõ ràng, thân thiện cho người dùng.
- `error-use-flatten` - Sử dụng `error.flatten()` để cấu trúc lỗi trả về theo từng trường dữ liệu cho frontend.
- `error-path-for-nested` - Định vị chính xác đường dẫn trường lỗi lồng nhau qua `issue.path`.
- `error-avoid-throwing-in-refine` - Trả về `false` trong hàm `refine`, không tự ý ném ngoại lệ.

### 5. Object Schemas (MEDIUM-HIGH)
- `object-strict-vs-strip` - Dùng `strip()` (mặc định) để loại bỏ fields lạ, hoặc `strict()` để từ chối các trường thừa (phòng chống Mass Assignment).
- `object-partial-for-updates` - Dùng `schema.partial()` cho các API cập nhật từng phần (PATCH).
- `object-pick-omit` - Tái sử dụng schema qua `pick` và `omit`.
- `object-extend-for-composition` - Mở rộng thêm trường mới bằng `extend()`.
- `object-discriminated-unions` - Dùng discriminated union cho các dạng message hoặc sự kiện đa hình.

### 6. Ghép Nối Schema (MEDIUM)
- `compose-shared-schemas` - Tách các schema dùng chung (như ObjectId, PaginationQuery) ra module dùng chung.
- `compose-intersection` - Kết hợp nhiều schemas bằng `and()` hoặc `intersection()`.
- `compose-lazy-recursive` - Dùng `z.lazy()` cho cấu trúc dữ liệu đệ quy (e.g. cây thư mục, bình luận lồng nhau).
- `compose-pipe` - Dùng `pipe()` cho quy trình tiền xử lý và validate nhiều bước.

### 7. Refinements & Transforms (MEDIUM)
- `refine-vs-superrefine` - Dùng `superRefine()` khi cần thêm nhiều lỗi tùy chỉnh ở các path khác nhau.
- `refine-defaults` - Đặt giá trị mặc định bằng `default()` cho các trường không bắt buộc.

### 8. Hiệu Năng & Kích Thước Bundle (LOW-MEDIUM)
- `perf-cache-schemas` - Khởi tạo schema một lần ở ngoài hàm/controller, tránh khởi tạo lại schema trong mỗi request.
- `perf-avoid-dynamic-creation` - Không tạo schema động trong các vòng lặp hoặc hot paths.

---

## Hướng Dẫn Sử Dụng Chi Tiết

Đọc các file hướng dẫn chi tiết kèm ví dụ code trong thư mục `references/`:
- Cấu trúc từng quy tắc: `references/{prefix}-{slug}.md`
- Toàn bộ nội dung tổng hợp: `AGENTS.md`
