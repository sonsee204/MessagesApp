#!/usr/bin/env node
/**
 * ocr-gate: Kiểm tra cổng rà soát mã nguồn tự động qua Open-Code-Review (chế độ Delegation Preview).
 *
 * Luồng hoạt động:
 * 1. Gọi lệnh preview của open-code-review qua npx để trích xuất danh sách tệp cần review trong workspace.
 * 2. Không gọi API mô hình ngôn ngữ lớn (LLM), đảm bảo tốc độ và tiết kiệm chi phí/token.
 * 3. Bắt lỗi kết nối mạng (nếu offline hoặc npx chưa tải được package) để tránh chặn nhầm luồng phát triển local.
 */

import { execSync } from "node:child_process";

console.log("[ocr-gate] Đang kiểm tra danh sách tệp qua OCR Delegation Gate (preview mode)...");

try {
  const result = execSync("npx --yes @alibaba-group/open-code-review delegate preview", {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.trim()) {
    console.log(result.trim());
  }
  console.log("[ocr-gate] OCR Delegation Preview hoàn tất thành công.");
  process.exit(0);
} catch (error) {
  console.warn("[ocr-gate] Cảnh báo: Lệnh preview không thể thực thi hoàn tất:");
  console.warn(error.message || error);
  // Delegation preview không nên chặn build nếu môi trường offline hoặc chưa có kết nối mạng
  process.exit(0);
}
