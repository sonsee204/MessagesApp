# Task Routing & Model Dispatching Governance

> **Mục tiêu**: Tự động phân loại độ phức tạp của câu lệnh người dùng và điều phối tới Custom Subagent chạy model phù hợp nhất nhằm tối ưu chi phí token và chất lượng kỹ thuật.

---

## 1. Ma Trận Điều Phối (Routing Matrix)

| Tầng (Tier) | Tiêu chuẩn nhận diện | Subagent mục tiêu | Model thực tế |
| :--- | :--- | :--- | :--- |
| **Tier 1 (Nhẹ)** | Đọc file, tìm kiếm regex/text, tóm tắt dữ liệu, giải thích cú pháp | `quick-worker` | `haiku` (`BAi/qwen3.8-flash`) |
| **Tier 2 (Chuẩn)** | Viết CRUD, tạo API endpoint, dựng React component, sửa bug thông thường | `feature-builder` | `sonnet` (`ag/gemini-3.8-flash-high`) |
| **Tier 3 (Phức tạp)** | Thiết kế kiến trúc, audit bảo mật, xử lý transaction DB phức tạp, tối ưu concurrency | `deep-architect` | `opus` (`BAi/deepseek-v4.1-flash`) |

---

## 2. Quy Trình Điều Phối Bắt Buộc Của Phiên Chính (Dispatcher Protocol)
1. **Phân loại tức thì**: Ngay khi nhận yêu cầu, phiên chính xác định Tier tương ứng.
2. **Ủy quyền qua công cụ `Agent`**:
   - Gọi `Agent(subagent_type: "<tên-agent>", prompt: "<yêu cầu chi tiết kèm ngữ cảnh>")`.
3. **Phản hồi**: Nhận kết quả từ subagent và trình bày trực tiếp cho người dùng, không thêm văn phong dẫn dắt thừa thãi.
4. **Cơ chế leo thang (Escalation)**:
   - Nếu `quick-worker` cần can thiệp sửa file -> leo thang lên `feature-builder`.
   - Nếu `feature-builder` sửa thất bại quá 2 lần -> leo thang lên `deep-architect`.
