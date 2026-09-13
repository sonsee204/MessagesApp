import { apiClient } from "../../../lib/axios";
import { User, ApiResponse } from "../../../types/auth.types";
import { formatApiError } from "../../../lib/error-formatter";

/**
 * Dịch vụ REST API quản lý Người dùng và Tìm kiếm danh bạ (User Service)
 * Kết nối các API endpoints trên máy chủ Backend thông qua Axios Client:
 * 1. GET /api/users/search?q={query} - Tìm kiếm người dùng theo username/displayName
 * 2. GET /api/users/profile - Lấy thông tin chi tiết hồ sơ cá nhân
 * 3. PATCH /api/users/profile - Cập nhật thông tin hồ sơ (displayName, avatarUrl, bio)
 */
export const userService = {
  /**
   * Tìm kiếm người dùng trong hệ thống theo từ khóa (Username hoặc Email)
   * Phục vụ việc tìm kiếm đối tác để khởi tạo cuộc trò chuyện mới
   * @param query Từ khóa tìm kiếm do người dùng nhập
   * @returns Danh sách người dùng thỏa mãn điều kiện
   */
  async searchUsers(query: string): Promise<User[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const response = await apiClient.get<ApiResponse<User[]>>(
        `/users/search?q=${encodeURIComponent(query.trim())}`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Lỗi khi tìm kiếm người dùng");
      }

      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tìm kiếm người dùng."));
    }
  },

  /**
   * Lấy thông tin hồ sơ cá nhân của người dùng hiện tại
   * @returns Dữ liệu hồ sơ người dùng đầy đủ
   */
  async getProfile(): Promise<User> {
    try {
      const response = await apiClient.get<ApiResponse<User>>("/users/profile");

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Không thể lấy thông tin hồ sơ");
      }

      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tải thông tin hồ sơ cá nhân."));
    }
  },

  /**
   * Cập nhật thông tin hồ sơ cá nhân
   * @param data Dữ liệu cập nhật (tên hiển thị, đường dẫn avatar, tiểu sử)
   * @returns Thông tin người dùng sau khi đã cập nhật
   */
  async updateProfile(data: Partial<Pick<User, "displayName" | "avatarUrl" | "bio">>): Promise<User> {
    try {
      // Backend chỉ mở PATCH cho endpoint này, không có PUT
      const response = await apiClient.patch<ApiResponse<User>>("/users/profile", data);

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Không thể cập nhật hồ sơ");
      }

      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể cập nhật thông tin hồ sơ."));
    }
  },
};
