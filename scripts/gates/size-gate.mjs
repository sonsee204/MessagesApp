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
import { join, resolve, relative, extname, dirname } from "node:path";

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
const BASE_DIR = dirname(ROOT);
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
  // Khóa baseline là đường dẫn tương đối so với thư mục CHA của --src
  // (vd: frontend/src/App.tsx, backend/src/index.ts) → chuẩn hoá bất kể cwd.
  const rel = relative(BASE_DIR, file).replace(/\\/g, "/");
  const content = readFileSync(file, "utf-8");
  const effective = countEffectiveLines(content);
  current[rel] = effective;

  // Ratchet chỉ chốt ceiling CAO cho file nợ cũ vượt ngưỡng 400 dòng;
  // file nhỏ luôn dùng ngưỡng chuẩn để tránh phải chạy --update vô nghĩa.
  const baseLimit = baseline[rel] ?? null;
  const limit = baseLimit !== null && baseLimit > MAX_EFFECTIVE_LINES ? baseLimit : MAX_EFFECTIVE_LINES;
  if (effective > limit) {
    violations.push({ file: rel, effective, limit });
  }
}

// Guard: --update bắt buộc phải có --baseline, nếu không sẽ lặng lẽ chạy check thường gây hiểu nhầm đã update
if (isUpdate && !BASELINE_PATH) {
  console.error("❌ Cờ --update yêu cầu --baseline <đường_dẫn_file>");
  process.exit(1);
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
