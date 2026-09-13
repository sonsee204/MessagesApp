import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { generateAccessToken } from "../src/utils/auth";
import { notificationService } from "../src/services/notification.service";
import { userRepository } from "../src/repositories/user.repository";

describe("Notification API Integration Tests (/api/notifications)", () => {
  const app = createApp();
  const userId = "507f1f77bcf86cd799439011";
  const validNotifId = "607f1f77bcf86cd799439012";
  let token: string;

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(userRepository, "findById").mockImplementation(async (id: string) => {
      return {
        _id: id,
        id,
        username: `user_${id}`,
        email: `user_${id}@example.com`,
      } as any;
    });

    token = generateAccessToken({
      userId,
      username: "testuser",
      email: "testuser@example.com",
    });
  });

  describe("Authentication Guard", () => {
    it("GET /api/notifications trả về 401 UNAUTHORIZED khi chưa đăng nhập", async () => {
      const res = await request(app).get("/api/notifications");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("PATCH /api/notifications/:id/read trả về 401 UNAUTHORIZED khi chưa đăng nhập", async () => {
      const res = await request(app).patch(`/api/notifications/${validNotifId}/read`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("PATCH /api/notifications/read-all trả về 401 UNAUTHORIZED khi chưa đăng nhập", async () => {
      const res = await request(app).patch("/api/notifications/read-all");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("DELETE /api/notifications/:id trả về 401 UNAUTHORIZED khi chưa đăng nhập", async () => {
      const res = await request(app).delete(`/api/notifications/${validNotifId}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Validation Errors", () => {
    it("GET /api/notifications trả về 400 VALIDATION_ERROR nếu limit vượt quá 50", async () => {
      const res = await request(app)
        .get("/api/notifications?limit=51")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("PATCH /api/notifications/:id/read trả về 400 VALIDATION_ERROR nếu id sai định dạng", async () => {
      const res = await request(app)
        .patch("/api/notifications/invalid-id/read")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("DELETE /api/notifications/:id trả về 400 VALIDATION_ERROR nếu id sai định dạng", async () => {
      const res = await request(app)
        .delete("/api/notifications/invalid-id")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Notification Operations", () => {
    it("GET /api/notifications trả về 200 OK và danh sách thông báo phân trang", async () => {
      vi.spyOn(notificationService, "getUserNotifications").mockResolvedValueOnce({
        notifications: [
          {
            _id: validNotifId,
            type: "FRIEND_REQUEST_RECEIVED",
            title: "Lời mời kết bạn",
            content: "Ai đó đã gửi lời mời",
            isRead: false,
          } as any,
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
        unreadCount: 1,
      });

      const res = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.unreadCount).toBe(1);
    });

    it("PATCH /api/notifications/:id/read trả về 200 OK và trạng thái đã đọc", async () => {
      vi.spyOn(notificationService, "markNotificationAsRead").mockResolvedValueOnce({
        _id: validNotifId,
        isRead: true,
        readAt: new Date("2026-09-13T10:00:00.000Z"),
      } as any);

      const res = await request(app)
        .patch(`/api/notifications/${validNotifId}/read`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(validNotifId);
      expect(res.body.data.isRead).toBe(true);
    });

    it("PATCH /api/notifications/read-all trả về 200 OK và số lượng đã đọc", async () => {
      vi.spyOn(notificationService, "markAllNotificationsAsRead").mockResolvedValueOnce({
        updatedCount: 3,
      });

      const res = await request(app)
        .patch("/api/notifications/read-all")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.updatedCount).toBe(3);
    });

    it("DELETE /api/notifications/:id trả về 200 OK và xóa thành công", async () => {
      vi.spyOn(notificationService, "deleteNotification").mockResolvedValueOnce(true);

      const res = await request(app)
        .delete(`/api/notifications/${validNotifId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Đã xóa thông báo thành công.");
    });
  });
});
