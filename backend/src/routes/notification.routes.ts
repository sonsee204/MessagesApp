import { Router } from "express";
import { notificationController } from "../controllers/notification.controller";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import {
  GetNotificationsQuerySchema,
  NotificationIdParamSchema,
} from "../schemas/notification.schema";

/**
 * Router định tuyến các API liên quan đến Hệ thống Thông báo (Notification APIs)
 * Base Path: /api/notifications
 */
const router = Router();

// Yêu cầu xác thực JWT (AccessToken) trên toàn bộ endpoints thông báo
router.use(requireAuth);

// 1. Lấy danh sách thông báo phân trang và lọc theo trạng thái chưa đọc
router.get(
  "/",
  validate(GetNotificationsQuerySchema),
  notificationController.getNotifications
);

// 2. Đánh dấu tất cả thông báo là đã đọc (đặt trước :id để tránh xung đột params)
router.patch("/read-all", notificationController.markAllAsRead);

// 3. Đánh dấu một thông báo cụ thể là đã đọc
router.patch(
  "/:id/read",
  validate(NotificationIdParamSchema),
  notificationController.markAsRead
);

// 4. Xóa vĩnh viễn một thông báo
router.delete(
  "/:id",
  validate(NotificationIdParamSchema),
  notificationController.deleteNotification
);

export const notificationRoutes = router;
