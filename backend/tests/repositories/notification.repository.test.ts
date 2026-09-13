import { describe, it, expect, vi } from "vitest";
import { NotificationRepository } from "../../src/repositories/notification.repository";
import { NotificationModel } from "../../src/models/notification.model";

describe("NotificationRepository Unit Tests", () => {
  it("đếm chính xác số lượng thông báo chưa đọc của người dùng", async () => {
    const countSpy = vi.spyOn(NotificationModel, "countDocuments").mockResolvedValue(5 as any);
    const repo = new NotificationRepository();
    const count = await repo.countUnreadByRecipientId("507f1f77bcf86cd799439011");

    expect(count).toBe(5);
    expect(countSpy).toHaveBeenCalledWith({
      recipientId: expect.anything(),
      isRead: false,
    });
    countSpy.mockRestore();
  });

  it("gọi markAllAsRead và trả về số bản ghi được cập nhật", async () => {
    const updateManySpy = vi.spyOn(NotificationModel, "updateMany").mockResolvedValue({
      modifiedCount: 3,
    } as any);
    const repo = new NotificationRepository();
    const modified = await repo.markAllAsRead("507f1f77bcf86cd799439011");

    expect(modified).toBe(3);
    expect(updateManySpy).toHaveBeenCalledWith(
      {
        recipientId: expect.anything(),
        isRead: false,
      },
      expect.objectContaining({
        $set: expect.objectContaining({ isRead: true }),
      })
    );
    updateManySpy.mockRestore();
  });
});
