import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Cấu hình Vitest chạy bộ test chất lượng gates (scripts/gates) ở repo root.
 *
 * Lý do: repo là npm monorepo không có node_modules ở root, vitest chỉ được cài
 * trong backend/. Config này đặt root test tại scripts/gates và include các
 * *.test.mjs ở đó, nhờ backend/node_modules để resolve vitest cho test file.
 */
export default defineConfig({
  test: {
    root: path.resolve(__dirname, "../scripts/gates"),
    include: ["**/*.test.mjs"],
    globals: true,
  },
});
