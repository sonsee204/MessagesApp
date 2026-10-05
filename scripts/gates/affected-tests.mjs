#!/usr/bin/env node
/**
 * affected-tests: Phân tích git diff và chỉ chạy kiểm thử (vitest) cho các package bị ảnh hưởng.
 *
 * Luồng hoạt động:
 * 1. Thu thập danh sách tệp thay đổi từ git diff (staged + unstaged) và tệp chưa theo dõi (untracked).
 * 2. Phân loại thay đổi theo package (backend, frontend, shared/root).
 * 3. Kích hoạt vitest run tương ứng cho package bị ảnh hưởng.
 * 4. Nếu không có thay đổi mã nguồn nào (hoặc cờ --all), chạy toàn bộ kiểm thử để đảm bảo tính toàn vẹn.
 */

import { execSync } from "node:child_process";

/**
 * Lấy danh sách tất cả các tệp có thay đổi (gồm tracked diff và untracked files).
 * @returns {string[]} Danh sách đường dẫn tệp tương đối
 */
function getChangedFiles() {
  const files = new Set();

  // 1. Thu thập tệp thay đổi đã commit hoặc đang staged/unstaged so với HEAD
  try {
    const diff = execSync("git diff --name-only HEAD", {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 50,
    });
    for (const file of diff.split("\n").map((f) => f.trim()).filter(Boolean)) {
      files.add(file);
    }
  } catch {
    // Dự phòng khi HEAD chưa trỏ hoặc repository chưa có commit nào
    try {
      const staged = execSync("git diff --name-only --cached", { encoding: "utf-8" });
      for (const file of staged.split("\n").map((f) => f.trim()).filter(Boolean)) {
        files.add(file);
      }
      const unstaged = execSync("git diff --name-only", { encoding: "utf-8" });
      for (const file of unstaged.split("\n").map((f) => f.trim()).filter(Boolean)) {
        files.add(file);
      }
    } catch {
      // Bỏ qua lỗi nếu không thể trích xuất diff
    }
  }

  // 2. Thu thập tệp chưa theo dõi (untracked files), tuân thủ spec §3.1.2
  try {
    const untracked = execSync("git ls-files --others --exclude-standard", {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 50,
    });
    for (const file of untracked.split("\n").map((f) => f.trim()).filter(Boolean)) {
      files.add(file);
    }
  } catch {
    // Bỏ qua lỗi nếu lệnh git ls-files gặp sự cố
  }

  return Array.from(files);
}

function main() {
  const forceAll = process.argv.includes("--all");
  const changed = getChangedFiles();

  // Kiểm tra phạm vi ảnh hưởng của các thay đổi
  const hasBackendChanges = changed.some(
    (f) => f.startsWith("backend/src/") || f.startsWith("backend/test") || f.startsWith("backend/package.json")
  );
  const hasFrontendChanges = changed.some(
    (f) => f.startsWith("frontend/src/") || f.startsWith("frontend/test") || f.startsWith("frontend/package.json")
  );
  const hasSharedChanges = changed.some(
    (f) => f.startsWith("shared/") || f.startsWith("packages/shared/")
  );

  console.log(
    `[affected-tests] Phân tích thay đổi: ${changed.length} tệp (Backend: ${hasBackendChanges}, Frontend: ${hasFrontendChanges}, Shared: ${hasSharedChanges}, ForceAll: ${forceAll})`
  );

  // Xác định các bộ test cần thực thi
  const shouldRunBackend = forceAll || hasBackendChanges || hasSharedChanges || changed.length === 0;
  const shouldRunFrontend = forceAll || hasFrontendChanges || hasSharedChanges || changed.length === 0;

  if (!shouldRunBackend && !shouldRunFrontend) {
    console.log("[affected-tests] Không có tệp mã nguồn backend/frontend nào bị ảnh hưởng. Bỏ qua bước chạy kiểm thử.");
    process.exit(0);
  }

  let failed = false;

  // Thực thi kiểm thử Backend
  if (shouldRunBackend) {
    try {
      console.log("[affected-tests] Đang chạy kiểm thử Backend...");
      execSync("npm --prefix backend run test", { stdio: "inherit" });
    } catch (err) {
      console.error("[affected-tests] Lỗi khi chạy kiểm thử Backend:", err.message || err);
      failed = true;
    }
  }

  // Thực thi kiểm thử Frontend
  if (shouldRunFrontend) {
    try {
      console.log("[affected-tests] Đang chạy kiểm thử Frontend...");
      execSync("npm --prefix frontend run test", { stdio: "inherit" });
    } catch (err) {
      console.error("[affected-tests] Lỗi khi chạy kiểm thử Frontend:", err.message || err);
      failed = true;
    }
  }

  if (failed) {
    console.error("[affected-tests] Có bài kiểm thử thất bại. Vui lòng sửa lỗi trước khi tiếp tục.");
    process.exit(1);
  }

  console.log("[affected-tests] Toàn bộ bài kiểm thử liên quan đã vượt qua thành công.");
  process.exit(0);
}

main();
