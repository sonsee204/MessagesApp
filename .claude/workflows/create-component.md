# Workflow: Tạo UI Component Mới (Create Component)

> **Mục tiêu**: Hướng dẫn từng bước xây dựng một UI component mới tuân thủ Atomic Design, type-safe, Tailwind CSS, đủ 4 UI states và có chú thích code bằng Tiếng Việt.

---

## Quy Trình Thực Hiện (SOP Flow)

```
[Bước 1: Khảo Sát Props] ──> [Bước 2: Viết Type Safe Definition] ──> [Bước 3: Scaffolding 4 UI States] ──> [Bước 4: Type-Check & Verification] ──> [Bước 5: React Doctor Gate]
```

---

### Bước 1: Khảo Sát Props & Phân Cấp Atomic
1. Xác định vị trí phân cấp:
   - `atoms/`: Nút bấm, input, badge đơn lẻ.
   - `molecules/`: Form field (kết hợp label + input + error text), thẻ tìm kiếm.
   - `organisms/`: Bảng dữ liệu, danh sách sản phẩm, modal phức tạp.
2. Xác định các dữ liệu đầu vào và các hành vi tương tác cần tiếp nhận từ bên ngoài.

---

### Bước 2: Viết Type Definition An Toàn
1. Khai báo interface props rõ ràng, không dùng `any`:
   ```typescript
   export interface ComponentProps<T> {
     title: string;
     data?: T[];
     isLoading?: boolean;
     error?: Error | null;
     onAction?: (item: T) => void;
     className?: string;
   }
   ```
2. Tách biệt rõ giữa Data Props, Behavior Callbacks và Style Modifiers.

---

### Bước 3: Scaffolding Component Kèm 4 UI States
1. Tạo file component với Tailwind CSS và Semantic tokens (không dùng `#hex`).
2. Tách logic nghiệp vụ sang Custom Hook nếu component có xử lý state phức tạp.
3. Đảm bảo xử lý đủ 4 trạng thái:
   - **Loading**: Render Skeleton matching layout (`<Skeleton className="..." />`).
   - **Empty**: Render EmptyState component với icon, text và nút tạo mới.
   - **Error**: Render Error message trực quan kèm nút `Retry`.
   - **Success**: Render nội dung chính thức với key prop duy nhất.
4. Thêm các thuộc tính a11y: `aria-label`, `disabled:`, `hover:`, `focus-visible:ring-2`.

---

### 📝 Quy Chuẩn Chú Thích (Code Comments)
- **Bắt buộc chú thích lại bằng Tiếng Việt cho mỗi khối code**:
  - Chú thích mục đích của Component và các Props interface.
  - Chú thích tại từng khối logic rẽ nhánh (Loading, Empty, Error, Success).
  - Chú thích rõ ràng các hàm xử lý sự kiện (`handleClick`, `handleSubmit`, `onChange`).

---

### Bước 4: Kiểm Tra Type-Check & Linter
1. Chạy lệnh kiểm tra type toàn diện:
   ```bash
   npm run build -- --noEmit # hoặc tsc --noEmit
   ```
2. Đảm bảo không có lỗi type mismatch, props bị thiếu, hoặc cảnh báo từ linter.

### Bước 5: React Doctor Gate (Bắt Buộc)
Sau khi build xanh, chạy React Doctor làm gate chất lượng cuối cùng:
```bash
cd frontend && npx react-doctor@latest
```
- Nếu có lỗi: sửa code đạt chuẩn, không suppress tùy tiện. Chỉ suppress khi có lý do kỹ thuật rõ ràng và ghi chú Tiếng Việt tại chỗ.
- Nếu lệnh không chạy được (mất mạng/registry): báo **CHƯA verify được React Doctor**, không tuyên bố task xong.
- Ghi điểm kết quả vào báo cáo xác minh.
