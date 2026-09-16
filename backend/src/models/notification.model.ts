import { Schema, model, Document, Types } from "mongoose";

/**
 * Các loại thông báo được hệ thống hỗ trợ:
 * - FRIEND_REQUEST_RECEIVED: Nhận lời mời kết bạn mới từ người dùng khác
 * - FRIEND_REQUEST_ACCEPTED: Lời mời kết bạn đã gửi được đối phương chấp nhận
 * - MESSAGE_MENTION: Được nhắc tên (@username) trong một tin nhắn cuộc trò chuyện
 * - SYSTEM_ALERT: Cảnh báo hoặc thông báo quan trọng từ quản trị viên/hệ thống
 * - CALL_MISSED: Thông báo cuộc gọi thoại hoặc video bị nhỡ
 */
export type NotificationType =
  | "FRIEND_REQUEST_RECEIVED"
  | "FRIEND_REQUEST_ACCEPTED"
  | "MESSAGE_MENTION"
  | "SYSTEM_ALERT"
  | "CALL_MISSED";

/**
 * Cấu trúc dữ liệu metadata đính kèm phục vụ điều hướng (Deep link)
 */
export interface INotificationData {
  conversationId?: string;
  messageId?: string;
  friendRequestId?: string;
  url?: string;
}

/**
 * Interface đại diện cho một tài liệu Thông báo trong CSDL MongoDB
 */
export interface INotification extends Document {
  recipientId: Types.ObjectId;
  senderId?: Types.ObjectId | null;
  type: NotificationType;
  title: string;
  content: string;
  data?: INotificationData;
  isRead: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose Schema định nghĩa cấu trúc bảng thông báo (notifications)
 */
const NotificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "ID người nhận thông báo là bắt buộc"],
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "FRIEND_REQUEST_RECEIVED",
        "FRIEND_REQUEST_ACCEPTED",
        "MESSAGE_MENTION",
        "SYSTEM_ALERT",
        "CALL_MISSED",
      ],
      required: [true, "Loại thông báo là bắt buộc"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Tiêu đề thông báo không được để trống"],
      trim: true,
      maxlength: [100, "Tiêu đề thông báo tối đa 100 ký tự"],
    },
    content: {
      type: String,
      required: [true, "Nội dung thông báo không được để trống"],
      trim: true,
      maxlength: [500, "Nội dung thông báo tối đa 500 ký tự"],
    },
    data: {
      conversationId: { type: String, default: null },
      messageId: { type: String, default: null },
      friendRequestId: { type: String, default: null },
      url: { type: String, default: null },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index: Tối ưu hóa truy vấn danh sách thông báo theo người nhận sắp xếp thời gian giảm dần
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

// Compound Index: Tối ưu hóa đếm số lượng thông báo chưa đọc theo người nhận
NotificationSchema.index({ recipientId: 1, isRead: 1 });

/**
 * Mongoose Model cho Notification
 */
export const NotificationModel = model<INotification>("Notification", NotificationSchema);
