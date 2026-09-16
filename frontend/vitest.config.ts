import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Cấu hình kiểm thử tự động với Vitest cho dự án Frontend
 * Thiết lập môi trường DOM (jsdom), globals và alias @ trỏ về src
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
});
