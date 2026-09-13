# Backend Architecture & Quality Rules

> **Tiêu chuẩn tích hợp**: Tích hợp các quy chuẩn chuẩn hóa từ `supabase/agent-skills` (Data integrity, Auth, RLS) và `prisma/skills` (ORM best practices, Type-safe DB operations).

---

## 1. Kiến Trúc Phân Tầng Rành Mạch (Layered Architecture)
Tất cả các backend modules bắt buộc phân tách thành 3 tầng độc lập:

1. **Controller Layer (Giao diện API)**:
   - Nhiệm vụ: Tiếp nhận HTTP request, trích xuất headers/params/body, áp dụng Validation Middleware, và trả về HTTP response.
   - Tuyệt đối không chứa logic nghiệp vụ và không thực hiện câu lệnh truy vấn CSDL trực tiếp.
2. **Service Layer (Logic Nghiệp Vụ)**:
   - Nhiệm vụ: Thực thi toàn bộ business rules, kiểm tra quyền hạn, tính toán, và điều phối các repositories.
   - Hoàn toàn độc lập với giao thức truyền tải (không nhận đối tượng `req`, `res`).
3. **Repository / ORM Layer (Truy Xuất Dữ Liệu)**:
   - Nhiệm vụ: Tương tác với CSDL (Prisma, Drizzle, Supabase Client, TypeORM hoặc SQL queries).
   - Đóng gói logic query phức tạp, trả về typed models hoặc domain entities cho Service layer.

---

## 2. Validation Layer (Zero-Trust Input)
- **Bắt Buộc Schema Validation**: Toàn bộ dữ liệu đầu vào từ client (`req.body`, `req.query`, `req.params`) phải được kiểm tra qua Schema (Zod, Joi, Valibot, Pydantic) trước khi đi vào Service layer.
- **Strict Parsing & Sanitization**:
  - Tự động strip/remove các fields lạ không có trong schema để ngăn ngừa Mass Assignment.
  - Sử dụng schema-inferred types để đảm bảo type-safety tuyệt đối cho backend (e.g. `type CreateUserDTO = z.infer<typeof CreateUserSchema>`).

---

## 3. Chuẩn Hóa Phản Hồi Lỗi (Error Response Standard)
- **Định Dạng JSON Lỗi Nhất Quán**:
  Mọi lỗi trả về cho client bắt buộc phải có cấu trúc:
  ```json
  {
    "success": false,
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "Chi tiết lỗi dễ hiểu cho người dùng",
      "details": []
    }
  }
  ```
- **Bảo Vệ Stack Trace**:
  - Tuyệt đối không để lộ internal stack trace, SQL query logs, hoặc thông tin đường dẫn máy chủ ra client.
  - Xử lý lỗi tập trung qua Global Error Handler middleware và ghi log chi tiết nội bộ qua Logger.
- **HTTP Status Code Chuẩn**:
  - `400 Bad Request`: Lỗi validation.
  - `401 Unauthorized`: Thiếu hoặc sai token.
  - `403 Forbidden`: Đã đăng nhập nhưng không đủ quyền.
  - `404 Not Found`: Không tìm thấy resource.
  - `409 Conflict`: Trùng lặp unique constraint (email, slug).
  - `500 Internal Server Error`: Lỗi máy chủ không lường trước.

---

## 4. Tối Ưu Cơ Sở Dữ Liệu (Database & ORM Best Practices)
- **Database Transactions Cho Thao Tác Ghi Đa Bảng**:
  - Mọi thao tác ghi dữ liệu liên đới 2 bảng trở lên hoặc yêu cầu tính toàn vẹn (e.g. tạo đơn hàng + trừ kho) bắt buộc phải bọc trong Transaction (`prisma.$transaction` hoặc SQL `BEGIN...COMMIT`).
- **Phòng Chống Lỗi N+1 Query**:
  - Tuyệt đối không đặt lệnh query DB bên trong vòng lặp `for` / `forEach` / `map`.
  - Phải sử dụng Eager Loading (`include`, `relations`), `JOIN`, hoặc Batch Loading (`IN (...)`).
- **Tối Ưu Index**:
  - Đảm bảo đánh index cho các trường thường xuyên filter, sort, join và các trường Foreign Key.
- **Phân Trang Bắt Buộc**:
  - Mọi truy vấn danh sách đều phải giới hạn số lượng bản ghi bằng pagination (`limit`, `page`/`cursor`).

---

## 5. Quy Chuẩn Chú Thích Mã Nguồn Bằng Tiếng Việt (Code Comments Mandatory)
Mọi file mã nguồn backend bắt buộc phải có chú thích bằng Tiếng Việt rõ ràng, chuẩn ngữ pháp, súc tích:
- **Schema & DTO Layer**: Chú thích mục đích tổng quan của schema, ý nghĩa từng trường dữ liệu, và các điều kiện ràng buộc/validate đặc thù.
- **Repository Layer**: Chú thích chức năng của từng phương thức truy vấn, các bảng/collections liên đới, và vai trò của Database Transaction Session (nếu có).
- **Service Layer**: Chú thích JSDoc/TSDoc cho từng public method (mô tả chức năng, tham số đầu vào, kết quả trả về, các exception ném ra); kèm theo inline comments chi tiết từng bước kiểm tra nghiệp vụ (check quyền hạn, quan hệ, tính hợp lệ dữ liệu, bước thực thi transaction).
- **Controller Layer**: Chú thích rõ ràng mã phản hồi HTTP (`200 OK`, `201 Created`), mục đích của endpoint và định dạng dữ liệu trả về cho client.
- **Routes Layer**: Phân nhóm routes theo module nghiệp vụ kèm chú thích các middleware bảo vệ (authentication guard, validation schema).
