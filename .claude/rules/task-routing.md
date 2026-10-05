# Task Routing & Model Dispatching Governance

> **Mục tiêu**: Tự động phân loại độ phức tạp của yêu cầu, đóng gói ngữ cảnh chuẩn hóa (Context Package), điều phối tới Custom Subagent chạy model tối ưu nhất, và áp dụng Output Contract nhằm loại bỏ hoàn toàn việc dò quét repo mù và lãng phí token quota.

---

## 0. Hợp Đồng Dispatch Cho Phiên Chính (Bắt Buộc — Kiểm Trước Khi Làm)
Phiên chính là **orchestrator**: mọi công việc Tier 1–3 phải ủy quyền qua tool `Agent` với tham số `subagent_type` đúng tên agent, KHÔNG tự làm inline (chống anti-pattern "Làm Thay Subagent" §6.2). Đây là bước kiểm tra bắt buộc TRƯỚC khi thực hiện bất kỳ thao tác đọc/ghi mã nguồn nào:

| Dispatch (`subagent_type`) | Giao khi nào |
| :--- | :--- |
| `quick-worker` | Đọc file, grep/tra cứu, trace log, tóm tắt (Tier 1) |
| `feature-builder` | Viết component/API/CRUD, sửa bug thông thường, chạy build/test (Tier 2) |
| `deep-architect` | Thiết kế kiến trúc, audit bảo mật, transaction đa collection, race-condition, refactor diện rộng, soạn plan (Tier 3) |

- **Model**: tuân theo frontmatter của agent (`fable`/`sonnet`/`opus`); KHÔNG truyền tham số `model` của tool Agent đè lên trừ khi người dùng yêu cầu rõ.
- **Lưu ý hành vi Fable**: model này thinking luôn bật và không chấp nhận `tool_choice: any`/`tool`. Khi dispatch agent chạy Fable (`quick-worker`), dùng `tool_choice: auto` + câu lệnh nêu rõ tool, KHÔNG ép buộc.
- **Mỗi dispatch** kèm Context Package 4 phần tại Mục 2 và nhận Output Contract Mục 3.
- **Ngoại lệ được phép làm inline** (không phải dispatch):
  1. Tác vụ governance: sửa `.claude/rules/`, `.claude/agents/`, `.claude/workflows/`, `CLAUDE.md`, docs/plans;
  2. Tìm kiếm cơ giới một lệnh là ra kết quả (1 Grep/Glob duy nhất, không suy luận);
  3. Sửa cực nhỏ ≤ 1 file và ≤ 5 dòng, hoặc vá tiếp nối ngay sau báo cáo của subagent trong cùng task;
  4. Thao tác Git (commit, branch, merge) và chạy lệnh xác minh cuối task.
- Ngoài 4 ngoại lệ trên mà làm inline là **vi phạm routing** — tự dừng và dispatch.

---

## 1. Ma Trận Điều Phối (Routing Matrix)

| Tầng (Tier) | Tiêu chuẩn nhận diện | Subagent mục tiêu | Model thực tế | SOP Workflow gắn kèm |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1 (Nhẹ)** | Đọc file, tra cứu regex/text, tóm tắt dữ liệu, giải thích cú pháp, trace log | `quick-worker` | `fable` (`Cb2` qua `ANTHROPIC_DEFAULT_FABLE_MODEL`) | Tra cứu đơn lẻ |
| **Tier 2 (Chuẩn)** | Viết CRUD, tạo API endpoint, dựng React component, sửa bug thông thường | `feature-builder` | `sonnet` (`ag/gemini-3.8-flash-high`) | `create-api-endpoint.md`, `create-component.md`, `fix-bug.md` |
| **Tier 3 (Phức tạp)** | Thiết kế kiến trúc, audit bảo mật, transaction DB đa collection, xử lý race-condition, refactor diện rộng, soạn kế hoạch triển khai | `deep-architect` | `opus` (`BAi/deepseek-v4.1-flash`) | `code-review-audit.md`, `write-implementation-plan.md` |

> **Soạn Plan với model Fable**: tác vụ lên kế hoạch triển khai (≥ 3 tầng) có thể chạy trên model **Fable**. Bắt buộc nạp cấu hình kỹ thuật + khung prompt tại `.claude/agents/fable-plan-guide.md` trước khi bắt đầu — Fable khác họ Opus/Sonnet ở hành vi reasoning (thinking luôn bật, không ép buộc tool, prompt dạng spec-dày).

---

## 2. Giao Thức Đóng Gói Ngữ Cảnh Bắt Buộc (Context Packaging Protocol)
Khi dispatch subagent, phiên chính **bắt buộc** đóng gói prompt theo cấu trúc 4 phần chuẩn mực, tuyệt đối không gửi prompt cụt ngủn hoặc mơ hồ:

```markdown
[MỤC TIÊU]: 1-2 câu nêu rõ kết quả kỹ thuật cần hoàn thành.
[PHẠM VI]: Danh sách tệp, thư mục, hoặc module cụ thể được phép truy cập (Boundary). Tuyệt đối cấm quét ngoài phạm vi này.
[RÀNG BUỘC]: 
  - Tuân thủ các rules: backend.md / frontend.md / token-economy.md.
  - Bắt buộc comment code bằng Tiếng Việt.
  - Giới hạn diff tối giản, không in lại cả file.
[ĐẦU RA]: Tuân thủ đúng Output Contract chuẩn tại Mục 3.
```

---

## 3. Hợp Đồng Đầu Ra Chuẩn Hóa Của Subagent (Output Contract)
Mọi subagent sau khi hoàn thành nhiệm vụ bắt buộc trả về báo cáo theo cấu trúc kỹ thuật ngắn gọn sau:

```markdown
TRẠNG THÁI: [DONE | PARTIAL | BLOCKED | NEEDS_ESCALATION]
KẾT QUẢ KỸ THUẬT:
- Tóm tắt 2-4 dòng các điểm kỹ thuật cốt lõi đã xử lý.
CÁC TỆP ĐÃ TÁC ĐỘNG:
- `path/to/file.ts`: mô tả ngắn gọn thay đổi (kèm diff ngắn nếu có, không in cả file).
XÁC MINH (VERIFICATION):
- Lệnh kiểm tra hoặc căn cứ chứng minh tính đúng đắn (test pass, type check clean, v.v.).
RỦI RO / CÒN TỒN TẠI:
- Bất kỳ điểm lưu ý hoặc ghi "None".
```

---

## 4. Quy Tắc Song Song Hóa (Parallel Dispatching)
- **Tác vụ độc lập**: Khi cần tra cứu, phân tích hoặc xử lý các module không phụ thuộc dữ liệu của nhau, phiên chính **bắt buộc gọi nhiều subagent đồng thời** trong cùng một lượt phát lệnh (`parallel tool calls`), thay vì gọi tuần tự.
  - *Ví dụ*: Đọc tài liệu FE + đọc code BE -> Dispatch 2 `quick-worker` song song.
- **Tác vụ tuần tự có điều kiện**: Chỉ chạy tuần tự khi kết quả của subagent trước là đầu vào bắt buộc của subagent sau.

---

## 5. Chính Sách Leo Thang & Cắt Vòng Lặp Lỗi (Escalation & Circuit Breaker)
- **Tier 1 -> Tier 2 (Quyền hạn)**: Nếu `quick-worker` phát hiện bài toán cần sửa đổi code hoặc can thiệp file -> lập tức dừng lại, trả về `TRẠNG THÁI: NEEDS_ESCALATION` kèm danh sách tệp cần xử lý để phiên chính giao cho `feature-builder`.
- **Tier 2 -> Tier 3 (Độ phức tạp / Bế tắc)**:
  - Nếu `feature-builder` thực hiện sửa đổi nhưng test/build thất bại **quá 2 lần liên tiếp tại cùng một lỗi** -> kích hoạt Circuit Breaker: Dừng thao tác, tóm tắt root cause trong 1 câu và chuyển giao toàn bộ context sang `deep-architect`.
  - Nếu tác vụ liên quan đến Transaction MongoDB đa bảng, Socket.IO concurrency hoặc audit bảo mật -> chuyển thẳng `deep-architect`.
- **Tier 3 -> User**: Nếu `deep-architect` phát hiện xung đột kiến trúc nền tảng -> trình bày trực tiếp 2 phương án ngắn gọn cho người dùng quyết định, không tự ý đưa ra phỏng đoán.

---

## 6. Các Anti-Pattern Bị Nghiêm Cấm Tuyệt Đối
1. **Dispatch Mù (Blind Dispatch)**: Không cung cấp danh sách file trong `[PHẠM VI]`, dẫn đến subagent tự ý grep toàn bộ kho lưu trữ gây cạn kiệt context.
2. **Làm Thay Subagent**: Phiên chính tự ý đọc và sửa các file thuộc trách nhiệm của subagent mà không ủy quyền.
3. **Thử Sửa Hú Họa (Guess-and-Check Loop)**: Subagent liên tục sửa và chạy lại lệnh lỗi quá 2 lần mà không phân tích nguyên nhân gốc rễ.
4. **Chat Thừa Thãi**: Đưa lời chào hỏi, cảm ơn, nhận xét ngoài lề vào kết quả trả về của subagent.

---

## 7. Quy Tắc Git Workflow (Không Dùng Worktree)
- **Cấm tạo worktree**: Tuyệt đối không gọi `EnterWorktree`. Mọi tác vụ phải thực hiện trên cùng một checkout (working directory chính).
- **Cách tách biệt công việc**: Tạo branch mới từ `main` (`git checkout -b <tên-branch>`) để làm việc độc lập; không dùng worktree để cô lập.
- **Hoàn tất**: Merge branch vào `main` (ưu tiên fast-forward hoặc squash với message chuẩn), sau đó xoá branch (`git branch -d <tên-branch>`).
- **Lý do**: Worktree để lại thư mục vật lý bị khoá bởi OS/session cũ, gây rác và không thể xoá sạch qua git, gây lộn xộn cây thư mục. Branch tối giản hơn và dễ dọn dẹp.

---

## 8. Chính Sách Phân Công Model & Trách Nhiệm Phiên (Phiên Bản Tối Ưu)
- **Phân công theo thế mạnh model**:
  - **Phiên chính (Haiku / Sonnet)**: Đóng vai trò orchestrator, chịu trách nhiệm rà soát bối cảnh, đọc file, thiết kế kiến trúc (design), viết tài liệu (spec, plan, governance, documentation dạng markdown), và điều phối subagents.
  - **Opus (thông qua subagent `deep-architect` hoặc agent `Plan`)**: Chuyên trách **thinking** — suy luận chuyên sâu, phân tích cấu trúc kiến trúc phức tạp, giải quyết race-condition hoặc audit bảo mật. Opus **chỉ chuyển giao kết quả phân tích dạng text trở lại phiên chính** để phiên chính tổng hợp và xuất file markdown, **tuyệt đối KHÔNG tự ý tạo commit hoặc viết file triển khai trực tiếp**.
- **Hệ thống Hooks hỗ trợ tự động (Enforced qua `.claude/settings.json`)**:
  - `block-worktree.ps1` (PreToolUse `EnterWorktree`): Chặn đứng mọi hành vi tạo worktree, bảo đảm làm việc trên branch duy nhất của working checkout.
  - `stop-gates.ps1` (Stop hook): Tự động kích hoạt các gate kiểm tra nhẹ (`diff-bans`, `size-gate`, `tsc-gate`) mỗi khi có thay đổi mã nguồn trước khi kết thúc task.
  - `routing-reminder.ps1` (UserPromptSubmit hook): Tự động hiển thị lời nhắc nhở đối chiếu Tier nhiệm vụ ngay khi người dùng gửi prompt.
