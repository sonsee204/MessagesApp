#!/usr/bin/env node
/**
 * tsc-gate: Kiểm tra toàn bộ lỗi kiểu tĩnh của TypeScript cho cả backend và frontend.
 *
 * Luồng nghiệp vụ:
 * - Chạy `tsc --noEmit` cho backend qua script `type-check` (không sinh artifact).
 * - Chạy `tsc -b` cho frontend qua script `type-check` (build theo project references,
 *   chỉ kiểm tra type, KHÔNG chạy `vite build` như script `build`).
 * - Gom kết quả: nếu một trong hai thất bại thì exit 1, ngược lại exit 0.
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
// Lưu ý: KHÔNG dùng `npm exec tsc -b` vì npm sẽ nuốt `-b` thành CLI config
// flag của chính npm ("Unknown cli config --b"). Phải gọi qua script `type-check`
// (= `tsc -b`, build theo project references, chỉ kiểm tra type, KHÔNG chạy `vite build`).
try {
  console.log("⏳ Checking Frontend (tsc -b)...");
  execSync("npm --prefix frontend run type-check", { stdio: "inherit" });
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
