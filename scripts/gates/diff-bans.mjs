#!/usr/bin/env node
/**
 * diff-bans: Kiểm soát vi phạm hard-bans (any, @ts-ignore, @ts-nocheck, console.log)
 * chỉ trên các dòng mã mới thêm (+) của git diff.
 */

import { execSync } from "node:child_process";

export function inspectDiffLines(filename, diffContent) {
  // Chỉ quét mã nguồn TypeScript/JavaScript thực sự; bỏ qua test spec và file không phải TS
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
