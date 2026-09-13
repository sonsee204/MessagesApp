import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import "./index.css";

/**
 * Khởi tạo QueryClient cho TanStack React Query v5
 * Cấu hình staleTime và hạn chế refetch không cần thiết để tối ưu hiệu năng
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 phút cache cho dữ liệu tĩnh
      retry: 1,                 // Thử lại tối đa 1 lần nếu request lỗi
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Điểm vào khởi chạy ứng dụng React
 */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
