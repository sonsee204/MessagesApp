---
name: find-skills
description: Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. Tra cứu, tìm kiếm và hướng dẫn cài đặt skills phù hợp cho dự án.
---

# Find Skills (Tra Cứu & Khám Phá Skills)

Skill này giúp tìm kiếm, khám phá và cài đặt các kỹ năng từ hệ sinh thái open agent skills (skills.sh).

## Khi Nào Nên Sử Dụng

Sử dụng skill này khi người dùng:
- Hỏi "làm thế nào để làm X" khi X là một tác vụ phổ biến có thể đã có skill sẵn.
- Yêu cầu "tìm skill cho X" hoặc "có skill nào hỗ trợ X không".
- Hỏi "bạn có thể làm X không" với X là một năng lực chuyên môn hóa.
- Muốn mở rộng năng lực của agent trong dự án.
- Muốn tìm kiếm công cụ, template hoặc workflow chuẩn.
- Đề cập đến nhu cầu hỗ trợ trong một lĩnh vực cụ thể (thiết kế, kiểm thử, triển khai, v.v.).

## Skills CLI Là Gì?

Skills CLI (`npx skills`) là trình quản lý gói (package manager) cho hệ sinh thái agent skills mở. Skills là các gói mô-đun mở rộng năng lực của AI agent bằng kiến thức chuyên môn, quy trình công việc và công cụ thực thi.

**Các lệnh cốt lõi:**
- `npx skills find [từ_khóa] [--owner <owner>]` - Tìm kiếm skills tương tác hoặc theo từ khóa, có thể lọc theo GitHub owner.
- `npx skills add <package>` - Cài đặt skill từ GitHub hoặc các nguồn khác.
- `npx skills update` - Cập nhật tất cả skills đã cài đặt lên bản mới nhất.

**Duyệt kho skills trực tuyến tại:** https://skills.sh/

## Quy Trình Tìm Kiếm Skills Cho Người Dùng

### Bước 1: Xác Định Nhu Cầu
Khi người dùng cần hỗ trợ, xác định:
1. Lĩnh vực (Domain): React, testing, backend, design, deployment, v.v.
2. Tác vụ cụ thể: viết test, tạo animation, review PR, tối ưu DB, v.v.
3. Độ phổ biến: tác vụ này có đủ thông dụng để cộng đồng đã tạo skill hay chưa.

### Bước 2: Kiểm Tra Bảng Xếp Hạng Trước (Leaderboard)
Trước khi tìm kiếm qua CLI, kiểm tra [skills.sh leaderboard](https://skills.sh/) để xem các skill nổi bật nhất. Bảng xếp hạng sắp xếp theo lượt cài đặt, hiển thị các lựa chọn uy tín nhất.

Ví dụ các skills phổ biến cho lập trình web:
- `vercel-labs/agent-skills` — React, Next.js, web design (hơn 100K lượt cài đặt)
- `anthropics/skills` — Frontend design, document processing (hơn 100K lượt cài đặt)

### Bước 3: Tìm Kiếm Skills Qua CLI
Nếu bảng xếp hạng chưa có skill phù hợp, chạy lệnh tìm kiếm:

```bash
npx skills find [từ_khóa] [--owner <owner>]
```

Ví dụ:
- "Làm sao để tối ưu hiệu năng React?" → `npx skills find react performance`
- "Có skill nào hỗ trợ review PR không?" → `npx skills find pr review`
- "Cần tạo changelog tự động" → `npx skills find changelog`

### Bước 4: Thẩm Định Chất Lượng Trước Khi Gợi Ý
**Không khuyến nghị skill chỉ dựa trên kết quả tìm kiếm thô.** Luôn kiểm tra:
1. **Lượt cài đặt (Install count)**: Ưu tiên skills có từ 1K+ lượt cài đặt. Cẩn trọng với các skill dưới 100 lượt.
2. **Độ uy tín tác giả (Source reputation)**: Các nguồn chính thức (`vercel-labs`, `anthropics`, `microsoft`) an toàn hơn tác giả lạ.
3. **Số sao GitHub (GitHub stars)**: Kiểm tra repository gốc. Nên cẩn trọng với repo dưới 100 stars.

### Bước 5: Đề Xuất Lựa Chọn Cho Người Dùng
Khi tìm thấy skill phù hợp, trình bày:
1. Tên skill và công dụng chính.
2. Lượt cài đặt và nguồn gốc tác giả.
3. Lệnh cài đặt cụ thể.
4. Link tham khảo chi tiết trên skills.sh.

Ví dụ phản hồi mẫu:
```
Tìm thấy skill phù hợp: "react-best-practices" cung cấp các hướng dẫn
tối ưu hiệu năng React và Next.js từ đội ngũ Kỹ thuật của Vercel.
(185K lượt cài đặt)

Lệnh cài đặt:
npx skills add vercel-labs/agent-skills@react-best-practices

Xem chi tiết: https://skills.sh/vercel-labs/agent-skills/react-best-practices
```

### Bước 6: Hỗ Trợ Cài Đặt
Khi người dùng đồng ý, có thể cài đặt trực tiếp:

```bash
# Cài đặt cục bộ vào dự án cho agent claude-code:
npx skills add <owner/repo@skill> -a claude-code -y

# Hoặc cài đặt global (cấp máy người dùng):
npx skills add <owner/repo@skill> -g -y
```

## Các Danh Mục Skills Phổ Biến

| Danh Mục | Từ Khóa Mẫu |
| --- | --- |
| Lập Trình Web (Web Development) | react, nextjs, typescript, css, tailwind |
| Kiểm Thử (Testing) | testing, jest, playwright, e2e, vitest |
| DevOps & Hạ Tầng | deploy, docker, kubernetes, ci-cd |
| Tài Liệu Hóa (Documentation) | docs, readme, changelog, api-docs |
| Chất Lượng Code (Code Quality) | review, lint, refactor, best-practices |
| Thiết Kế Giao Diện (Design) | ui, ux, design-system, accessibility |
| Năng Suất Làm Việc (Productivity)| workflow, automation, git |

## Mẹo Tìm Kiếm Hiệu Quả
1. **Dùng từ khóa chính xác**: "react testing" hiệu quả hơn chỉ gõ "testing".
2. **Thử các từ đồng nghĩa**: Nếu "deploy" không có kết quả, thử "deployment" hoặc "ci-cd".
3. **Ưu tiên nguồn lớn**: `vercel-labs/agent-skills` hoặc `ComposioHQ/awesome-claude-skills`.

## Khi Không Tìm Thấy Skill
1. Xác nhận rõ ràng chưa có skill có sẵn phù hợp trên hệ thống.
2. Đề xuất hỗ trợ giải quyết trực tiếp bằng năng lực cốt lõi.
3. Gợi ý người dùng tự tạo skill riêng bằng lệnh: `npx skills init [ten-skill]`.
