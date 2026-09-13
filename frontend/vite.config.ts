import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Cấu hình máy chủ phát triển Vite cho dự án Frontend AppMessaging
 * 1. Định cấu hình Plugin React với Fast Refresh (HMR)
 * 2. Thiết lập đường dẫn rút gọn Alias @ trỏ về thư mục src
 * 3. Cấu hình Proxy chuyển tiếp API /api và kết nối WebSocket /socket.io sang Backend (port 5000)
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Chuyển tiếp các cuộc gọi REST API sang máy chủ Backend (dùng 127.0.0.1 để tránh xung đột IPv6 localhost trên Windows)
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false,
      },
      // Chuyển tiếp kết nối Socket.IO thời gian thực
      "/socket.io": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
