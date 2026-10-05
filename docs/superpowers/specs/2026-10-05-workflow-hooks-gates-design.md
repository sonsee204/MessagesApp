# Design Spec: Tối Ưu Workflow & Rules + Tự Động Hóa Quality Gates

> **Ngày lập**: 2026-10-05
> **Trạng thái**: Chờ phê duyệt
> **Phạm vi**: `.claude/rules/`, `.claude/workflows/`, `.claude/hooks/`, `.claude/settings.json`, `scripts/gates/`, `.github/workflows/`

---

## 1. Bối Cảnh & Mục Tiêu

### 1.1. Bối cảnh

Khảo sát thực tế (2026-10-05) cho thấy nhiều rule **đã lỗi thời so với codebase**:

| Rule trong `.claude/rules` ghi | Thực tế |
|---|---|
| `hard-bans.md` #3: "CHƯA có script `size-gate` trong package.json — sẽ lắp sau F2" | **Đã có** `frontend/scripts/size-gate.mjs` (185 dòng) + `npm run size-gate` / `size-gate:strict` / `size-gate:update` |
| `hard-bans.md` #1: "ESLint chưa có trong repo" | Đúng (chưa có ESLint) |
| `hard-bans.md` #4: gate `ocr` | Chỉ enforce bằng code review, không có tool tự động |
| `frontend.md` §6: gate React Doctor | Chỉ chạy thủ công |
| `backend.md` / `frontend.md`: test | **Đã có** vitest cả backend + frontend, 11 file test |
| CI | **Không tồn tại** `.github/workflows/` |
| `.claude/hooks` | **Không tồn tại** |

Ngoài ra còn rác: `ocr-extract.ps1` ở repo root (chân rút từ task OCR ảnh).

Hệ quả: rule tự mâu thuẫn, người đọc không biết phần nào "đã lắp", phần nào "kế hoạch". Các gate chất lượng hiện nằm hết trong văn bản nên **không có gì thực thi chúng**.

### 1.2. Mục tiêu

1. **Đồng bộ rule với thực tế**: mọi dòng "CHƯA có / sẽ lắp sau F2" phải được cập nhật theo trạng thái thực tế.
2. **Một nguồn sự thật cho gate**: logic kiểm tra nằm trong `scripts/gates/`, được gọi từ **cả** Claude Code hooks **và** GitHub Actions — không nhân đôi logic.
3. **Gate nhẹ ở phiên, gate mạnh ở CI**: hooks chỉ chạy kiểm tra rẻ, tức thời (`tsc`, `size-gate`, diff bans); CI chạy đầy đủ (+vitest, ESLint, ocr delegation, react-doctor).
4. **Áp dụng chính sách model mới**: phiên chính (Haiku) làm rà soát + design + viết doc; Opus (qua `deep-architect`/`Plan`) chỉ làm phần thinking/lên kế hoạch.
5. Dọn rác repo.

---

## 2. Kiến Trúc Tổng Quan

```
                        [Thay đổi mã nguồn]
                                │
        ┌───────────────────────┴────────────────────────┐
        ▼                                                 ▼
  [Claude Code hooks]                              [GitHub Actions]
  (phản hồi tức thì, gate nhẹ)                    (đầy đủ, gate mạnh)
        │                                                 │
        └────────────────────┬────────────────────────────┘
                               ▼
                    [scripts/gates/*.mjs]   ← NGUỒN SỰ THẬT DUY NHẤT
                               │
        ┌──────────┬───────────┼───────────┬──────────────┐
        ▼          ▼           ▼           ▼              ▼
   tsc-gate   diff-bans   size-gate   affected-tests   ocr-gate
                                                  (delegation mode)
```

**Lý do một nguồn sự thật**: bệnh hiện tại của repo là rule nói một đằng, code một nẻo. Nếu hooks và CI mỗi bên một bản logic, tình trạng lặp lại. Đặt logic vào `scripts/gates/`, cả hooks lẫn CI chỉ là wrapper gọi script.

---

## 3. Chi Tiết Thành Phần

### 3.1. `scripts/gates/` — gate scripts (mới)

Mỗi script là Node ESM độc lập, nhận tham số, **không** phụ thuộc Docker/Mongo, exit code chính là kết quả gate.

| Script | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `tsc-gate.mjs` | Chạy `tsc -b` backend + frontend, gom lỗi, exit 1 nếu có | `typescript` (đã có) |
| `diff-bans.mjs` | Quét `git diff` các file `.ts/.tsx` **thêm/sửa**, bắt `: any`, `@ts-ignore`, `@ts-nocheck`, `console.log` mới; thoát khi có `// allow-*:` cùng dòng | git |
| `size-gate.mjs` | Refactor từ `frontend/scripts/size-gate.mjs` lên root, thêm cờ `--src` + `--baseline`; chạy cho `backend/src` và `frontend/src` | none |
| `affected-tests.mjs` | `vitest run` backend + frontend, ưu tiên test liên quan file thay đổi | `vitest` (đã có) |
| `ocr-gate.mjs` | Wrapper `ocr delegate preview` — liệt kê file cần review + thoát; **không** gọi LLM | `ocr` CLI |

### 3.1.1. Cờ dòng lệnh chung

Tất cả script dùng chung bộ cờ thống nhất:

| Cờ | Ý nghĩa | Mặc định |
|---|---|---|
| `--src <dir>` | Thư mục cần quét (tương đối repo root) | — |
| `--baseline <file>` | File baseline ratchet (size-gate) | — |
| `--changed` | Chỉ kiểm tra file có trong `git diff` (không chạy full) | `false` |
| `--json` | Xuất kết quả dạng JSON cho CI parse | `false` |

### 3.1.2. Xác định "chạm mã nguồn"

Tất cả gate dùng chung hàm `getSourceChanges()`:

- Lấy `git diff --name-only --staged` + `git diff --name-only` + file untracked (`git ls-files --others --exclude-standard`).
- Lọc: đường dẫn bắt đầu bằng `backend/src/` **hoặc** `frontend/src/` **và** phần mở rộng `.ts`/`.tsx`.
- Trả về danh sách rỗng → mọi gate exit 0 ngay lập tức (đây là cơ chế ngoại lệ docs/governance).

Ngoài ra `diff-bans.mjs` + `affected-tests.mjs` tôn trọng `.gitignore` qua `--exclude-standard`.

**Quyết định thiết kế**:

- **`ocr-gate.mjs` chỉ chạy delegation mode.** Lý do: `ocr review` cần cấu hình LLM provider (tốn thêm quota + phải quản lý bí mật), trong khi `.claude/workflows/code-review-audit.md` §5.2 đã liệt kê delegation mode làm phương án chính thức khi chưa cấu hình LLM. Gate tự động chỉ cần trả lời "file nào cần review"; bản thân review do agent thực hiện.
- **`size-gate.mjs` giữ nguyên thuật toán** đếm dòng hiệu dụng và cơ chế ratchet baseline của bản hiện tại — chỉ thay đổi điểm vào (root) và tham số hóa đường dẫn.
- **`diff-bans.mjs` chỉ quét diff, không quét toàn repo.** Rule `hard-bans.md` ghi rõ: áp dụng cho code mới và code bị sửa, không đòi hỏi xử lý nợ cũ.
- **`diff-bans.mjs` cho phép bỏ qua từng vị trí.** Một phát hiện có thể thoát bằng comment Tiếng Việt cùng dòng dạng `// allow-any: <lý do>` (hoặc `// allow-ts-ignore:`). Lý do: rule hard-bans #2 đã có ngoại lệ "có lý do + chú thích Tiếng Việt"; gate phải biết đọc lại cùng cơ chế đó thay vì chặn cứng mọi trường hợp. Các pattern bỏ qua: `allow-any`, `allow-ts-ignore`, `allow-ts-nocheck`, `allow-console`.
- **`diff-bans.mjs` chỉ quét diff, không quét toàn repo.** Rule `hard-bans.md` ghi rõ: áp dụng cho code mới và code bị sửa, không đòi hỏi xử lý nợ cũ.

**Thay đổi liên quan**:

- `frontend/package.json`: `size-gate` → `node ../scripts/gates/size-gate.mjs --src src --baseline size-gate-baseline.json`; xoá `frontend/scripts/size-gate.mjs`.
- Sinh `backend/size-gate-baseline.json` lần đầu qua `npm run size-gate -- --update`.

### 3.2. `.claude/hooks/` — wrapper Claude Code (mới)

Hooks là PowerShell wrapper **cực mỏng**: chỉ phát hiện file thay đổi và gọi script §3.1. Hook không chứa logic kiểm tra.

| Event | Hook | Hành động |
|---|---|---|
| `Stop` | `stop-gates.ps1` | Chỉ khi diff chạm mã nguồn: chạy `tsc-gate.mjs` + `diff-bans.mjs` + `size-gate.mjs`. Không chặn nếu chỉ chạm docs. |
| `PreToolUse` | `block-worktree.ps1` | Chặn `EnterWorktree` — thực thi rule Git Workflow §7 |
| `UserPromptSubmit` | `routing-reminder.ps1` | In nhắc routing theo tier (không chặn) |

**Hook `Stop` không chạy `affected-tests.mjs` / `ocr-gate.mjs` / react-doctor** — theo quyết định gate nhẹ + CI mạnh.

**Cài vào `.claude/settings.json`** (không phải `settings.local.json` — hooks là cấu hình chia sẻ của repo, phải commit):

```jsonc
{
  "hooks": {
    "Stop": [{ "matcher": "", "hooks": [{ "type": "command", "command": "pwsh -File .claude/hooks/stop-gates.ps1" }] }],
    "PreToolUse": [{ "matcher": "EnterWorktree", "hooks": [{ "type": "command", "command": "pwsh -File .claude/hooks/block-worktree.ps1" }] }],
    "UserPromptSubmit": [{ "matcher": "", "hooks": [{ "type": "command", "command": "pwsh -File .claude/hooks/routing-reminder.ps1" }] }]
  }
}
```

**Rủi ro đã xem xét**: môi trường này có PowerShell 5.1, **không có `pwsh`** (đã kiểm tra: `PWSH_NOT_FOUND`). Cần quyết định ở §6.

### 3.3. `.github/workflows/gates.yml` — CI (mới)

Workflow chạy đầy đủ gate theo thứ tự (fail-fast):

```
tsc-gate ──> diff-bans ──> size-gate:strict ──> affected-tests ──> ocr-gate ──> react-doctor
```

Chạy trên `push` vào `main` và `pull_request`. Mỗi gate là 1 job riêng để log dễ đọc. Backend và frontend chạy song song ở bước type-check.

**React Doctor chỉ chạy khi diff chạm `frontend/src/`** (tương tự ngoại lệ rule `frontend.md` §6).

### 3.4. Cập nhật `.claude/rules/`

Phạm vi **sửa tối thiểu** (không tái cấu trúc): giữ nguyên 5 file rules + 5 workflows, chỉ sửa phần sai + thêm file mới.

**`hard-bans.md`** — bảng trạng thái thực thi:

| # | Điều cấm | Cơ chế thực thi | Trạng thái |
|---|---|---|---|
| 1 | Type `any` (code mới) | `diff-bans.mjs` + CI `diff-bans` job | **Đã lắp** |
| 2 | `@ts-nocheck` / `@ts-ignore` mới | `diff-bans.mjs` | **Đã lắp** |
| 3 | God file > 400 dòng hiệu dụng | `scripts/gates/size-gate.mjs` + `npm run size-gate:strict` | **Đã lắp** |
| 4 | Báo DONE khi chưa chạy `ocr` | `ocr-gate.mjs` + CI `ocr-gate` job | **Đã lắp (delegation mode)** |

**`task-routing.md`** — thêm §8 "Chính Sách Model & Trách Nhiệm Phiên":

> **Phiên chính (Haiku)** chịu trách nhiệm **rà soát, đọc file, design và viết tài liệu** (spec, doc, markdown).
> **Opus** (qua `deep-architect` hoặc agent `Plan`) chỉ chịu trách nhiệm **thinking — suy luận sâu, phân tích kiến trúc**, và **luôn giao kết quả về lại phiên chính** dưới dạng text ghi ra file `.md`.
> Opus không bao giờ commit, không bao giờ tự viết file triển khai.

**`token-economy.md`** — bổ sung: hooks/CI thay thế việc agent phải tự chạy kiểm tra thủ công, tiết kiệm token.

**`CLAUDE.md`** — cập nhật phần Open-Codereview Gate: ghi rõ giờ có `ocr-gate.mjs` và exemption list chính xác (docs/governance/Git-only).

**MỚI `.claude/rules/gates.md`** — bảng tra cứu 1 trang: gate nào chạy ở đâu, khi nào, exit code nghĩa gì, cách skip hợp lệ.

### 3.5. Dọn rác

- Xoá `ocr-extract.ps1` ở repo root.
- Xoá mục con lỗi thời trong `.claude/settings.local.json` (đường dẫn tuyệt đối session cũ).
- Revert hoặc commit `.claude/settings.json` (`M .claude/settings.json` chứa 18 dòng permission tạm của session trước).

---

## 4. Luồng Dữ Liệu Ví Dụ

**Sửa bug backend `call.service.ts`, báo xong task:**

1. Agent gọi `Edit` sửa file.
2. `Stop` hook chạy → phát hiện diff chạm `backend/src/` → chạy `tsc-gate.mjs` + `diff-bans.mjs` + `size-gate.mjs`.
3. Nếu `tsc` fail → hook block, agent phải sửa tiếp.
4. Agent báo DONE kèm `VERIFICATION (Open-Codereview)`.
5. Push → CI chạy thêm `affected-tests.mjs` + `ocr-gate.mjs` (delegation) → job fail nếu regression.

---

## 5. Testing

- Mỗi gate script tự test bằng cách: tạo diff vi phạm mẫu (file chứa `: any`), chạy script, assert exit code ≠ 0; tạo diff sạch, assert exit 0.
- `block-worktree.ps1` test bằng cách gọi `EnterWorktree` và xác nhận bị chặn.
- CI verify: push một commit chỉ sửa docs → toàn bộ gate skip (không fail).

---

## 6. Quyết Định (Đã Phê Duyệt 2026-10-05)

1. **Hooks viết bằng PowerShell 5.1** (`powershell.exe`, sẵn có) — không yêu cầu cài `pwsh`. Lệnh trong `settings.json`: `powershell -ExecutionPolicy Bypass -File .claude/hooks/stop-gates.ps1`.

2. **Revert `.claude/settings.json`** — 18 dòng permission tạm thuộc session dọn dẹp `D:\.git` cũ, không còn giá trị.

3. **Tạo CI workflow ngay** với 2 trigger `pull_request` + `workflow_dispatch` — chạy tay qua `gh workflow run` khi chưa có remote; khi thêm remote, `pull_request` tự kích hoạt mà không cần sửa file.
