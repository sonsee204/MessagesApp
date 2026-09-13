import { apiClient } from "../../../lib/axios";
import { ApiResponse } from "../../../types/auth.types";
import { formatApiError } from "../../../lib/error-formatter";

/**
 * Các trạng thái quan hệ bạn bè 2 chiều giữa hai người dùng
 * - NONE: Chưa có kết nối bạn bè
 * - BLOCKED: Một trong hai người đã chặn người kia
 * - FRIENDS: Đã là bạn bè chính thức
 * - PENDING_SENT: Người dùng hiện tại đã gửi lời mời và đang chờ đối phương đồng ý
 * - PENDING_RECEIVED: Đối phương đã gửi lời mời kết bạn cho người dùng hiện tại
 */
export type RelationshipStatus =
  | "NONE"
  | "BLOCKED"
  | "FRIENDS"
  | "PENDING_SENT"
  | "PENDING_RECEIVED";

export interface RelationshipStatusResponse {
  targetUserId: string;
  status: RelationshipStatus;
  requestId?: string;
}

/**
 * Dịch vụ REST API quản lý tương tác và quan hệ Bạn bè (Friend Service)
 */
export const friendService = {
  /**
   * Lấy thông tin trạng thái quan hệ 2 chiều chi tiết kèm requestId nếu có
   * @param targetUserId ID của người dùng cần tra cứu
   */
  async getRelationshipInfo(targetUserId: string): Promise<RelationshipStatusResponse> {
    try {
      const response = await apiClient.get<ApiResponse<RelationshipStatusResponse>>(
        `/friends/status/${targetUserId}`
      );
      return (
        response.data.data || {
          targetUserId,
          status: "NONE",
        }
      );
    } catch {
      return { targetUserId, status: "NONE" };
    }
  },

  /**
   * Lấy trạng thái quan hệ 2 chiều giữa tài khoản hiện tại và người dùng mục tiêu
   * @param targetUserId ID của người dùng cần tra cứu trạng thái
   * @returns Trạng thái quan hệ (RelationshipStatus)
   */
  async getRelationshipStatus(targetUserId: string): Promise<RelationshipStatus> {
    const info = await this.getRelationshipInfo(targetUserId);
    return info.status;
  },

  /**
   * Gửi lời mời kết bạn tới người dùng mục tiêu
   * @param receiverId ID của người nhận lời mời kết bạn
   * @param note Lời nhắn kèm theo lời mời
   */
  async sendFriendRequest(receiverId: string, note?: string): Promise<void> {
    try {
      await apiClient.post<ApiResponse<unknown>>("/friends/requests", {
        receiverId,
        note,
      });
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể gửi lời mời kết bạn."));
    }
  },

  /**
   * Chấp nhận lời mời kết bạn nhận được từ người dùng khác
   * @param requestId ID của lời mời kết bạn
   */
  async acceptFriendRequest(requestId: string): Promise<void> {
    try {
      await apiClient.post<ApiResponse<unknown>>(`/friends/requests/${requestId}/accept`);
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể chấp nhận lời mời kết bạn."));
    }
  },

  /**
   * Từ chối lời mời kết bạn nhận được
   * @param requestId ID của lời mời kết bạn
   */
  async rejectFriendRequest(requestId: string): Promise<void> {
    try {
      await apiClient.post<ApiResponse<unknown>>(`/friends/requests/${requestId}/reject`);
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể từ chối lời mời kết bạn."));
    }
  },

  /**
   * Hủy lời mời kết bạn đã gửi đi
   * @param requestId ID của lời mời kết bạn đã gửi
   */
  async cancelFriendRequest(requestId: string): Promise<void> {
    try {
      await apiClient.delete<ApiResponse<unknown>>(`/friends/requests/${requestId}/cancel`);
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể hủy lời mời kết bạn."));
    }
  },

  /**
   * Chặn một người dùng (hủy bạn bè và lời mời kết bạn)
   * @param targetUserId ID người dùng cần chặn
   */
  async blockUser(targetUserId: string): Promise<void> {
    try {
      await apiClient.post<ApiResponse<unknown>>(`/friends/blocks/${targetUserId}`);
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể chặn người dùng."));
    }
  },

  /**
   * Bỏ chặn người dùng
   * @param targetUserId ID người dùng cần bỏ chặn
   */
  async unblockUser(targetUserId: string): Promise<void> {
    try {
      await apiClient.delete<ApiResponse<unknown>>(`/friends/blocks/${targetUserId}`);
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể bỏ chặn người dùng."));
    }
  },

  /**
   * Hủy kết bạn với một người dùng
   * @param targetUserId ID người bạn cần hủy kết bạn
   */
  async removeFriend(targetUserId: string): Promise<void> {
    try {
      await apiClient.delete<ApiResponse<unknown>>(`/friends/${targetUserId}`);
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể hủy kết bạn."));
    }
  },
};
