# Workflow: Chẩn Đoán & Khắc Phục Lỗi (Fix Bug SOP)

> **Tiêu chuẩn tích hợp**: Tích hợp quy chuẩn chuyên sâu từ `mattpocock/skills` (diagnosing-bugs) và chiến lược Zero-Loop nhằm khắc phục sự cố nhanh chóng, tránh sửa mò, tiết kiệm token quota và chú thích code bằng Tiếng Việt.

---

## Quy Trình Thực Hiện (SOP Flow)

```
[Bước 1: Đọc Log & Traces] ──> [Bước 2: Cô Lập Vị Trí] ──> [Bước 3: Tóm Tắt Root Cause 1 Câu] ──> [Bước 4: Bản Vá Tối Giản] ──> [Bước 5: Chạy Test Kiểm Chứng] ──> [Bước 6: React Doctor Gate (frontend)]
```

---

### Bước 1: Đọc Log & Phân Đoạn Stack Trace
1. Đọc đúng đoạn log báo lỗi hoặc output của test thất bại. Không dump toàn bộ lịch sử console.
2. Trích xuất:
   - Tên lỗi (Error Name) và thông điệp lỗi (Error Message).
   - Dòng code phát sinh lỗi đầu tiên trong mã nguồn dự án (`src/...:line:col`), bỏ qua các dòng trong `node_modules`.

---

### Bước 2: Cô Lập Vị Trí Lỗi (Surgical Inspection)
1. Chỉ mở đúng tệp tin và các dòng xung quanh vị trí gây lỗi bằng `Read` có `offset` và `limit` (hoặc `Grep`).
2. Kiểm tra các giá trị biến đầu vào tại điểm sập (null, undefined, sai kiểu dữ liệu, race condition, hoặc async mismatch).

---

### Bước 3: Tóm Tắt Root Cause Trong Đúng 1 Câu
- **Zero-Loop Constraint**: Bắt buộc phát biểu nguyên nhân gốc rễ (Root Cause) trong đúng 1 câu ngắn gọn trước khi chạm vào mã nguồn:
  > *"Nguyên nhân: Hàm `getUserProfile` truy cập thuộc tính `user.settings.theme` khi `user.settings` mang giá trị `null` do bản ghi chưa được khởi tạo giá trị mặc định."*
- Nếu chưa giải thích được bằng 1 câu rõ ràng, tiếp tục kiểm tra dữ liệu thay vì vội vàng sửa code.

---

### Bước 4: Áp Dụng Bản Vá Tối Giản (Targeted Patch)
1. Sử dụng công cụ sửa chuỗi chính xác (`Edit`).
2. Chỉ sửa đúng dòng hoặc hàm bị ảnh hưởng:
   - Xử lý tận gốc nguyên nhân (thêm default values, optional chaining, guard clauses, hoặc fix race condition).
   - Không tự ý refactor các phần code không liên quan xung quanh.
   - Giữ nguyên cấu trúc hiện có kèm chú thích `// ... existing code ...`.

---

### 📝 Quy Chuẩn Chú Thích (Code Comments)
- **Bắt buộc chú thích lại bằng Tiếng Việt cho mỗi khối code được vá**:
  - Viết chú thích giải thích ngắn gọn nguyên nhân lỗi và giải pháp tại ngay khối code được sửa.
  - Ví dụ:
    ```typescript
    // [Fix Bug] Kiểm tra giá trị null/undefined để tránh crash khi người dùng chưa cấu hình settings
    if (!user.settings) {
      return defaultSettings;
    }
    ```

---

### Bước 5: Chạy Test Kiểm Chứng & Xác Nhận
1. Chạy đúng file test hoặc lệnh tái hiện lỗi để xác thực bản vá:
   ```bash
   npm test -- <path-to-test>
   ```
2. Đảm bảo:
   - Lỗi ban đầu đã được giải quyết triệt để.
   - Không gây ra hồi quy (regression) cho các chức năng khác.
   - Nếu test vẫn thất bại sau 2 lần sửa, dừng lại đánh giá lại giả định kiến trúc ban đầu.

---

### Bước 6: React Doctor Gate (Bắt Buộc — chỉ task frontend)
Nếu bản vá chạm vào mã nguồn frontend (`frontend/src/`), chạy React Doctor sau khi test xanh:
```bash
cd frontend && npx react-doctor@latest
```
- Mục tiêu: không phát sinh lỗi mới so với trước khi vá. Nếu có: sửa code, không suppress tùy tiện; chỉ suppress khi lý do kỹ thuật rõ ràng và phải ghi chú Tiếng Việt tại chỗ.
- Nếu lệnh không chạy được (mất mạng/registry lỗi): báo trung thực **CHƯA verify được React Doctor**, không tuyên bố bug đã xong.
- Task backend thuần: bỏ qua bước này.
