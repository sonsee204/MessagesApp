# Workflow: Tạo API Endpoint Mới (Create API Endpoint)

> **Mục tiêu**: Xây dựng API endpoint chuẩn theo mô hình Layered Architecture, xác thực Schema nghiêm ngặt, chuẩn hóa phản hồi lỗi và có chú thích code bằng Tiếng Việt.

---

## Quy Trình Thực Hiện (SOP Flow)

```
[Bước 1: Định Nghĩa DTO/Schema] ──> [Bước 2: Viết Service Logic] ──> [Bước 3: Viết Route Controller] ──> [Bước 4: Test Validation & Errors]
```

---

### Bước 1: Định Nghĩa DTO / Validation Schema
1. Tạo schema xác thực dữ liệu đầu vào (Zod/Joi/Pydantic):
   ```typescript
   // Schema xác thực thông tin đầu vào khi tạo resource mới
   export const CreateResourceSchema = z.object({
     name: z.string().trim().min(1).max(100),
     email: z.string().email(),
     role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
   });
   export type CreateResourceDTO = z.infer<typeof CreateResourceSchema>;
   ```
2. Đảm bảo có schema riêng cho Query Params (phân trang, bộ lọc) và Path Params (ID format).

---

### Bước 2: Viết Service Logic (Nghiệp Vụ & Domain Rules)
1. Thêm method vào Service tương ứng (`services/resource.service.ts`).
2. Kiểm tra các ràng buộc nghiệp vụ:
   - Quyền hạn của user (Authorization).
   - Kiểm tra tính duy nhất (Unique constraints).
3. Sử dụng Database Transaction nếu thực hiện ghi vào nhiều bảng liên quan.
4. Ném lỗi domain cụ thể (e.g. `ConflictError`, `NotFoundError`). Service không được truy cập đối tượng HTTP `req` / `res`.

---

### Bước 3: Viết Route Controller & Middleware
1. Khởi tạo phương thức điều hướng trong Controller:
   - Gắn Validation Middleware để parse và sanitize `req.body` / `req.query`.
   - Gọi Service method với DTO hợp lệ.
   - Trả về JSON thành công kèm status code thích hợp (`200` hoặc `201`):
     ```json
     { "success": true, "data": { ... } }
     ```
2. Đăng ký endpoint vào Route Router kèm auth middleware nếu là protected route.

---

### 📝 Quy Chuẩn Chú Thích (Code Comments)
- **Bắt buộc chú thích lại bằng Tiếng Việt cho mỗi khối code**:
  - Chú thích mục đích của từng trường trong Zod Schema / DTO.
  - Chú thích từng bước logic nghiệp vụ trong Service methods (kiểm tra điều kiện, xử lý dữ liệu, ghi log, transaction).
  - Chú thích rõ ràng mã phản hồi HTTP và ý nghĩa dữ liệu trong Controller handlers.

---

### Bước 4: Kiểm Tra Validation & Error Response
1. Viết hoặc chạy API Test kiểm tra:
   - **Happy Path**: Gửi payload chuẩn -> Nhận `200`/`201` và data.
   - **Invalid Body**: Gửi payload thiếu trường hoặc sai kiểu -> Nhận `400 Bad Request` kèm chi tiết lỗi.
   - **Standard Error Format**: Đảm bảo lỗi trả về đúng cấu trúc `{ success: false, error: { code, message } }` và không lộ stack trace.
