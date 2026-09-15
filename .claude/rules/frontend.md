# Frontend Architecture & Quality Rules

> **Tiêu chuẩn tích hợp**: Tích hợp các quy chuẩn hàng đầu từ `anthropics/skills` (frontend-design), `vercel-labs/agent-skills` (React best practices), và `leonxlnx/taste-skill` (Modern UI/UX).

---

## 1. Cấu Trúc Atomic Design
Phân chia component theo hệ thống Atomic rõ ràng, tránh tạo các monolithic components:
- `components/atoms/`: Các thành phần nhỏ nhất, không thể phân tách (Button, Input, Badge, Icon, Avatar). Không phụ thuộc dữ liệu bên ngoài.
- `components/molecules/`: Cụm kết hợp 2+ atoms có liên kết ngữ nghĩa (FormField, SearchBar, NotificationItem).
- `components/organisms/`: Khối UI phức tạp, có thể ghép nối từ nhiều molecules/atoms (Header, Sidebar, UserTable, CheckoutCard).
- `components/templates/` & `pages/`: Định vị layout và kết nối dữ liệu từ routing/hooks.

---

## 2. Tách Biệt Rạch Ròi UI và Business Logic (Headless Pattern)
- **Presentational Component**:
  - Component chỉ làm đúng 2 việc: (1) Render UI từ props và (2) Map các event tương tác ra callback props.
  - Không nhúng logic gọi API, debounce, hay tính toán thuật toán phức tạp trực tiếp vào JSX.
- **Headless Logic Extraction**:
  - Toàn bộ business logic, data fetching, mutations, và form handling phải được chuyển sang **Custom Hooks** (`hooks/`) hoặc pure functions trong `lib/` / `utils/`.

---

## 3. Tailwind CSS & Design Tokens
- **Mobile-First Responsive**: Thiết kế mặc định cho màn hình di động, mở rộng dần với breakpoints `sm:`, `md:`, `lg:`, `xl:`.
- **Tuyệt Đối Không Hardcode Color Codes**:
  - Nghiêm cấm sử dụng mã màu trực tiếp: `#1e293b`, `rgba(0,0,0,0.5)`, `rgb(...)`.
  - Luôn sử dụng Semantic Design Tokens được định nghĩa trong hệ thống design system / Tailwind config (e.g. `bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-muted-foreground`).
- **Consistent Spacing Scale**: Sử dụng hệ thống spacing chuẩn của Tailwind (`p-4`, `gap-3`, `my-6`).

---

## 4. Xử Lý 4 Trạng Thái UI Bắt Buộc (The 4 UI States)
Mọi component hiển thị dữ liệu động (Data-driven UI) bắt buộc xử lý đủ 4 trạng thái:
1. **Loading State**: Sử dụng Skeleton Loading UI (`<Skeleton className="..." />`) mô phỏng đúng cấu trúc layout, tránh giật màn hình (CLS).
2. **Empty State**: Hiển thị component thông báo khi không có dữ liệu (kèm icon minh họa, thông điệp rõ ràng và nút bấm hành động Call-To-Action).
3. **Error State**: Bắt lỗi và render giao diện thông báo lỗi thân thiện kèm nút `Thử lại (Retry)`. Không hiển thị raw error message khó hiểu.
4. **Success State**: Render dữ liệu hoàn chỉnh, hiệu ứng transition mượt mà, tối ưu re-render.

---

## 5. Tiêu Chuẩn Tiếp Cận Toàn Diện (Accessibility - a11y)
- **Semantics & ARIA**:
  - Sử dụng thẻ HTML chuẩn (`<button>`, `<main>`, `<nav>`, `<article>`).
  - Mọi nút bấm icon không có text phải có `aria-label` hoặc `aria-labelledby`.
- **Visual & Keyboard States**:
  - Luôn cung cấp trạng thái trực quan rõ ràng: `hover:`, `active:`, `focus-visible:` (ring nổi bật cho keyboard navigation).
  - Trạng thái `disabled:` phải có `cursor-not-allowed`, giảm opacity và kèm thuộc tính `aria-disabled="true"`.
- **Form Accessibility**: Mọi field phải liên kết với label (`htmlFor` / `id`), trường lỗi phải kèm `aria-invalid="true"` và `aria-describedby`.

---

## 6. Bắt Buộc Chạy React Doctor Khi Kết Thúc Task
Mọi task có thay đổi mã nguồn frontend (`frontend/src/`) phải chạy React Doctor trước khi báo hoàn thành. Đây là gate chất lượng cuối cùng, tương đương `tsc --noEmit` + `npm run build`.

```bash
cd frontend && npx react-doctor@latest
```

- **Bắt buộc sau khi xong**, không phải tuỳ chọn: mọi task frontend tạo/sửa component, hook, modal, layout.
- Nếu React Doctor báo lỗi: **sửa code cho đạt, không suppress** trừ khi có lý do kỹ thuật chính đáng và phải ghi rõ trong chú thích Tiếng Việt tại chỗ đó (kèm lý do và ngày).
- Nếu `npx react-doctor@latest` không chạy được (mất mạng, registry lỗi): báo trung thực là **CHƯA verify được React Doctor**, không được im lặng bỏ qua rồi tuyên bố task xong.
- Ghi kết quả điểm (vd `100/100` hoặc danh sách còn tồn tại) vào bước xác minh của task.
