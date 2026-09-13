import { Request, Response, NextFunction } from "express";
import {
  NotificationService,
  notificationService,
} from "../services/notification.service";
import {
  GetNotificationsQueryInput,
  NotificationIdParamInput,
} from "../schemas/notification.schema";

/**
 * Controller tiếp nhận và xử lý các yêu cầu HTTP liên quan đến thông báo (Notification Controller)
 * Tuân thủ kiến trúc phân tầng: chỉ xử lý HTTP request/response và chuyển tiếp vào Service Layer.
 */
export class NotificationController {
  constructor(
    private readonly service: NotificationService = notificationService
  ) {}

  /**
   * GET /api/notifications
   * Lấy danh sách thông báo của người dùng có phân trang và bộ lọc chưa đọc
   * - Query: { page?: number, limit?: number, unreadOnly?: boolean }
   * - Phản hồi: 200 OK kèm danh sách thông báo, thông tin phân trang và số lượng chưa đọc
   */
  getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { page, limit, unreadOnly } =
        req.query as unknown as GetNotificationsQueryInput;

      const result = await this.service.getUserNotifications(userId, {
        page,
        limit,
        unreadOnly,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/notifications/:id/read
   * Đánh dấu một thông báo cụ thể là đã đọc
   * - Params: { id: string }
   * - Phản hồi: 200 OK kèm trạng thái sau khi cập nhật
   */
  markAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params as unknown as NotificationIdParamInput;

      const updated = await this.service.markNotificationAsRead(userId, id);

      res.status(200).json({
        success: true,
        data: {
          id: updated._id,
          isRead: updated.isRead,
          readAt: updated.readAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/notifications/read-all
   * Đánh dấu tất cả thông báo chưa đọc của người dùng thành đã đọc
   * - Phản hồi: 200 OK kèm số lượng thông báo được cập nhật
   */
  markAllAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const result = await this.service.markAllNotificationsAsRead(userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/notifications/:id
   * Xóa vĩnh viễn một thông báo khỏi danh sách
   * - Params: { id: string }
   * - Phản hồi: 200 OK kèm thông điệp xác nhận
   */
  deleteNotification = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params as unknown as NotificationIdParamInput;

      await this.service.deleteNotification(userId, id);

      res.status(200).json({
        success: true,
        message: "Đã xóa thông báo thành công.",
      });
    } catch (error) {
      next(error);
    }
  };
}

/** Thể hiện Singleton mặc định của NotificationController */
export const notificationController = new NotificationController();
