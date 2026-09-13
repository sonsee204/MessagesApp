import { apiClient } from "../../../lib/axios";
import { User, ApiResponse } from "../../../types/auth.types";
import { formatApiError } from "../../../lib/error-formatter";

/**
 * Dịch vụ REST API quản lý Người dùng và Tìm kiếm danh bạ (User Service)
 * Kết nối các API endpoints trên máy chủ Backend thông qua Axios Client:
 * 1. GET /api/users/search?q={query} - Tìm kiếm người dùng theo username/displayName
 * 2. GET /api/users/profile - Lấy thông tin chi tiết hồ sơ cá nhân
 * 3. PATCH /api/users/profile - Cập nhật thông tin hồ sơ (displayName, avatarUrl, bannerUrl, bio)
 * 4. POST /api/users/avatar - Tải lên ảnh đại diện dạng multipart/form-data
 * 5. POST /api/users/banner - Tải lên ảnh bìa hồ sơ dạng multipart/form-data
 * 6. PUT /api/users/change-password - Đổi mật khẩu (bắt buộc xác thực mật khẩu hiện tại)
 */

/**
 * Dữ liệu gửi lên khi đổi mật khẩu.
 * Vì access token chỉ nằm trong RAM (không lưu localStorage), mỗi lần đổi mật khẩu
 * đều phải gửi kèm mật khẩu hiện tại để máy chủ xác thực lại chính chủ tài khoản.
 */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
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
   * Lấy thông tin hồ sơ chi tiết của một người dùng theo ID
   * @param id ID của người dùng cần tra cứu
   * @returns Dữ liệu người dùng bao gồm bannerUrl, bio, statusMessage, createdAt
   */
  async getUserById(id: string): Promise<User> {
    try {
      const response = await apiClient.get<ApiResponse<User>>(`/users/${id}`);

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Không thể lấy thông tin người dùng");
      }

      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tải thông tin người dùng."));
    }
  },

  /**
   * Cập nhật thông tin hồ sơ cá nhân
   * @param data Dữ liệu cập nhật (tên hiển thị, đường dẫn avatar, đường dẫn ảnh bìa, tiểu sử)
   * @returns Thông tin người dùng sau khi đã cập nhật
   */
  async updateProfile(
    data: Partial<Pick<User, "displayName" | "avatarUrl" | "bannerUrl" | "bio" | "statusMessage">>
  ): Promise<User> {
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

  /**
   * Gửi tệp ảnh lên máy chủ dưới dạng multipart/form-data.
   *
   * BẮT BUỘC ghi đè Content-Type về undefined cho RIÊNG request này.
   * apiClient đặt cứng "application/json" ở cấp instance; mà axios chỉ xoá
   * Content-Type cho FormData BÊN TRONG adapter, tức SAU khi transformRequest
   * đã chạy — lúc đó FormData đã bị JSON.stringify và tệp bị mất sạch.
   * Ghi đè tại đây để transformRequest thấy content-type rỗng và trả về
   * nguyên vẹn đối tượng FormData; trình duyệt tự đặt multipart/form-data kèm boundary.
   */
  async uploadImage(endpoint: "avatar" | "banner", file: File): Promise<User> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post<ApiResponse<User>>(`/users/${endpoint}`, formData, {
        headers: { "Content-Type": undefined },
      });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Không thể tải ảnh lên");
      }

      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tải ảnh lên. Vui lòng thử lại."));
    }
  },

  /** Tải lên ảnh đại diện mới; trả về hồ sơ người dùng đã cập nhật */
  async uploadAvatar(file: File): Promise<User> {
    return this.uploadImage("avatar", file);
  },

  /** Tải lên ảnh bìa trang hồ sơ; trả về hồ sơ người dùng đã cập nhật */
  async uploadBanner(file: File): Promise<User> {
    return this.uploadImage("banner", file);
  },

  /**
   * Đổi mật khẩu tài khoản đang đăng nhập
   * Backend dùng PUT (không phải POST) và xác thực mật khẩu hiện tại trước khi ghi mật khẩu mới
   * @param data Bộ ba mật khẩu hiện tại / mật khẩu mới / xác nhận mật khẩu
   */
  async changePassword(data: ChangePasswordPayload): Promise<void> {
    try {
      const response = await apiClient.put<ApiResponse<{ message: string }>>(
        "/users/change-password",
        data
      );

      if (!response.data.success) {
        throw new Error(response.data.error?.message || "Không thể đổi mật khẩu");
      }
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể đổi mật khẩu."));
    }
  },
};
