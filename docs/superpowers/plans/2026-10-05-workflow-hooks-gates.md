# Tối Ưu Workflow & Rules + Tự Động Hóa Quality Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đồng bộ hóa toàn diện hệ thống quy tắc governance (.claude/rules, .claude/workflows, CLAUDE.md) với thực tế codebase, xây dựng bộ scripts kiểm soát chất lượng dùng chung tại `scripts/gates/`, thiết lập Claude Code hooks (PowerShell 5.1) chặn lỗi tức thì tại phiên làm việc và thiết lập GitHub Actions CI workflow bảo vệ nhánh chính.

**Architecture:** Áp dụng nguyên lý Single Source of Truth: toàn bộ logic kiểm tra (type-check, hard-bans diff, size-gate ratchet, tests, OCR delegation) được đóng gói thành các script Node.js ESM độc lập trong `scripts/gates/`. Claude Code hooks (`.claude/hooks/*.ps1`) đóng vai trò wrapper mỏng cho local session, và GitHub Actions (`.github/workflows/gates.yml`) gọi trực tiếp các script này trên CI.

**Tech Stack:** Node.js (ESM), TypeScript, Vitest, PowerShell 5.1, GitHub Actions, Open-Code-Review CLI.

**Spec:** [docs/superpowers/specs/2026-10-05-workflow-hooks-gates-design.md](docs/superpowers/specs/2026-10-05-workflow-hooks-gates-design.md)

## Global Constraints

- Không thêm bất kỳ dependency npm mới nào vào `package.json` của root, backend hoặc frontend trừ khi được người dùng yêu cầu rõ ràng.
- Toàn bộ hook local phải tương thích PowerShell 5.1 (`powershell.exe`), không phụ thuộc `pwsh` (PowerShell Core).
- Các script tại `scripts/gates/` phải chạy được độc lập từ repo root bằng lệnh `node scripts/gates/<name>.mjs`.
- Không được làm gián đoạn các test vitest hiện có của backend và frontend.
- Chú thích mã nguồn mới bằng Tiếng Việt đầy đủ theo quy định của dự án.
- Tuân thủ quy tắc không dùng git worktree (`EnterWorktree`).

## Review Focus

- File nằm ngoài vùng mã nguồn (chỉ sửa docs, config, markdown) không được kích hoạt các gate type-check hay test gây chậm phiên làm việc.
- Kiểm tra cơ chế whitelist `// allow-any: <lý do>` và `// allow-ts-ignore: <lý do>` hoạt động chính xác khi có lý do kỹ thuật chính đáng.
- Cơ chế ratchet của `size-gate.mjs` không được ghi đè hỏng baseline hiện có của frontend (`frontend/size-gate-baseline.json`).
- Script `diff-bans.mjs` không báo lỗi nhầm trên các dòng bị xóa trong diff (`-`) hoặc diff của file không phải `.ts/.tsx`.
- Lệnh PowerShell 5.1 trong hook không bị lỗi parse do cú pháp pipeline hoặc ký tự đặc biệt của Windows Console.

---

### Task 1: Dọn Rác Repo & Khôi Phục Cấu Hình Sạch

**Files:**
- Delete: `ocr-extract.ps1`
- Modify: `.claude/settings.json`

**Interfaces:**
- Consumes: None
- Produces: Trạng thái git sạch sẽ cho các cấu hình nền tảng.

- [ ] **Step 1: Xóa file rác `ocr-extract.ps1`**

Xóa file rác còn tồn đọng ở root repo:
```bash
rm ocr-extract.ps1
```

- [ ] **Step 2: Khôi phục sạch file `.claude/settings.json`**

Chỉ giữ lại các cấu hình permissions chuẩn và worktree setting, loại bỏ 18 dòng permission tạm từ session cũ:
```json
{
  "permissions": {
    "allow": [
      "Bash(echo \"---SUBTREE EXIT: $?\")",
      "Bash(git stash *)",
      "Bash(echo \"STASH EXIT: $?\")",
      "Bash(tasklist)"
    ]
  },
  "worktree": {
    "baseRef": "head"
  }
}
```

- [ ] **Step 3: Kiểm tra git status**

Chạy: `git status --short`
Mong đợi: `ocr-extract.ps1` đã bị xóa, `.claude/settings.json` sạch sẽ.

- [ ] **Step 4: Commit dọn dẹp**

```bash
git add .claude/settings.json
git rm ocr-extract.ps1
git commit -m "chore: dọn file rác ocr-extract và khôi phục settings.json sạch" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Di Chuyển & Chuẩn Hóa `size-gate.mjs` Thành Shared Gate Script

**Files:**
- Create: `scripts/gates/size-gate.mjs`
- Delete: `frontend/scripts/size-gate.mjs`
- Modify: `frontend/package.json:11-13`
- Create: `backend/size-gate-baseline.json`

**Interfaces:**
- Consumes: Tham số CLI `--src <dir>`, `--baseline <file>`, `--strict`, `--update`
- Produces: Exit code 0 (hợp lệ) hoặc 1 (vi phạm strict). Shared gate cho cả frontend và backend.

- [ ] **Step 1: Tạo thư mục `scripts/gates` và viết `scripts/gates/size-gate.mjs`**

Tạo `scripts/gates/size-gate.mjs` với khả năng nhận tham số linh hoạt `--src` và `--baseline`:
```javascript
#!/usr/bin/env node
/**
 * size-gate: Kiểm tra giới hạn dòng hiệu dụng của file mã nguồn (chống god file > 400 dòng).
 * Hỗ trợ tham số:
 *   --src <path>        Thư mục mã nguồn cần quét (bắt buộc)
 *   --baseline <path>   Đường dẫn file baseline snapshot (tùy chọn)
 *   --strict            Thoát với mã 1 nếu có vi phạm
 *   --update            Ghi đè snapshot hiện tại vào file baseline
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative, extname } from "node:path";

const MAX_EFFECTIVE_LINES = 400;
const EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

const args = process.argv.slice(2);
const isStrict = args.includes("--strict");
const isUpdate = args.includes("--update");

function getArgValue(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

const srcArg = getArgValue("--src");
const baselineArg = getArgValue("--baseline");

if (!srcArg) {
  console.error("❌ Thiếu tham số --src <đường_dẫn_thư_mục>");
  process.exit(1);
}

const ROOT = resolve(process.cwd(), srcArg);
const BASELINE_PATH = baselineArg ? resolve(process.cwd(), baselineArg) : null;

if (!existsSync(ROOT)) {
  console.error(`❌ Thư mục không tồn tại: ${ROOT}`);
  process.exit(1);
}

export function countEffectiveLines(content) {
  const lines = content.split("\n");
  let count = 0;
  let inBlockComment = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (inBlockComment) {
      if (line.includes("*/")) {
        inBlockComment = false;
        const afterClose = line.slice(line.indexOf("*/") + 2).trim();
        if (afterClose.length > 0) count++;
      }
      continue;
    }

    if (line.trim().length === 0) continue;

    if (line.trimStart().startsWith("/*")) {
      if (line.includes("*/")) {
        const afterClose = line.slice(line.indexOf("*/") + 2).trim();
        if (afterClose.length > 0) count++;
        continue;
      }
      inBlockComment = true;
      continue;
    }

    const stripped = line.trimStart();
    if (stripped.startsWith("//")) continue;

    if (stripped === "*/" || stripped.startsWith("*/")) {
      const afterClose = stripped.slice(2).trim();
      if (afterClose.length === 0) continue;
    }

    count++;
  }

  return count;
}

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else if (EXTENSIONS.has(extname(entry))) {
      results.push(full);
    }
  }
  return results;
}

let baseline = {};
if (BASELINE_PATH && existsSync(BASELINE_PATH)) {
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
  } catch {
    console.warn(`⚠ Không đọc được baseline ${BASELINE_PATH}, dùng baseline rỗng.`);
  }
}

const files = walk(ROOT);
const current = {};
const violations = [];

for (const file of files) {
  const rel = relative(process.cwd(), file).replace(/\\/g, "/");
  const content = readFileSync(file, "utf-8");
  const effective = countEffectiveLines(content);
  current[rel] = effective;

  const limit = baseline[rel] ?? MAX_EFFECTIVE_LINES;
  if (effective > limit) {
    violations.push({ file: rel, effective, limit });
  }
}

if (isUpdate && BASELINE_PATH) {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + "\n", "utf-8");
  console.log(`✅ Baseline đã cập nhật: ${Object.keys(current).length} file → ${BASELINE_PATH}`);
  process.exit(0);
}

if (violations.length === 0) {
  console.log(`✅ size-gate: tất cả ${files.length} file trong ${srcArg} đạt yêu cầu (≤ ${MAX_EFFECTIVE_LINES} dòng hiệu dụng).`);
  process.exit(0);
}

console.error(`\n❌ size-gate: ${violations.length} file trong ${srcArg} vượt giới hạn dòng hiệu dụng:\n`);
for (const v of violations.sort((a, b) => b.effective - a.effective)) {
  console.error(`  ${v.file}: ${v.effective} dòng (giới hạn: ${v.limit})`);
}

if (isStrict) {
  process.exit(1);
} else {
  console.warn("⚠ Chạy ở chế độ non-strict (không exit 1). Dùng --strict để kích hoạt gate.");
  process.exit(0);
}
```

- [ ] **Step 2: Cập nhật `frontend/package.json` và tạo baseline cho backend**

Cập nhật scripts trong `frontend/package.json`:
```json
    "size-gate": "node ../scripts/gates/size-gate.mjs --src src --baseline size-gate-baseline.json",
    "size-gate:strict": "node ../scripts/gates/size-gate.mjs --src src --baseline size-gate-baseline.json --strict",
    "size-gate:update": "node ../scripts/gates/size-gate.mjs --src src --baseline size-gate-baseline.json --update"
```
Xóa file cũ `frontend/scripts/size-gate.mjs`.

Chạy khởi tạo baseline cho backend:
```bash
node scripts/gates/size-gate.mjs --src backend/src --baseline backend/size-gate-baseline.json --update
```

- [ ] **Step 3: Chạy test xác minh**

Chạy:
```bash
npm --prefix frontend run size-gate:strict
node scripts/gates/size-gate.mjs --src backend/src --baseline backend/size-gate-baseline.json --strict
```
Mong đợi: Cả 2 lệnh đều exit 0 và báo thành công.

- [ ] **Step 4: Commit thay đổi**

```bash
git add scripts/gates/size-gate.mjs frontend/package.json backend/size-gate-baseline.json
git rm frontend/scripts/size-gate.mjs
git commit -m "feat(gates): di chuyển và tổng quát hóa size-gate cho toàn repo" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Xây Dựng `diff-bans.mjs` Kiểm Soát Hard Bans Trên Git Diff

**Files:**
- Create: `scripts/gates/diff-bans.mjs`
- Create: `scripts/gates/diff-bans.test.mjs`

**Interfaces:**
- Consumes: `git diff` kết hợp danh sách staged, unstaged, untracked files
- Produces: Quét và chặn các pattern bị cấm: `: any`, `@ts-ignore`, `@ts-nocheck`, `console.log` (trừ khi có chú thích bypass hợp lệ `// allow-*:`).

- [ ] **Step 1: Viết test failing cho logic phát hiện vi phạm diff**

Tạo `scripts/gates/diff-bans.test.mjs`:
```javascript
import { describe, it, expect } from "vitest";
import { inspectDiffLines } from "./diff-bans.mjs";

describe("inspectDiffLines", () => {
  it("phát hiện kiểu any mới thêm", () => {
    const diff = `+const data: any = JSON.parse(str);`;
    const issues = inspectDiffLines("src/app.ts", diff);
    expect(issues.length).toBe(1);
    expect(issues[0].rule).toBe("NO_ANY");
  });

  it("cho phép kiểu any nếu có comment bypass hợp lệ", () => {
    const diff = `+const data: any = JSON.parse(str); // allow-any: Dữ liệu bên thứ ba chưa có schema`;
    const issues = inspectDiffLines("src/app.ts", diff);
    expect(issues.length).toBe(0);
  });

  it("phát hiện @ts-ignore và @ts-nocheck", () => {
    const diff = `
+ // @ts-ignore
+ const a = 1;
+ //@ts-nocheck
`;
    const issues = inspectDiffLines("src/app.ts", diff);
    expect(issues.length).toBe(2);
    expect(issues[0].rule).toBe("NO_TS_IGNORE");
    expect(issues[1].rule).toBe("NO_TS_NOCHECK");
  });

  it("phát hiện console.log mới thêm", () => {
    const diff = `+console.log("debug data", obj);`;
    const issues = inspectDiffLines("src/service.ts", diff);
    expect(issues.length).toBe(1);
    expect(issues[0].rule).toBe("NO_CONSOLE_LOG");
  });

  it("bỏ qua dòng bị xóa (-) và file không phải TypeScript", () => {
    const diff = `-const x: any = 1;`;
    const issues = inspectDiffLines("src/app.ts", diff);
    expect(issues.length).toBe(0);

    const mdDiff = `+const x: any = 1;`;
    const mdIssues = inspectDiffLines("README.md", mdDiff);
    expect(mdIssues.length).toBe(0);
  });
});
```

- [ ] **Step 2: Viết mã triển khai `scripts/gates/diff-bans.mjs`**

```javascript
#!/usr/bin/env node
/**
 * diff-bans: Kiểm soát vi phạm hard-bans (any, @ts-ignore, @ts-nocheck, console.log)
 * chỉ trên các dòng mã mới thêm (+) của git diff.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

export function inspectDiffLines(filename, diffContent) {
  if (!/\.(ts|tsx|mts|cts)$/.test(filename)) return [];
  if (filename.includes(".test.") || filename.includes(".spec.")) return [];

  const lines = diffContent.split("\n");
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Chỉ kiểm tra các dòng thêm mới
    if (!line.startsWith("+") || line.startsWith("+++")) continue;

    const content = line.slice(1).trim();

    // 1. Kiểm tra : any
    if (/:\s*any\b/.test(content) && !content.includes("// allow-any:")) {
      violations.push({ line: i + 1, content, rule: "NO_ANY", message: "Cấm sử dụng kiểu 'any' mới" });
    }

    // 2. Kiểm tra @ts-ignore
    if (/@ts-ignore\b/.test(content) && !content.includes("// allow-ts-ignore:")) {
      violations.push({ line: i + 1, content, rule: "NO_TS_IGNORE", message: "Cấm thêm mới directive '@ts-ignore'" });
    }

    // 3. Kiểm tra @ts-nocheck
    if (/@ts-nocheck\b/.test(content) && !content.includes("// allow-ts-nocheck:")) {
      violations.push({ line: i + 1, content, rule: "NO_TS_NOCHECK", message: "Cấm thêm mới directive '@ts-nocheck'" });
    }

    // 4. Kiểm tra console.log
    if (/\bconsole\.log\s*\(/.test(content) && !content.includes("// allow-console:")) {
      violations.push({ line: i + 1, content, rule: "NO_CONSOLE_LOG", message: "Cấm để sót console.log trong mã nguồn" });
    }
  }

  return violations;
}

function runGitDiff() {
  try {
    const staged = execSync("git diff --staged -U0", { encoding: "utf-8" });
    const unstaged = execSync("git diff -U0", { encoding: "utf-8" });
    return staged + "\n" + unstaged;
  } catch {
    return "";
  }
}

function main() {
  const diff = runGitDiff();
  if (!diff.trim()) {
    console.log("✅ diff-bans: Không phát hiện thay đổi mã nguồn nào.");
    process.exit(0);
  }

  const fileChunks = diff.split(/^diff --git a\/.* b\//m);
  let totalViolations = 0;

  for (const chunk of fileChunks) {
    if (!chunk.trim()) continue;
    const firstLine = chunk.split("\n")[0];
    const filename = firstLine.split(" ")[0].trim();

    const violations = inspectDiffLines(filename, chunk);
    if (violations.length > 0) {
      totalViolations += violations.length;
      console.error(`\n❌ Vi phạm hard-bans tại: ${filename}`);
      for (const v of violations) {
        console.error(`  [${v.rule}] ${v.message}\n    > ${v.content}`);
      }
    }
  }

  if (totalViolations > 0) {
    console.error(`\nTổng cộng: ${totalViolations} lỗi hard-bans. Sửa lại code hoặc bổ sung chú thích bypass (// allow-*: <lý do>).`);
    process.exit(1);
  }

  console.log("✅ diff-bans: Đạt chuẩn, không có vi phạm hard-bans mới.");
  process.exit(0);
}

if (process.argv[1]?.endsWith("diff-bans.mjs")) {
  main();
}
```

- [ ] **Step 3: Chạy test xác minh**

Chạy test với vitest:
```bash
npx --prefix backend vitest run ../scripts/gates/diff-bans.test.mjs
```
Mong đợi: Test pass 100%.

- [ ] **Step 4: Chạy thử trên diff hiện tại và commit**

Chạy: `node scripts/gates/diff-bans.mjs`
Mong đợi: Exit 0.

Commit:
```bash
git add scripts/gates/diff-bans.mjs scripts/gates/diff-bans.test.mjs
git commit -m "feat(gates): thêm script diff-bans chặn any, ts-ignore và console.log" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Xây Dựng `tsc-gate.mjs` Đồng Bộ Type-Check Toàn Repo

**Files:**
- Create: `scripts/gates/tsc-gate.mjs`

**Interfaces:**
- Consumes: Cấu hình `tsconfig.json` tại `backend/` và `frontend/`
- Produces: Chạy kiểm tra TypeScript (`tsc --noEmit` và `tsc -b`), gom lỗi và xuất thông báo rõ ràng, exit 1 khi có lỗi type.

- [ ] **Step 1: Viết script `scripts/gates/tsc-gate.mjs`**

```javascript
#!/usr/bin/env node
/**
 * tsc-gate: Kiểm tra toàn bộ lỗi kiểu tĩnh của TypeScript cho cả backend và frontend.
 */

import { execSync } from "node:child_process";

console.log("🔍 Đang chạy kiểm tra TypeScript (Backend & Frontend)...");

let hasError = false;

// 1. Kiểm tra Backend
try {
  console.log("⏳ Checking Backend (tsc --noEmit)...");
  execSync("npm --prefix backend run type-check", { stdio: "inherit" });
  console.log("✅ Backend: Type-check thành công.");
} catch {
  console.error("❌ Backend: Phát hiện lỗi kiểu dữ liệu.");
  hasError = true;
}

// 2. Kiểm tra Frontend
try {
  console.log("⏳ Checking Frontend (tsc -b)...");
  execSync("npm --prefix frontend exec tsc -b", { stdio: "inherit" });
  console.log("✅ Frontend: Type-check thành công.");
} catch {
  console.error("❌ Frontend: Phát hiện lỗi kiểu dữ liệu.");
  hasError = true;
}

if (hasError) {
  console.error("\n❌ tsc-gate: Thất bại do tồn tại lỗi TypeScript.");
  process.exit(1);
}

console.log("\n✅ tsc-gate: Toàn bộ codebase đạt chuẩn Type-Safety.");
process.exit(0);
```

- [ ] **Step 2: Chạy kiểm tra thực tế**

Chạy:
```bash
node scripts/gates/tsc-gate.mjs
```
Mong đợi: Cả backend và frontend đều pass type-check và exit 0.

- [ ] **Step 3: Commit script**

```bash
git add scripts/gates/tsc-gate.mjs
git commit -m "feat(gates): thêm script tsc-gate gom type-check cả backend và frontend" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Xây Dựng `affected-tests.mjs` & `ocr-gate.mjs`

**Files:**
- Create: `scripts/gates/affected-tests.mjs`
- Create: `scripts/gates/ocr-gate.mjs`

**Interfaces:**
- Consumes: Git diff và CLI tool `ocr`
- Produces: 
  - `affected-tests.mjs`: Chạy vitest cho các package có file thay đổi hoặc toàn bộ test nếu có thay đổi dùng chung.
  - `ocr-gate.mjs`: Chạy `ocr delegate preview` để xác nhận danh sách file cần audit mà không gọi LLM bên ngoài.

- [ ] **Step 1: Viết `scripts/gates/affected-tests.mjs`**

```javascript
#!/usr/bin/env node
/**
 * affected-tests: Chạy các test liên quan tới diff mã nguồn hiện tại.
 */

import { execSync } from "node:child_process";

function getChangedFiles() {
  try {
    const output = execSync("git diff --name-only HEAD", { encoding: "utf-8" });
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

const changed = getChangedFiles();
const hasBackendChanges = changed.some((f) => f.startsWith("backend/src/"));
const hasFrontendChanges = changed.some((f) => f.startsWith("frontend/src/"));

console.log(`🔍 Phân tích test bị ảnh hưởng (Backend: ${hasBackendChanges}, Frontend: ${hasFrontendChanges})...`);

let failed = false;

if (hasBackendChanges || changed.length === 0) {
  try {
    console.log("⏳ Chạy Backend tests...");
    execSync("npm --prefix backend run test", { stdio: "inherit" });
  } catch {
    failed = true;
  }
}

if (hasFrontendChanges || changed.length === 0) {
  try {
    console.log("⏳ Chạy Frontend tests...");
    execSync("npm --prefix frontend run test", { stdio: "inherit" });
  } catch {
    failed = true;
  }
}

if (failed) {
  console.error("❌ affected-tests: Có bài test bị thất bại.");
  process.exit(1);
}

console.log("✅ affected-tests: Toàn bộ tests thành công.");
process.exit(0);
```

- [ ] **Step 2: Viết `scripts/gates/ocr-gate.mjs` (Delegation Mode)**

```javascript
#!/usr/bin/env node
/**
 * ocr-gate: Kiểm tra cổng Open-Code-Review ở chế độ Delegation Preview.
 * Không gọi LLM, chỉ xác định danh sách file mã nguồn cần rà soát.
 */

import { execSync } from "node:child_process";

console.log("🔍 Đang kiểm tra danh sách file qua OCR Delegation Gate...");

try {
  const result = execSync("npx --yes @alibaba-group/open-code-review delegate preview", {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  console.log(result);
  console.log("✅ ocr-gate: Delegation preview sẵn sàng.");
  process.exit(0);
} catch (error) {
  console.warn("⚠ ocr-gate: Lệnh preview thông báo:", error.message || error);
  // Delegation preview không nên chặn build nếu môi trường offline/chưa có network
  process.exit(0);
}
```

- [ ] **Step 3: Chạy thử 2 scripts**

Chạy:
```bash
node scripts/gates/affected-tests.mjs
node scripts/gates/ocr-gate.mjs
```
Mong đợi: Test pass thành công, OCR preview xuất danh sách hoặc hoàn tất mà không lỗi.

- [ ] **Step 4: Commit scripts**

```bash
git add scripts/gates/affected-tests.mjs scripts/gates/ocr-gate.mjs
git commit -m "feat(gates): thêm affected-tests và ocr-gate delegation preview" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Thiết Lập Claude Code Hooks (PowerShell 5.1) & Cấu Hình Settings

**Files:**
- Create: `.claude/hooks/stop-gates.ps1`
- Create: `.claude/hooks/block-worktree.ps1`
- Create: `.claude/hooks/routing-reminder.ps1`
- Modify: `.claude/settings.json`

**Interfaces:**
- Consumes: Events `Stop`, `PreToolUse`, `UserPromptSubmit` từ Claude Code CLI
- Produces: Chặn `EnterWorktree` ngay lập tức, tự động chạy gate nhẹ (tsc, diff-bans, size-gate) khi dừng task, nhắc routing theo tier.

- [ ] **Step 1: Viết `.claude/hooks/block-worktree.ps1`**

Chặn ngay công cụ `EnterWorktree` theo quy định của dự án:
```powershell
# Chặn hoàn toàn việc tạo worktree
Write-Host "CẤM: Dự án không sử dụng worktree (EnterWorktree). Hãy tạo git branch thông thường trên cùng checkout." -ForegroundColor Red
exit 1
```

- [ ] **Step 2: Viết `.claude/hooks/routing-reminder.ps1`**

Nhắc nhở nhẹ khi nộp prompt (chỉ hiển thị text, không chặn):
```powershell
# Nhắc nhở định tuyến task theo Tier (Task Routing)
Write-Host "[Task Routing Reminder] Kiểm tra Tier: Tier 1 (quick-worker/Haiku), Tier 2 (feature-builder/Sonnet), Tier 3 (deep-architect/Opus)." -ForegroundColor Cyan
exit 0
```

- [ ] **Step 3: Viết `.claude/hooks/stop-gates.ps1`**

Chỉ kích hoạt kiểm tra khi có diff mã nguồn (`backend/src/` hoặc `frontend/src/`):
```powershell
# Hook Stop: Kiểm tra chất lượng trước khi kết thúc task
$diffFiles = git diff --name-only HEAD
$stagedFiles = git diff --name-only --staged
$allDiff = ($diffFiles + "`n" + $stagedFiles) -split "`n" | Where-Object { $_ -ne "" }

$sourceChanged = $allDiff | Where-Object { $_ -match "^(backend|frontend)/src/.*\.(ts|tsx)$" }

if (-not $sourceChanged) {
    Write-Host "[Stop Gate] Chi thay doi docs/config hoac khong co diff ma nguon. Bo qua kiem tra code." -ForegroundColor Green
    exit 0
}

Write-Host "[Stop Gate] Phat hien thay doi ma nguon. Dang chay kiem tra tu dong..." -ForegroundColor Yellow

# 1. diff-bans
node scripts/gates/diff-bans.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Stop Gate] diff-bans that bai. Vui long sua loi truoc khi bao xong task." -ForegroundColor Red
    exit 1
}

# 2. size-gate
npm --prefix frontend run size-gate:strict
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Stop Gate] Frontend size-gate that bai." -ForegroundColor Red
    exit 1
}
node scripts/gates/size-gate.mjs --src backend/src --baseline backend/size-gate-baseline.json --strict
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Stop Gate] Backend size-gate that bai." -ForegroundColor Red
    exit 1
}

# 3. tsc-gate
node scripts/gates/tsc-gate.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Stop Gate] TypeScript type-check that bai." -ForegroundColor Red
    exit 1
}

Write-Host "[Stop Gate] Toan bo kiem tra nhe thanh cong!" -ForegroundColor Green
exit 0
```

- [ ] **Step 4: Cập nhật hooks vào `.claude/settings.json`**

Cập nhật `.claude/settings.json`:
```json
{
  "permissions": {
    "allow": [
      "Bash(echo \"---SUBTREE EXIT: $?\")",
      "Bash(git stash *)",
      "Bash(echo \"STASH EXIT: $?\")",
      "Bash(tasklist)"
    ]
  },
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File .claude/hooks/stop-gates.ps1"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "EnterWorktree",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File .claude/hooks/block-worktree.ps1"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File .claude/hooks/routing-reminder.ps1"
          }
        ]
      }
    ]
  },
  "worktree": {
    "baseRef": "head"
  }
}
```

- [ ] **Step 5: Chạy test thử các file hook bằng PowerShell**

Chạy:
```bash
powershell -ExecutionPolicy Bypass -File .claude/hooks/routing-reminder.ps1
powershell -ExecutionPolicy Bypass -File .claude/hooks/stop-gates.ps1
```
Mong đợi: Output màu xanh, exit code 0.

- [ ] **Step 6: Commit hook system**

```bash
git add .claude/hooks/ .claude/settings.json
git commit -m "feat(hooks): cấu hình hook tự động chặn worktree và kiểm soát gate khi stop" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Thiết Lập GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/gates.yml`

**Interfaces:**
- Consumes: Trigger `pull_request` và `workflow_dispatch`
- Produces: CI tự động chạy toàn diện: `tsc-gate` -> `diff-bans` -> `size-gate:strict` -> `affected-tests` -> `ocr-gate`.

- [ ] **Step 1: Tạo file `.github/workflows/gates.yml`**

```yaml
name: Quality Gates

on:
  pull_request:
    branches: [ main ]
  workflow_dispatch:

jobs:
  quality-audit:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: |
            backend/package.json
            frontend/package.json

      - name: Install Backend Dependencies
        run: npm --prefix backend ci

      - name: Install Frontend Dependencies
        run: npm --prefix frontend ci

      - name: Run diff-bans Gate
        run: node scripts/gates/diff-bans.mjs

      - name: Run size-gate (Frontend & Backend)
        run: |
          npm --prefix frontend run size-gate:strict
          node scripts/gates/size-gate.mjs --src backend/src --baseline backend/size-gate-baseline.json --strict

      - name: Run Type-Check (tsc-gate)
        run: node scripts/gates/tsc-gate.mjs

      - name: Run Tests (affected-tests)
        run: node scripts/gates/affected-tests.mjs

      - name: Run Open-Code-Review Delegation Preview
        run: node scripts/gates/ocr-gate.mjs
```

- [ ] **Step 2: Kiểm tra cú pháp YAML của workflow**

Chạy:
```bash
node -e "const fs = require('fs'); const content = fs.readFileSync('.github/workflows/gates.yml', 'utf-8'); console.log('YAML length:', content.length);"
```
Mong đợi: Đọc file thành công, độ dài > 0.

- [ ] **Step 3: Commit GitHub Actions workflow**

```bash
git add .github/workflows/gates.yml
git commit -m "ci: thiết lập GitHub Actions workflow kiểm soát toàn diện quality gates" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Cập Nhật & Đồng Bộ Hóa Toàn Bộ Quy Tắc (.claude/rules & CLAUDE.md)

**Files:**
- Modify: `.claude/rules/hard-bans.md`
- Modify: `.claude/rules/task-routing.md`
- Modify: `.claude/rules/token-economy.md`
- Create: `.claude/rules/gates.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Design spec đã duyệt
- Produces: Tài liệu và quy định quản trị chính xác 100% với hiện trạng mã nguồn.

- [ ] **Step 1: Cập nhật `.claude/rules/hard-bans.md`**

Cập nhật bảng trạng thái thực thi trong `.claude/rules/hard-bans.md`:
- Điều 1: Type `any` -> Cơ chế thực thi: `scripts/gates/diff-bans.mjs` + CI job. Trạng thái: **ĐÃ LẮP**.
- Điều 2: `@ts-nocheck` / `@ts-ignore` -> Cơ chế thực thi: `scripts/gates/diff-bans.mjs`. Trạng thái: **ĐÃ LẮP**.
- Điều 3: God file > 400 dòng -> Cơ chế thực thi: `scripts/gates/size-gate.mjs` + ratchet baseline. Trạng thái: **ĐÃ LẮP**.
- Điều 4: `ocr` -> Cơ chế thực thi: `scripts/gates/ocr-gate.mjs` + CI. Trạng thái: **ĐÃ LẮP (Delegation Mode)**.

- [ ] **Step 2: Cập nhật `.claude/rules/task-routing.md`**

Thêm mục **§8 "Chính Sách Phân Công Model & Trách Nhiệm Phiên (Phiên Bản Tối Ưu)"**:
- Phiên chính (Haiku/Sonnet) chịu trách nhiệm: Rà soát, đọc file, thiết kế (design) và viết tài liệu (spec, plan, doc markdown).
- Opus (thông qua `deep-architect` hoặc agent `Plan`): Chuyên trách **thinking** — suy luận sâu, phân tích cấu trúc kiến trúc phức tạp và **chuyển giao kết quả trở lại phiên chính** dưới dạng text để phiên chính xuất file markdown.
- Khẳng định các hook tự động đã được kích hoạt trong `.claude/settings.json` để chặn worktree và rà soát diff.

- [ ] **Step 3: Cập nhật `.claude/rules/token-economy.md`**

Bổ sung ghi chú:
- Hệ thống hook tự động (`stop-gates.ps1`) và shared gate scripts (`scripts/gates/`) giải phóng agent khỏi việc chạy các lệnh kiểm tra rải rác thủ công, tiết kiệm token cho phiên chat.

- [ ] **Step 4: Tạo tài liệu tra cứu nhanh `.claude/rules/gates.md`**

Tạo file mới `.claude/rules/gates.md` tóm tắt toàn bộ ma trận kiểm soát:

```markdown
# Quality Gates Matrix & Enforcement Guide

| Gate | Script | Chạy tại đâu | Điều kiện kích hoạt | Mã thoát | Cách bypass hợp lệ |
|---|---|---|---|---|---|
| **Hard Bans** | `scripts/gates/diff-bans.mjs` | Local Hook + CI | Có diff mã nguồn | 0 = sạch, 1 = có vi phạm | `// allow-any:`, `// allow-ts-ignore:`, `// allow-console:` |
| **Size Gate** | `scripts/gates/size-gate.mjs` | Local Hook + CI | Toàn bộ .ts/.tsx trong `src/` | 0 = đạt, 1 = vượt baseline | Chạy `--update` nếu đã được phê duyệt tăng size |
| **Type Check** | `scripts/gates/tsc-gate.mjs` | Local Hook + CI | Có diff mã nguồn | 0 = pass, 1 = lỗi type | Bắt buộc sửa type |
| **Tests** | `scripts/gates/affected-tests.mjs` | CI (và manual) | PR / CI push | 0 = pass, 1 = test fail | Sửa test |
| **OCR Gate** | `scripts/gates/ocr-gate.mjs` | CI (Delegation) | PR / CI push | 0 = pass | Miễn trừ khi chỉ sửa docs/git |
```

- [ ] **Step 5: Cập nhật `CLAUDE.md`**

Cập nhật mục Open-Codereview Gate và Hard Bans trong `CLAUDE.md`, dẫn chiếu trực tiếp đến `scripts/gates/` và `.claude/rules/gates.md`.

- [ ] **Step 6: Commit cập nhật tài liệu governance**

```bash
git add .claude/rules/ CLAUDE.md
git commit -m "docs(governance): đồng bộ toàn bộ rules, workflows và CLAUDE.md với hệ thống gates tự động" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: Kiểm Tra E2E Toàn Diện (End-to-End Verification)

**Files:**
- Test all components end-to-end.

**Interfaces:**
- Consumes: Tất cả scripts và hooks đã xây dựng.
- Produces: Chứng minh thực nghiệm hệ thống chặn vi phạm và cho phép mã sạch đi qua.

- [ ] **Step 1: Test kịch bản vi phạm Hard-Bans (Negative Test)**

Tạo file tạm `backend/src/temp-violation.ts` chứa vi phạm:
```typescript
const badData: any = 123;
console.log("bad console log");
```
Chạy: `node scripts/gates/diff-bans.mjs`
Mong đợi: Báo lỗi và exit 1 với 2 lỗi `NO_ANY` và `NO_CONSOLE_LOG`.

- [ ] **Step 2: Test kịch bản Bypass hợp lệ (Whitelist Test)**

Sửa `backend/src/temp-violation.ts` thành:
```typescript
const badData: any = 123; // allow-any: Test bypass
console.log("bad console log"); // allow-console: Test bypass
```
Chạy: `node scripts/gates/diff-bans.mjs`
Mong đợi: Báo thành công và exit 0.

- [ ] **Step 3: Dọn file test tạm**

Xóa file test:
```bash
rm backend/src/temp-violation.ts
```

- [ ] **Step 4: Chạy toàn bộ các gate scripts kiểm tra trạng thái cuối**

Chạy lần lượt:
```bash
node scripts/gates/diff-bans.mjs
npm --prefix frontend run size-gate:strict
node scripts/gates/size-gate.mjs --src backend/src --baseline backend/size-gate-baseline.json --strict
node scripts/gates/tsc-gate.mjs
node scripts/gates/affected-tests.mjs
node scripts/gates/ocr-gate.mjs
powershell -ExecutionPolicy Bypass -File .claude/hooks/stop-gates.ps1
```
Mong đợi: Tất cả các lệnh đều trả về exit code 0.

- [ ] **Step 5: Commit hoàn tất milestone**

```bash
git status
git log -n 5 --oneline
```
Chụp trạng thái sạch sẽ và hoàn thành task.
