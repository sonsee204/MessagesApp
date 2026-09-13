import { apiClient } from "../../../lib/axios";
import {
  Conversation,
  Message,
  CreateConversationPayload,
  SendMessagePayload,
  MessagesPagination,
} from "../../../types/chat.types";
import { ApiResponse } from "../../../types/auth.types";
import { formatApiError } from "../../../lib/error-formatter";

/**
 * Kiểu dữ liệu phản hồi thô của API lịch sử tin nhắn từ Backend.
 * Lưu ý: Backend đặt mảng tin nhắn ở `data` còn metadata phân trang ở `pagination` (cùng cấp),
 * khác với các API danh sách khác gộp chung vào `data`.
 */
interface GetMessagesApiResponse {
  success: boolean;
  data: Message[];
  pagination: {
    // Backend trả về null khi đã hết tin nhắn, không phải undefined
    nextCursor: string | null;
    hasMore: boolean;
  };
  error?: { code: string; message: string; details?: unknown[] };
}

/**
 * Kiểu dữ liệu phản hồi danh sách tin nhắn kèm phân trang con trỏ (Cursor-based)
 * dùng thống nhất trong toàn bộ tầng UI/Store của Frontend.
 */
export interface MessagesResponseData extends MessagesPagination {
  messages: Message[];
}

/**
 * Dịch vụ REST API quản lý Cuộc trò chuyện và Tin nhắn (Chat Service)
 * Kết nối các API endpoints trên máy chủ Backend thông qua Axios Client:
 * 1. GET /api/conversations - Lấy danh sách cuộc trò chuyện
 * 2. POST /api/conversations - Khởi tạo cuộc trò chuyện mới (1-1 hoặc Nhóm)
 * 3. GET /api/conversations/:id/messages - Lấy lịch sử tin nhắn phân trang
 * 4. POST /api/conversations/:id/messages - Gửi tin nhắn mới vào cuộc trò chuyện
 */
export const chatService = {
  /**
   * Lấy toàn bộ danh sách cuộc trò chuyện của người dùng hiện tại
   * Backend tự động populate danh sách thành viên và tin nhắn mới nhất
   * @returns Danh sách các cuộc trò chuyện (Conversation[])
   */
  async getConversations(): Promise<Conversation[]> {
    try {
      const response = await apiClient.get<ApiResponse<Conversation[]>>("/conversations");
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Không thể tải danh sách cuộc trò chuyện");
      }
      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tải danh sách cuộc trò chuyện."));
    }
  },

  /**
   * Khởi tạo một cuộc trò chuyện mới (Trực tiếp 1-1 hoặc Nhóm)
   * @param payload Dữ liệu tạo hội thoại (loại, danh sách ID thành viên, tiêu đề nhóm)
   * @returns Thông tin cuộc trò chuyện vừa được tạo thành công
   */
  async createConversation(payload: CreateConversationPayload): Promise<Conversation> {
    try {
      const response = await apiClient.post<ApiResponse<Conversation>>("/conversations", payload);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Không thể tạo cuộc trò chuyện mới");
      }
      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tạo cuộc trò chuyện mới."));
    }
  },

  /**
   * Lấy lịch sử tin nhắn của một cuộc trò chuyện cụ thể với phân trang con trỏ (Cursor Pagination)
   * @param conversationId ID của cuộc trò chuyện cần lấy tin nhắn
   * @param cursor Con trỏ thời gian (ISO string của tin nhắn cũ nhất trong trang hiện tại)
   * @param limit Số lượng tin nhắn cần lấy cho mỗi trang (mặc định 20)
   * @returns Danh sách tin nhắn kèm con trỏ tiếp theo (nextCursor) và cờ hasMore
   */
  async getMessages(
    conversationId: string,
    cursor?: string,
    limit = 20
  ): Promise<MessagesResponseData> {
    try {
      const params = new URLSearchParams();
      if (cursor) {
        params.append("cursor", cursor);
      }
      if (limit) {
        params.append("limit", limit.toString());
      }

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const response = await apiClient.get<GetMessagesApiResponse>(
        `/conversations/${conversationId}/messages${queryString}`
      );

      if (!response.data.success || !Array.isArray(response.data.data)) {
        throw new Error(response.data.error?.message || "Không thể tải lịch sử tin nhắn");
      }

      // Ghép mảng tin nhắn ở `data` với metadata phân trang ở `pagination` thành shape thống nhất cho Store
      return {
        messages: response.data.data,
        nextCursor: response.data.pagination?.nextCursor ?? undefined,
        hasMore: Boolean(response.data.pagination?.hasMore),
      };
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tải lịch sử tin nhắn."));
    }
  },

  /**
   * Gửi tin nhắn mới vào cuộc trò chuyện qua REST API
   * Backend sẽ lưu tin nhắn vào MongoDB và tự động phát socket event 'new_message' đến room
   * @param conversationId ID của cuộc trò chuyện nhận tin nhắn
   * @param payload Nội dung tin nhắn và loại tin nhắn (TEXT, IMAGE, FILE...)
   * @returns Tin nhắn vừa được lưu thành công kèm thông tin người gửi
   */
  async sendMessage(
    conversationId: string,
    payload: SendMessagePayload
  ): Promise<Message> {
    try {
      const response = await apiClient.post<ApiResponse<Message>>(
        `/conversations/${conversationId}/messages`,
        payload
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Không thể gửi tin nhắn");
      }

      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể gửi tin nhắn. Vui lòng thử lại."));
    }
  },

  /**
   * Thu hồi tin nhắn do chính người dùng hiện tại gửi (Soft Delete)
   * @param conversationId ID cuộc trò chuyện chứa tin nhắn
   * @param messageId ID tin nhắn cần thu hồi
   * @returns Tin nhắn sau khi đã được đánh dấu thu hồi (isDeleted = true)
   */
  async recallMessage(conversationId: string, messageId: string): Promise<Message> {
    try {
      const response = await apiClient.delete<ApiResponse<Message>>(
        `/conversations/${conversationId}/messages/${messageId}`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Không thể thu hồi tin nhắn");
      }

      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể thu hồi tin nhắn."));
    }
  },

  /**
   * Đánh dấu toàn bộ tin nhắn trong cuộc trò chuyện là đã đọc cho người dùng hiện tại
   * Server cũng phát sự kiện `messages_read` để các thành viên khác cập nhật trạng thái
   * @param conversationId ID cuộc trò chuyện cần đánh dấu đã đọc
   */
  async markAsRead(conversationId: string): Promise<void> {
    try {
      await apiClient.post(`/conversations/${conversationId}/messages/read`);
    } catch (error) {
      // Không ném lỗi ra ngoài: đánh dấu đã đọc là thao tác phụ, không được làm hỏng luồng đọc tin
      console.warn("Không thể đánh dấu đã đọc:", formatApiError(error, "Lỗi không xác định"));
    }
  },
};
