import { apiClient } from "../../../lib/axios";
import { ApiResponse, AuthResponse, User } from "../../../types/auth.types";
import { LoginFormValues, RegisterFormValues } from "../schemas/auth.schema";
import { formatApiError } from "../../../lib/error-formatter";

/**
 * Service xử lý toàn bộ các lời gọi API Xác thực người dùng
 * Đảm bảo 100% các lỗi đều được dịch sang tiếng Việt chuẩn mực trước khi trả về cho UI
 */
export const authService = {
  /**
   * Gọi API đăng nhập tài khoản
   * @param credentials Thông tin đăng nhập (email/username và mật khẩu)
   * @returns Dữ liệu người dùng và Access Token
   */
  async login(credentials: LoginFormValues): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<ApiResponse<AuthResponse>>(
        "/auth/login",
        {
          identifier: credentials.identifier,
          password: credentials.password,
        }
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Đăng nhập thất bại");
      }

      return response.data.data;
    } catch (error) {
      // Bắt và Việt hóa toàn diện lỗi từ Axios và máy chủ
      throw new Error(formatApiError(error, "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin."));
    }
  },

  /**
   * Gọi API đăng ký tài khoản mới
   * @param data Dữ liệu đăng ký từ form
   * @returns Dữ liệu hồ sơ người dùng và cặp token khởi tạo
   */
  async register(data: RegisterFormValues): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<ApiResponse<AuthResponse>>(
        "/auth/register",
        {
          username: data.username,
          email: data.email,
          password: data.password,
          displayName: data.displayName || data.username,
        }
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Đăng ký tài khoản thất bại");
      }

      return response.data.data;
    } catch (error) {
      // Bắt và Việt hóa toàn diện lỗi từ Axios và máy chủ
      throw new Error(formatApiError(error, "Đăng ký tài khoản thất bại. Vui lòng kiểm tra lại."));
    }
  },

  /**
   * Gọi API đăng xuất tài khoản
   * Thu hồi Refresh Token khỏi CSDL và xóa sạch Signed Cookie
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post<ApiResponse>("/auth/logout");
    } catch (error) {
      console.warn("Lỗi khi đăng xuất máy chủ:", formatApiError(error));
    }
  },

  /**
   * Lấy thông tin tài khoản hiện tại từ Access Token
   */
  async getMe(): Promise<User> {
    try {
      const response = await apiClient.get<ApiResponse<User>>("/auth/me");
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Không thể lấy thông tin người dùng");
      }
      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể lấy thông tin phiên làm việc."));
    }
  },
};
