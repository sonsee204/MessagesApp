/**
 * Định nghĩa cấu trúc hồ sơ người dùng (User Profile)
 * Đồng bộ với User Model từ Backend
 */
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string;
  statusMessage?: string;
  role?: "USER" | "ADMIN";
  isOnline?: boolean;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Cấu trúc dữ liệu phản hồi từ các API Xác thực (/register, /login, /refresh)
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
  token?: string;
}

/**
 * Cấu trúc phản hồi API chuẩn hóa của hệ thống
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
  };
}
