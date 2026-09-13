import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { NotificationModel } from "../../src/models/notification.model";

describe("NotificationModel Schema & Validation Unit Tests", () => {
  it("khởi tạo thành công với các trường bắt buộc và giá trị mặc định", () => {
    const recipientId = new Types.ObjectId();
    const senderId = new Types.ObjectId();

    const notif = new NotificationModel({
      recipientId,
      senderId,
      type: "FRIEND_REQUEST_RECEIVED",
      title: "Lời mời kết bạn mới",
      content: "nguyenvana đã gửi lời mời kết bạn cho bạn.",
      data: {
        friendRequestId: "507f1f77bcf86cd799439011",
      },
    });

    const error = notif.validateSync();
    expect(error).toBeUndefined();
    expect(notif.isRead).toBe(false);
    expect(notif.readAt).toBeNull();
    expect(notif.type).toBe("FRIEND_REQUEST_RECEIVED");
  });

  it("thất bại khi thiếu trường recipientId", () => {
    const notif = new NotificationModel({
      type: "SYSTEM_ALERT",
      title: "Bảo trì hệ thống",
      content: "Hệ thống sẽ bảo trì trong 15 phút.",
    });

    const error = notif.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors.recipientId).toBeDefined();
  });

  it("thất bại khi type không thuộc enum NotificationType", () => {
    const notif = new NotificationModel({
      recipientId: new Types.ObjectId(),
      type: "INVALID_TYPE_XYZ",
      title: "Tiêu đề",
      content: "Nội dung",
    });

    const error = notif.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors.type).toBeDefined();
  });

  it("thất bại khi title vượt quá 100 ký tự", () => {
    const notif = new NotificationModel({
      recipientId: new Types.ObjectId(),
      type: "SYSTEM_ALERT",
      title: "a".repeat(101),
      content: "Nội dung",
    });

    const error = notif.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors.title).toBeDefined();
  });

  it("thất bại khi content vượt quá 500 ký tự", () => {
    const notif = new NotificationModel({
      recipientId: new Types.ObjectId(),
      type: "SYSTEM_ALERT",
      title: "Tiêu đề",
      content: "a".repeat(501),
    });

    const error = notif.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors.content).toBeDefined();
  });
});
