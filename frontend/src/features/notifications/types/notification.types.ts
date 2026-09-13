/**
 * Các loại thông báo được hỗ trợ trong hệ thống
 */
export type NotificationType =
  | "FRIEND_REQUEST_RECEIVED"
  | "FRIEND_REQUEST_ACCEPTED"
  | "MESSAGE_MENTION"
  | "SYSTEM_ALERT";

/**
 * Thông tin người gửi đính kèm trong thông báo
 */
export interface NotificationSender {
  _id: string;
  displayName?: string;
  username: string;
  avatarUrl?: string | null;
}

/**
 * Cấu trúc dữ liệu chi tiết của một bản ghi thông báo
 */
export interface NotificationItem {
  _id: string;
  recipientId: string;
  senderId?: NotificationSender | null;
  type: NotificationType;
  title: string;
  content: string;
  data?: {
    friendRequestId?: string;
    conversationId?: string;
    messageId?: string;
    [key: string]: unknown;
  };
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dữ liệu phân trang danh sách thông báo
 */
export interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Định dạng phản hồi khi lấy danh sách thông báo từ API
 */
export interface NotificationsResponse {
  notifications: NotificationItem[];
  pagination: NotificationPagination;
  unreadCount: number;
}

/**
 * Bộ lọc hiển thị thông báo trên giao diện
 */
export type NotificationFilter = "all" | "unread";
