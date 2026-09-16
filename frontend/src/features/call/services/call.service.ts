import { apiClient } from "../../../lib/axios";
import { ApiResponse } from "../../../types/auth.types";
import { CallHistoryItem } from "../types/call.types";

/**
 * Service giao tiếp REST API cho tính năng Cuộc gọi (Call Client Service)
 */
export const callService = {
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
