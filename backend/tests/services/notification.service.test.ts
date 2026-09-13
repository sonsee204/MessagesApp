import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationService } from "../../src/services/notification.service";
import * as socketModule from "../../src/socket";
import { NotFoundError } from "../../src/core/errors";

describe("NotificationService Unit Tests", () => {
  let service: NotificationService;
  let repoMock: any;
  let emitToUserSpy: any;

  beforeEach(() => {
    repoMock = {
      create: vi.fn(),
      findByRecipientIdPaginated: vi.fn(),
      countUnreadByRecipientId: vi.fn(),
      findById: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteById: vi.fn(),
    };
    emitToUserSpy = vi.spyOn(socketModule, "emitToUser").mockImplementation(() => {});
    service = new NotificationService(repoMock);
  });

  describe("createNotification", () => {
    it("tạo thông báo mới thành công và phát sự kiện socket notification:new", async () => {
      const createdNotif = {
        _id: "notif-123",
        recipientId: "user-recipient",
        type: "FRIEND_REQUEST_RECEIVED",
        title: "Lời mời kết bạn",
        content: "Bạn có lời mời kết bạn mới",
      };
      repoMock.create.mockResolvedValue(createdNotif);
      repoMock.findById.mockResolvedValue({
        ...createdNotif,
        senderId: { displayName: "Sender", avatarUrl: null },
      });

      const result = await service.createNotification({
        recipientId: "user-recipient",
        type: "FRIEND_REQUEST_RECEIVED",
        title: "Lời mời kết bạn",
        content: "Bạn có lời mời kết bạn mới",
      });

      expect(repoMock.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(emitToUserSpy).toHaveBeenCalledWith(
        "user-recipient",
        "notification:new",
        expect.objectContaining({ _id: "notif-123" })
      );
    });
  });

  describe("getUserNotifications", () => {
    it("lấy danh sách thông báo phân trang kèm unreadCount và tính toán totalPages", async () => {
      const mockNotifications = [{ _id: "notif-1" }, { _id: "notif-2" }];
      repoMock.findByRecipientIdPaginated.mockResolvedValue({
        notifications: mockNotifications,
        total: 25,
      });
      repoMock.countUnreadByRecipientId.mockResolvedValue(3);

      const result = await service.getUserNotifications("user-1", {
        page: 2,
        limit: 10,
        unreadOnly: false,
      });

      expect(repoMock.findByRecipientIdPaginated).toHaveBeenCalledWith("user-1", {
        page: 2,
        limit: 10,
        unreadOnly: false,
      });
      expect(repoMock.countUnreadByRecipientId).toHaveBeenCalledWith("user-1");
      expect(result.notifications).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
      expect(result.unreadCount).toBe(3);
    });
  });

  describe("markNotificationAsRead", () => {
    it("từ chối đánh dấu đã đọc nếu thông báo không tồn tại", async () => {
      repoMock.findById.mockResolvedValue(null);

      await expect(service.markNotificationAsRead("user-me", "notif-1")).rejects.toThrow(
        NotFoundError
      );
    });

    it("từ chối đánh dấu đã đọc nếu thông báo không thuộc về người dùng", async () => {
      repoMock.findById.mockResolvedValue({
        _id: "notif-1",
        recipientId: { toString: () => "user-other" },
        isRead: false,
      });

      await expect(service.markNotificationAsRead("user-me", "notif-1")).rejects.toThrow(
        NotFoundError
      );
    });

    it("đánh dấu đã đọc thành công và phát socket event notification:read", async () => {
      const updatedNotif = {
        _id: "notif-1",
        recipientId: { toString: () => "user-me" },
        isRead: true,
        readAt: new Date(),
      };
      repoMock.findById.mockResolvedValue({
        _id: "notif-1",
        recipientId: { toString: () => "user-me" },
        isRead: false,
      });
      repoMock.markAsRead.mockResolvedValue(updatedNotif);

      const result = await service.markNotificationAsRead("user-me", "notif-1");

      expect(repoMock.markAsRead).toHaveBeenCalledWith("notif-1");
      expect(result.isRead).toBe(true);
      expect(emitToUserSpy).toHaveBeenCalledWith("user-me", "notification:read", {
        notificationId: "notif-1",
      });
    });
  });

  describe("markAllNotificationsAsRead", () => {
    it("đánh dấu tất cả đã đọc và phát socket event notification:read với { all: true }", async () => {
      repoMock.markAllAsRead.mockResolvedValue(5);

      const result = await service.markAllNotificationsAsRead("user-me");

      expect(repoMock.markAllAsRead).toHaveBeenCalledWith("user-me");
      expect(result).toEqual({ updatedCount: 5 });
      expect(emitToUserSpy).toHaveBeenCalledWith("user-me", "notification:read", {
        all: true,
      });
    });
  });

  describe("deleteNotification", () => {
    it("từ chối xóa nếu thông báo không tồn tại", async () => {
      repoMock.findById.mockResolvedValue(null);

      await expect(service.deleteNotification("user-me", "notif-1")).rejects.toThrow(
        NotFoundError
      );
    });

    it("từ chối xóa nếu thông báo không thuộc về người dùng", async () => {
      repoMock.findById.mockResolvedValue({
        _id: "notif-1",
        recipientId: { toString: () => "user-other" },
      });

      await expect(service.deleteNotification("user-me", "notif-1")).rejects.toThrow(
        NotFoundError
      );
    });

    it("xóa thông báo thành công", async () => {
      repoMock.findById.mockResolvedValue({
        _id: "notif-1",
        recipientId: { toString: () => "user-me" },
      });
      repoMock.deleteById.mockResolvedValue(true);

      const result = await service.deleteNotification("user-me", "notif-1");

      expect(repoMock.deleteById).toHaveBeenCalledWith("notif-1");
      expect(result).toBe(true);
    });
  });
});
