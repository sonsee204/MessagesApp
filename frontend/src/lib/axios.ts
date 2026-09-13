import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../stores/auth.store";
import { ApiResponse, AuthResponse } from "../types/auth.types";

/**
 * Khởi tạo Axios Instance dùng chung cho toàn bộ ứng dụng
 * 1. baseURL: "/api" (được Vite proxy chuyển tiếp đến máy chủ backend)
 * 2. withCredentials: true (bắt buộc để trình duyệt tự động gửi kèm Signed HTTP-Only Cookie)
 */
export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Biến cờ và hàng đợi để xử lý nhiều request đồng thời khi Access Token hết hạn
 */
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

/**
 * Xử lý giải phóng các request đang chờ trong hàng đợi sau khi làm mới token
 */
const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Request Interceptor: Tự động đính kèm Access Token từ Zustand Store vào HTTP Header
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor: Tự động bắt mã lỗi TOKEN_EXPIRED để âm thầm làm mới token (Silent Refresh)
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Không xử lý nếu không có config hoặc request tới chính endpoint auth refresh/login/logout
    if (!originalRequest || originalRequest.url?.includes("/auth/refresh") || originalRequest.url?.includes("/auth/login")) {
      return Promise.reject(error);
    }

    const errorData = error.response?.data?.error;
    const isTokenExpired =
      error.response?.status === 401 &&
      (errorData?.code === "TOKEN_EXPIRED" || errorData?.message?.toLowerCase().includes("hết hạn"));

    // Nếu lỗi 401 do token hết hạn và request chưa được thử lại lần nào
    if (isTokenExpired && !originalRequest._retry) {
      if (isRefreshing) {
        // Nếu đang có một tiến trình làm mới token khác chạy, đẩy request này vào hàng đợi chờ token mới
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Gọi API làm mới token (Refresh Token tự động gửi qua Signed HTTP-Only Cookie)
        const refreshResponse = await axios.post<ApiResponse<AuthResponse>>(
          "/api/auth/refresh",
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data.data?.accessToken;
        if (!newAccessToken) {
          throw new Error("Không nhận được access token mới từ máy chủ");
        }

        // Cập nhật Access Token mới vào Zustand Store
        useAuthStore.getState().setAccessToken(newAccessToken);

        // Giải phóng hàng đợi các request bị nghẽn
        processQueue(null, newAccessToken);

        // Thực hiện lại request ban đầu với token mới
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Nếu làm mới token thất bại (refresh token cũng đã hết hạn hoặc bị thu hồi): Xóa phiên đăng nhập
        processQueue(refreshError, null);
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
