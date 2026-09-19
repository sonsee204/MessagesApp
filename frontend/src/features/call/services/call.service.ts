import { apiClient } from "../../../lib/axios";
import { ApiResponse } from "../../../types/auth.types";
import { CallHistoryItem } from "../types/call.types";

/**
 * Service giao tiếp REST API cho tính năng Cuộc gọi (Call Client Service)
 */
export const callService = {
  // ===== DEVICE TOKEN MANAGEMENT (FCM Push Notification) =====

  /**
   * Đăng ký FCM device token lên backend để nhận push notification khi offline.
   * Gọi sau khi login thành công và đã lấy được token từ requestNotificationPermission().
   *
   * @param token FCM registration token (chuỗi dài từ Firebase SDK)
   * @param platform Nền tảng thiết bị — hiện tại chỉ hỗ trợ "web"
   */
  async registerDeviceToken(token: string, platform: "web" = "web"): Promise<void> {
    await apiClient.post<ApiResponse>("/calls/device-tokens", { token, platform });
  },

  /**
   * Xóa FCM device token khỏi backend khi logout.
   * Ngăn server gửi push notification vào token đã revoke.
   *
   * @param token FCM token cần xóa
   */
  async removeDeviceToken(token: string): Promise<void> {
    await apiClient.delete<ApiResponse>("/calls/device-tokens", { data: { token } });
  },

  // ===== CALL HISTORY =====

  /**
   * Lấy danh sách lịch sử cuộc gọi của người dùng có phân trang
   * @param params Tham số phân trang (page, limit)
   */
  async getCallHistory(params?: {
    page?: number;
    limit?: number;
  }): Promise<CallHistoryItem[]> {
    const response = await apiClient.get<ApiResponse<CallHistoryItem[]>>(
      "/calls",
      { params }
    );
    return response.data?.data || [];
  },

  /**
   * Lấy tổng số lượng cuộc gọi nhỡ chưa xử lý
   */
  async getMissedCount(): Promise<number> {
    const response = await apiClient.get<ApiResponse<{ count: number }>>(
      "/calls/missed-count"
    );
    return response.data?.data?.count ?? 0;
  },
};
