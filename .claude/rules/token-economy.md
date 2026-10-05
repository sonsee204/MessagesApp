# Token Economy & Quota Protection Rules

> **Mục tiêu**: Bảo toàn tối đa Token Quota và Context Window cho AI Agent, giảm thiểu độ trễ, triệt tiêu vòng lặp sửa lỗi mù quáng.

---

## 1. Nguyên Tắc Diff-First (Chống In Lại Toàn Bộ File)
- **Cấm Full Rewrite Trong Conversation**: Tuyệt đối không in lại toàn bộ nội dung file nếu file vượt quá 30 dòng.
- **Diff & Partial Snippets**:
  - Chỉ xuất đoạn diff cụ thể hoặc hàm/phương thức cần thay đổi.
  - Sử dụng chú thích rõ ràng `// ... existing code ...` (hoặc `# ... existing code ...` với Python) để đại diện cho phần mã nguồn không thay đổi xung quanh.
- **Surgical Tool Operations**:
  - Ưu tiên công cụ chỉnh sửa chuỗi chính xác (`Edit`) thay vì ghi đè file (`Write`).
  - Không đọc lại file ngay sau khi công cụ đã xác nhận sửa đổi thành công.

---

## 2. Chiến Lược Zero-Loop (Chống Thử Sửa Mò Gây Đốt Token)
- **Tập Trung Đọc Log & Traces**: Khi xuất hiện lỗi hoặc test thất bại, chỉ đọc đúng phân đoạn stack trace liên quan. Tuyệt đối không chạy đi chạy lại lệnh lỗi mà không thay đổi mã nguồn.
- **Chẩn Đoán 1 Câu (1-Sentence Root Cause)**:
  - Bắt buộc xác định và tóm tắt nguyên nhân gốc rễ (root cause) trong đúng 1 câu trước khi chạm vào bất kỳ dòng mã nào.
  - Phân tích logic trước, viết code sau: Không được "thử sửa hú họa" để xem test có pass hay không.
- **Dừng Khi Quá 2 Lần Thất Bại**: Nếu một bản vá thất bại 2 lần liên tiếp tại cùng một lỗi, dừng lại để đánh giá lại giả định kiến trúc thay vì tiếp tục lặp lại các chỉnh sửa nhỏ.

---

## 3. Compact Technical Notes (Ghi Chú Kỹ Thuật Tối Giản)
- **Giới Hạn 2 Câu**: Chỉ giải thích các quyết định kiến trúc hoặc trade-off phức tạp trong tối đa 2 câu ngắn gọn.
- **Loại Bỏ Hội Thoại Rác**:
  - Không viết đoạn giải thích hiển nhiên cho những dòng code đơn giản.
  - Không dùng các câu đệm: "Chắc chắn rồi", "Tôi sẽ làm việc này ngay bây giờ", "Rất vui được hỗ trợ bạn".
- **Code Là Câu Trả Lời**: Kết quả thực thi, mã nguồn chuẩn xác và kết quả test là thước đo duy nhất.
- **Không Cắt Giảm Comment Trong Mã Nguồn**: Token Economy nhằm loại bỏ văn phong rườm rà trong phản hồi chat và tránh in lặp lại toàn bộ file, TUYỆT ĐỐI KHÔNG đồng nghĩa với việc xóa bỏ comment trong file mã nguồn. Chú thích code bằng Tiếng Việt là yêu cầu bắt buộc và không được lược bớt.

---

## 4. Tối Ưu Hóa Bằng Hooks & Shared Gates Tự Động
- **Giải phóng thao tác thủ công**: Hệ thống hook tự động (`.claude/hooks/stop-gates.ps1`) và các shared gate scripts (`scripts/gates/`) đã tự động hóa việc kiểm định chất lượng mã nguồn (`diff-bans`, `size-gate`, `tsc-gate`).
- **Tiết kiệm token & context**: AI Agent không cần chủ động gõ và chạy lặp đi lặp lại các câu lệnh kiểm tra type-check hay linting rải rác thủ công trong chuỗi đối thoại. Mọi kiểm tra cần thiết sẽ tự động kích hoạt khi kết thúc task qua Stop hook, giảm thiểu đáng kể số lượt gọi lệnh và token tiêu thụ trong ngữ cảnh.
