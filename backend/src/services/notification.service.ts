import {
  NotificationRepository,
  CreateNotificationDTO,
  NotificationPaginationOptions,
} from "../repositories/notification.repository";
import { INotification } from "../models/notification.model";
import { NotFoundError } from "../core/errors";
import { emitToUser } from "../socket";
import { logger } from "../core/logger";

/**
 * Interface cho NotificationService
 */
export interface INotificationService {
  createNotification(data: CreateNotificationDTO): Promise<INotification>;
  getUserNotifications(
    userId: string,
    options: NotificationPaginationOptions
  ): Promise<{
    notifications: INotification[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    unreadCount: number;
  }>;
  markNotificationAsRead(userId: string, notificationId: string): Promise<INotification>;
  markAllNotificationsAsRead(userId: string): Promise<{ updatedCount: number }>;
  deleteNotification(userId: string, notificationId: string): Promise<boolean>;
}

/**
 * Service xử lý toàn bộ logic nghiệp vụ thông báo (Notification Service Layer)
 * Đảm bảo Zero-Trust Validation quyền sở hữu (`recipientId`), tính toàn vẹn dữ liệu
 * và phát sự kiện thời gian thực Socket.IO tới đúng kênh cá nhân của người nhận.
 */
export class NotificationService implements INotificationService {
  constructor(
    private readonly notifRepo: NotificationRepository = new NotificationRepository()
  ) {}

  /**
   * Tạo một thông báo mới và phát sự kiện Socket.IO thời gian thực
   * @param data Dữ liệu tạo thông báo
   * @returns Thông báo vừa tạo kèm dữ liệu người gửi (nếu có)
   */
  async createNotification(data: CreateNotificationDTO): Promise<INotification> {
    // Bước 1: Lưu thông báo vào cơ sở dữ liệu
    const created = await this.notifRepo.create(data);

    // Bước 2: Lấy bản ghi đầy đủ thông tin người gửi đã populate
    const populated = await this.notifRepo.findById(created._id.toString());
    const finalNotif = populated || created;

    // Bước 3: Phát sự kiện Socket.IO thời gian thực tới phòng cá nhân người nhận
    const recipientIdStr = data.recipientId.toString();
    try {
      emitToUser(recipientIdStr, "notification:new", finalNotif);
    } catch (error) {
      logger.error(`Lỗi khi phát socket notification:new tới user:${recipientIdStr}`, error);
    }

    return finalNotif;
  }

  /**
   * Lấy danh sách thông báo phân trang của người dùng hiện tại kèm số lượng chưa đọc
   * @param userId ID người dùng
   * @param options Tùy chọn phân trang và bộ lọc
   */
  async getUserNotifications(
    userId: string,
    options: NotificationPaginationOptions
  ): Promise<{
    notifications: INotification[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    unreadCount: number;
  }> {
    // Truy vấn song song danh sách thông báo và số lượng chưa đọc để tối ưu hiệu năng
    const [{ notifications, total }, unreadCount] = await Promise.all([
      this.notifRepo.findByRecipientIdPaginated(userId, options),
      this.notifRepo.countUnreadByRecipientId(userId),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / options.limit);

    return {
      notifications,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages,
      },
      unreadCount,
    };
  }

  /**
   * Đánh dấu một thông báo cụ thể là đã đọc
   * Kiểm tra nghiêm ngặt quyền sở hữu: chỉ người nhận mới có quyền sửa trạng thái thông báo
   * @param userId ID người dùng thực hiện
   * @param notificationId ID thông báo cần đánh dấu
   */
  async markNotificationAsRead(userId: string, notificationId: string): Promise<INotification> {
    // Bước 1: Kiểm tra thông báo có tồn tại hay không
    const existing = await this.notifRepo.findById(notificationId);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy thông báo");
    }

    // Bước 2: Zero-Trust Security - kiểm tra quyền sở hữu của thông báo
    const recipientId =
      (existing.recipientId as { _id?: unknown; toString(): string })._id?.toString() ||
      existing.recipientId.toString();

    if (recipientId !== userId) {
      throw new NotFoundError("Không tìm thấy thông báo");
    }

    // Bước 3: Cập nhật trạng thái đã đọc
    const updated = await this.notifRepo.markAsRead(notificationId);
    if (!updated) {
      throw new NotFoundError("Không tìm thấy thông báo");
    }

    // Bước 4: Phát sự kiện Socket.IO để đồng bộ đa thiết bị (sync unread badge)
    try {
      emitToUser(userId, "notification:read", { notificationId });
    } catch (error) {
      logger.error(`Lỗi khi phát socket notification:read tới user:${userId}`, error);
    }

    return updated;
  }

  /**
   * Đánh dấu tất cả thông báo chưa đọc của người dùng thành đã đọc
   * @param userId ID người dùng
   * @returns Số lượng bản ghi đã cập nhật
   */
  async markAllNotificationsAsRead(userId: string): Promise<{ updatedCount: number }> {
    const updatedCount = await this.notifRepo.markAllAsRead(userId);

    // Phát sự kiện Socket.IO đồng bộ toàn bộ trạng thái đã đọc
    try {
      emitToUser(userId, "notification:read", { all: true });
    } catch (error) {
      logger.error(`Lỗi khi phát socket notification:read all tới user:${userId}`, error);
    }

    return { updatedCount };
  }

  /**
   * Xóa vĩnh viễn một thông báo
   * @param userId ID người dùng thực hiện
   * @param notificationId ID thông báo cần xóa
   */
  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    // Bước 1: Kiểm tra thông báo có tồn tại hay không
    const existing = await this.notifRepo.findById(notificationId);
    if (!existing) {
      throw new NotFoundError("Không tìm thấy thông báo");
    }

    // Bước 2: Zero-Trust Security - kiểm tra quyền sở hữu
    const recipientId =
      (existing.recipientId as { _id?: unknown; toString(): string })._id?.toString() ||
      existing.recipientId.toString();

    if (recipientId !== userId) {
      throw new NotFoundError("Không tìm thấy thông báo");
    }

    // Bước 3: Xóa khỏi CSDL
    return await this.notifRepo.deleteById(notificationId);
  }
}

/** Thể hiện Singleton mặc định của NotificationService */
export const notificationService = new NotificationService();
