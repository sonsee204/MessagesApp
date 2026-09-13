import { User } from "./auth.types";

/**
 * Loại tin nhắn trong hệ thống
 */
export type MessageType = "TEXT" | "IMAGE" | "FILE" | "SYSTEM";

/**
 * Loại cuộc trò chuyện (Trực tiếp 1-1 hoặc Nhóm)
 */
export type ConversationType = "DIRECT" | "GROUP";

/**
 * Cấu trúc dữ liệu Tin nhắn (Message)
 * Đồng bộ với Mongoose Message Model từ Backend
 */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: User;
  content: string;
  type: MessageType;
  readBy: string[];
  // Tin nhắn đã bị thu hồi (soft delete) — nội dung vẫn còn trong CSDL nhưng không được hiển thị
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Cấu trúc dữ liệu Cuộc trò chuyện (Conversation)
 * Đồng bộ với Mongoose Conversation Model từ Backend
 */
export interface Conversation {
  id: string;
  title?: string | null;
  type: ConversationType;
  participants: User[];
  lastMessage?: Message | null;
  lastMessageAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
}

/**
 * Dữ liệu yêu cầu tạo cuộc trò chuyện mới
 */
export interface CreateConversationPayload {
  type: ConversationType;
  participantIds: string[];
  title?: string;
}

/**
 * Dữ liệu yêu cầu gửi tin nhắn
 */
export interface SendMessagePayload {
  content: string;
  type?: MessageType;
}

/**
 * Dữ liệu phân trang lịch sử tin nhắn (Cursor-based Pagination)
 * nextCursor cho phép undefined vì chat.service đã chuẩn hóa `null` từ Backend thành undefined
 */
export interface MessagesPagination {
  nextCursor?: string | null;
  hasMore: boolean;
}

/**
 * Sự kiện người dùng đang nhập tin nhắn qua Socket.IO (Typing Indicator)
 */
export interface TypingEventPayload {
  conversationId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

/**
 * Sự kiện cập nhật trạng thái trực tuyến của người dùng qua Socket.IO
 */
export interface UserStatusEventPayload {
  userId: string;
  isOnline: boolean;
}

/**
 * Sự kiện một tin nhắn đã bị thu hồi (Server phát tới room của cuộc trò chuyện)
 */
export interface MessageRecalledEventPayload {
  messageId: string;
  conversationId: string;
}

/**
 * Sự kiện một thành viên đã đọc toàn bộ tin nhắn trong cuộc trò chuyện
 */
export interface MessagesReadEventPayload {
  conversationId: string;
  userId: string;
  readAt: string;
}
