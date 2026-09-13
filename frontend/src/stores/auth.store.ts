import { create } from "zustand";
import { User } from "../types/auth.types";

/**
 * Interface định nghĩa trạng thái và các hành động của Auth Store
 */
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Cập nhật thông tin đăng nhập thành công
  setAuth: (user: User, accessToken: string) => void;

  // Cập nhật Access Token mới (khi làm mới token ngầm)
  setAccessToken: (accessToken: string) => void;

  // Xóa sạch trạng thái đăng nhập khi đăng xuất
  clearAuth: () => void;

  // Cập nhật trạng thái đang tải
  setLoading: (isLoading: boolean) => void;

  // Cập nhật thông tin hồ sơ người dùng
  setUser: (user: User) => void;
}

/**
 * Zustand Store quản lý trạng thái xác thực toàn cục
 * Lưu ý quan trọng về bảo mật: Access Token CHỈ lưu trong bộ nhớ RAM (Memory-only state)
 * KHÔNG lưu vào localStorage/sessionStorage để phòng chống tuyệt đối tấn công XSS đánh cắp token
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken) =>
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    }),

  setAccessToken: (accessToken) =>
    set({
      accessToken,
      isAuthenticated: true,
    }),

  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setUser: (user) => set({ user }),
}));
