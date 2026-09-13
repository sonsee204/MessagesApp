import { Types } from "mongoose";
import {
  NotificationModel,
  INotification,
  NotificationType,
  INotificationData,
} from "../models/notification.model";

/**
 * Tham số đầu vào khi tạo một thông báo mới
 */
export interface CreateNotificationDTO {
  recipientId: string | Types.ObjectId;
  senderId?: string | Types.ObjectId | null;
  type: NotificationType;
  title: string;
  content: string;
  data?: INotificationData;
}

/**
 * Tùy chọn phân trang khi lấy danh sách thông báo
 */
export interface NotificationPaginationOptions {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

/**
 * Lớp truy xuất cơ sở dữ liệu cho thông báo (NotificationRepository)
 */
export class NotificationRepository {
  /**
   * Tạo mới một bản ghi thông báo
   * @param data Dữ liệu tạo thông báo
   * @returns Tài liệu thông báo vừa tạo
   */
  async create(data: CreateNotificationDTO): Promise<INotification> {
    const doc = new NotificationModel({
      recipientId: new Types.ObjectId(data.recipientId),
      senderId: data.senderId ? new Types.ObjectId(data.senderId) : null,
      type: data.type,
      title: data.title,
      content: data.content,
      data: data.data,
    });
    return await doc.save();
  }

  /**
   * Tìm kiếm thông báo theo ID
   * @param id ID của thông báo
   * @returns Bản ghi thông báo hoặc null
   */
  async findById(id: string | Types.ObjectId): Promise<INotification | null> {
    return await NotificationModel.findById(id).populate(
      "senderId",
      "displayName username avatarUrl"
    );
  }

  /**
   * Lấy danh sách thông báo của người nhận có phân trang
   * @param recipientId ID người nhận
   * @param options Tùy chọn phân trang và bộ lọc
   */
  async findByRecipientIdPaginated(
    recipientId: string | Types.ObjectId,
    options: NotificationPaginationOptions
  ): Promise<{ notifications: INotification[]; total: number }> {
    const { page, limit, unreadOnly = false } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      recipientId: new Types.ObjectId(recipientId),
    };
    if (unreadOnly) {
      filter.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("senderId", "displayName username avatarUrl")
        .exec(),
      NotificationModel.countDocuments(filter),
    ]);

    return { notifications, total };
  }

  /**
   * Đếm số lượng thông báo chưa đọc của người dùng
   * @param recipientId ID người nhận
   * @returns Số lượng thông báo chưa đọc
   */
  async countUnreadByRecipientId(recipientId: string | Types.ObjectId): Promise<number> {
    return await NotificationModel.countDocuments({
      recipientId: new Types.ObjectId(recipientId),
      isRead: false,
    });
  }

  /**
   * Đánh dấu một thông báo là đã đọc
   * @param id ID thông báo
   * @returns Bản ghi sau khi cập nhật
   */
  async markAsRead(id: string | Types.ObjectId): Promise<INotification | null> {
    return await NotificationModel.findByIdAndUpdate(
      id,
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true }
    ).populate("senderId", "displayName username avatarUrl");
  }

  /**
   * Đánh dấu tất cả thông báo chưa đọc của một người nhận thành đã đọc
   * @param recipientId ID người nhận
   * @returns Số lượng bản ghi đã được cập nhật
   */
  async markAllAsRead(recipientId: string | Types.ObjectId): Promise<number> {
    const result = await NotificationModel.updateMany(
      {
        recipientId: new Types.ObjectId(recipientId),
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );
    return result.modifiedCount;
  }

  /**
   * Xóa một thông báo theo ID
   * @param id ID thông báo cần xóa
   * @returns boolean cho biết xóa thành công hay không
   */
  async deleteById(id: string | Types.ObjectId): Promise<boolean> {
    const result = await NotificationModel.findByIdAndDelete(id);
    return Boolean(result);
  }
}
