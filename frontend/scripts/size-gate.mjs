#!/usr/bin/env node
/**
 * size-gate: Kiểm tra giới hạn dòng hiệu dụng (effective lines) của các file
 * nguồn trong frontend/src. Mục tiêu: chặn "god file" > 400 dòng hiệu dụng.
 *
 * Định nghĩa "dòng hiệu dụng": dòng KHÔNG phải dòng trống và KHÔNG phải dòng
 * chỉ chứa chú thích thuần (line comment và block comment). Dòng có code kèm
 * chú thích cuối dòng vẫn được tính là hiệu dụng.
 *
 * Cách dùng:
 *   node scripts/size-gate.mjs              # kiểm tra tất cả .ts/.tsx
 *   node scripts/size-gate.mjs --strict     # exit 1 nếu vi phạm
 *   node scripts/size-gate.mjs --update     # ghi baseline mới vào size-gate-baseline.json
 *
 * Cơ chế ratchet (baseline): baseline lưu số dòng hiệu dụng của mỗi file tại
 * thời điểm chụp snapshot. Quy tắc:
 *   - File MỚI (không có trong baseline): chỉ cần ≤ 400 dòng hiệu dụng.
 *   - File CÓ trong baseline: số dòng hiệu dụng hiện tại phải ≤ chính baseline đó.
 *     Nghĩa là chỉ cho phép GIẢM (hoặc giữ nguyên), tuyệt đối KHÔNG được TĂNG.
 *   - File nợ cũ (>400) khi chụp baseline lần đầu sẽ được grandfather ở đúng kích
 *     thước hiện tại; từ đó mỗi refactor chỉ được thu nhỏ, không được phình to.
 *
 * Khi chạy --update: chụp snapshot toàn bộ file hiện tại làm baseline mới.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

// ---------------------------------------------------------------------------
// Hằng số
// ---------------------------------------------------------------------------
const MAX_EFFECTIVE_LINES = 400;
const ROOT = join(import.meta.dirname, "..", "src");
const BASELINE_PATH = join(import.meta.dirname, "..", "size-gate-baseline.json");
const EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const isStrict = process.argv.includes("--strict");
const isUpdate = process.argv.includes("--update");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Đếm số dòng hiệu dụng trong nội dung văn bản.
 * Bỏ qua: dòng trống, dòng chỉ chứa chú thích thuần.
 */
function countEffectiveLines(content) {
  const lines = content.split("\n");
  let count = 0;
  let inBlockComment = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Đang trong block comment /* ... */
    if (inBlockComment) {
      if (line.includes("*/")) {
        inBlockComment = false;
        // Nếu dòng kết thúc block comment có code sau */ → vẫn tính
        const afterClose = line.slice(line.indexOf("*/") + 2).trim();
        if (afterClose.length > 0) count++;
      }
      continue;
    }

    // Dòng trống
    if (line.trim().length === 0) continue;

    // Block comment mở đầu dòng
    if (line.trimStart().startsWith("/*")) {
      // Nếu block comment mở và đóng trên cùng một dòng, kiểm tra code sau đó
      if (line.includes("*/")) {
        const afterClose = line.slice(line.indexOf("*/") + 2).trim();
        if (afterClose.length > 0) count++;
        continue;
      }
      inBlockComment = true;
      continue;
    }

    // Line comment thuần (// ở đầu dòng, sau whitespace)
    const stripped = line.trimStart();
    if (stripped.startsWith("//")) continue;

    // Dòng chỉ đóng block comment (*/)
    if (stripped === "*/" || stripped.startsWith("*/")) {
      const afterClose = stripped.slice(2).trim();
      if (afterClose.length === 0) continue;
    }

    count++;
  }

  return count;
}

/**
 * Duyệt đệ quy thư mục, trả về danh sách file .ts/.tsx.
 */
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Đọc baseline cũ (nếu có)
let baseline = {};
if (existsSync(BASELINE_PATH)) {
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
  } catch {
    console.warn(`⚠ Không đọc được baseline ${BASELINE_PATH}, coi như rỗng.`);
  }
}

// Quét tất cả file nguồn
const files = walk(ROOT);
const current = {};
const violations = [];

for (const file of files) {
  const rel = relative(join(import.meta.dirname, ".."), file).replace(/\\/g, "/");
  const content = readFileSync(file, "utf-8");
  const effective = countEffectiveLines(content);
  current[rel] = effective;

  // Ratchet: baseline ghi số dòng hiệu dụng tại snapshot.
  //   File mới → giới hạn = MAX_EFFECTIVE_LINES (400).
  //   File có baseline → giới hạn = baseline (chỉ cho phép giảm, không tăng).
  //   Không có baseline mà quá MAX → vi phạm.
  const limit = baseline[rel] ?? MAX_EFFECTIVE_LINES;
  if (effective > limit) {
    violations.push({ file: rel, effective, limit });
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

if (isUpdate) {
  // Chụp toàn bộ file hiện tại làm baseline ratchet.
  // File nợ cũ (>400) được grandfather ở đúng kích thước snapshot: từ nay chỉ
  // cho phép GIẢM dòng, không được TĂNG. File mới (không có trong baseline sau
  // này) sẽ bị chặn ở MAX_EFFECTIVE_LINES (400).
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + "\n", "utf-8");
  console.log(`✅ Baseline đã cập nhật: ${Object.keys(current).length} file → ${BASELINE_PATH}`);
  process.exit(0);
}

// In báo cáo
if (violations.length === 0) {
  console.log(`✅ size-gate: tất cả ${files.length} file đạt yêu cầu (≤ ${MAX_EFFECTIVE_LINES} dòng hiệu dụng).`);
  if (!existsSync(BASELINE_PATH)) {
    console.log(`💡 Chưa có baseline. Chạy \`npm run size-gate -- --update\` để chụp baseline ratchet.`);
  }
  process.exit(0);
}

// Có vi phạm
console.error(`\n❌ size-gate: ${violations.length} file vượt giới hạn dòng hiệu dụng:\n`);
for (const v of violations.sort((a, b) => b.effective - a.effective)) {
  console.error(`  ${v.file}: ${v.effective} dòng (giới hạn: ${v.limit})`);
}
console.error(`\nGiới hạn: ${MAX_EFFECTIVE_LINES} dòng hiệu dụng (không tính dòng trống và chú thích thuần).`);
console.error("Tách file lớn thành nhiều module nhỏ hơn hoặc giảm code không cần thiết.\n");

if (isStrict) {
  process.exit(1);
} else {
  console.warn("⚠ Chạy ở chế độ non-strict (không exit 1). Dùng --strict để bật gate.");
  process.exit(0);
}
