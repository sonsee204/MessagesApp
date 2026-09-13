import axios from "axios";
import { apiClient } from "../../../lib/axios";
import { ApiResponse } from "../../../types/auth.types";
import { formatApiError } from "../../../lib/error-formatter";
import {
  FriendItem,
  FriendRequestItem,
  BlockedUserItem,
  PaginatedData,
  FriendQueryOptions,
  PaginationOptions,
  RelationshipStatus,
  RelationshipStatusResponse,
} from "../types/friend.types";

/**
 * REST API Client phục vụ tương tác toàn diện với Subsystem Bạn bè
 */
export const friendService = {
  /**
   * Lấy danh sách bạn bè với các bộ lọc tìm kiếm, trạng thái online và phân trang
   * @param options Tùy chọn tìm kiếm và phân trang
   * @returns Danh sách bạn bè kèm thông tin phân trang
   */
  async getFriends(options?: FriendQueryOptions): Promise<PaginatedData<FriendItem>> {
    try {
      const params: Record<string, unknown> = {};
      if (options?.page) params.page = options.page;
      if (options?.limit) params.limit = options.limit;
      if (options?.q) params.search = options.q;
      if (options?.online !== undefined) params.onlineOnly = options.online;

      const response = await apiClient.get<ApiResponse<PaginatedData<FriendItem>>>("/friends", {
        params,
      });

      return (
        response.data.data || {
          items: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        }
      );
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tải danh sách bạn bè."));
    }
  },

  /**
   * Lấy danh sách lời mời kết bạn nhận được đang chờ phản hồi
   * @param options Tùy chọn phân trang
   * @returns Danh sách lời mời nhận được kèm phân trang
   */
  async getReceivedRequests(options?: PaginationOptions): Promise<PaginatedData<FriendRequestItem>> {
    try {
      const response = await apiClient.get<ApiResponse<PaginatedData<FriendRequestItem>>>(
        "/friends/requests/received",
        { params: options }
      );

      return (
        response.data.data || {
          items: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        }
      );
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tải danh sách lời mời kết bạn nhận được."));
    }
  },

  /**
   * Lấy danh sách lời mời kết bạn đã gửi đi đang chờ đối phương duyệt
   * @param options Tùy chọn phân trang
   * @returns Danh sách lời mời đã gửi kèm phân trang
   */
  async getSentRequests(options?: PaginationOptions): Promise<PaginatedData<FriendRequestItem>> {
    try {
      const response = await apiClient.get<ApiResponse<PaginatedData<FriendRequestItem>>>(
        "/friends/requests/sent",
        { params: options }
      );

      return (
        response.data.data || {
          items: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        }
      );
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tải danh sách lời mời kết bạn đã gửi."));
    }
  },

  /**
   * Lấy danh sách người dùng bị chặn bởi tài khoản hiện tại
   * @param options Tùy chọn phân trang
   * @returns Danh sách người dùng bị chặn kèm phân trang
   */
  async getBlockedUsers(options?: PaginationOptions): Promise<PaginatedData<BlockedUserItem>> {
    try {
      const response = await apiClient.get<ApiResponse<PaginatedData<BlockedUserItem>>>(
        "/friends/blocks",
        { params: options }
      );

      return (
        response.data.data || {
          items: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        }
      );
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tải danh sách người dùng bị chặn."));
    }
  },

  /**
   * Lấy thông tin trạng thái quan hệ 2 chiều chi tiết kèm requestId nếu có
   * Chỉ mã lỗi 404 (chưa từng có quan hệ) mới được hạ cấp thành "NONE".
   * Mọi lỗi khác (401 hết hạn token, 403, 5xx, lỗi mạng) đều được NÉM RA để
   * caller hiển thị trạng thái lỗi thay vì hiển thị nhầm nút "Thêm Bạn" cho một người đã là bạn.
   * @param targetUserId ID của người dùng cần tra cứu
   * @throws Error khi Backend phản hồi lỗi khác 404 hoặc không thể kết nối
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
          blockedByMe: false,
        }
      );
    } catch (error) {
      // Chỉ 404 mới coi như "chưa có quan hệ"; các lỗi còn lại ném lên cho caller xử lý
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { targetUserId, status: "NONE", blockedByMe: false };
      }
      throw new Error(
        formatApiError(error, "Không thể tải trạng thái quan hệ bạn bè.")
      );
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
