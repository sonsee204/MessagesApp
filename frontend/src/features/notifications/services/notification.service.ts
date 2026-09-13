import { apiClient } from "../../../lib/axios";
import { ApiResponse } from "../../../types/auth.types";
import {
  NotificationsResponse,
  NotificationItem,
} from "../types/notification.types";

/**
 * Service giao tiếp REST API cho tính năng Thông báo (Notification Client Service)
 */
export const notificationService = {
  /**
   * Lấy danh sách thông báo phân trang của người dùng hiện tại
   * @param params Bộ lọc trang, số lượng và trạng thái chưa đọc
   */
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<NotificationsResponse> {
    const response = await apiClient.get<ApiResponse<NotificationsResponse>>(
      "/notifications",
      { params }
    );
    if (!response.data.data) {
      throw new Error("Dữ liệu thông báo trả về không hợp lệ");
    }
    return response.data.data;
  },

  /**
   * Đánh dấu một thông báo là đã đọc
   * @param id ID của thông báo
   */
  async markAsRead(id: string): Promise<Partial<NotificationItem>> {
    const response = await apiClient.patch<ApiResponse<Partial<NotificationItem>>>(
      `/notifications/${id}/read`
    );
    return response.data.data || {};
  },

  /**
   * Đánh dấu tất cả thông báo chưa đọc thành đã đọc
   */
  async markAllAsRead(): Promise<{ updatedCount: number }> {
    const response = await apiClient.patch<ApiResponse<{ updatedCount: number }>>(
      "/notifications/read-all"
    );
    return response.data.data || { updatedCount: 0 };
  },

  /**
   * Xóa vĩnh viễn một thông báo
   * @param id ID của thông báo cần xóa
   */
  async deleteNotification(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<{ message: string }>>(
      `/notifications/${id}`
    );
  },
};
