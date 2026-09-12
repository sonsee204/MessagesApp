import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { MongooseMessageRepository } from "../../src/repositories/message.repository";
import { MessageModel } from "../../src/models/message.model";

describe("MongooseMessageRepository", () => {
  let repo: MongooseMessageRepository;

  beforeEach(() => {
    vi.restoreAllMocks();
    repo = new MongooseMessageRepository();
  });

  it("create gọi MessageModel.create với dữ liệu chuẩn hóa", async () => {
    const fakeMessage = {
      _id: new Types.ObjectId(),
      populate: vi.fn().mockResolvedValue({ id: "msg_123", content: "Xin chào" }),
    };

    vi.spyOn(MessageModel, "create").mockResolvedValue([fakeMessage] as any);

    const result = await repo.create({
      conversationId: "507f1f77bcf86cd799439011",
      senderId: "507f1f77bcf86cd799439022",
      content: "Xin chào",
      type: "TEXT",
    });

    expect(result).toBeDefined();
    expect(MessageModel.create).toHaveBeenCalled();
  });

  it("softDelete cập nhật cờ isDeleted thành true", async () => {
    const msgId = new Types.ObjectId().toString();
    vi.spyOn(MessageModel, "findByIdAndUpdate").mockReturnValue({
      exec: vi.fn().mockResolvedValue({ id: msgId, isDeleted: true }),
    } as any);

    const result = await repo.softDelete(msgId);
    expect(result?.isDeleted).toBe(true);
    expect(MessageModel.findByIdAndUpdate).toHaveBeenCalledWith(
      msgId,
      { $set: { isDeleted: true, deletedAt: expect.any(Date) } },
      { new: true, session: undefined }
    );
  });

  it("markAllAsRead cập nhật trường readBy bằng updateMany", async () => {
    const convId = new Types.ObjectId().toString();
    const uId = new Types.ObjectId().toString();
    vi.spyOn(MessageModel, "updateMany").mockReturnValue({
      exec: vi.fn().mockResolvedValue({ modifiedCount: 2 }),
    } as any);

    await repo.markAllAsRead(convId, uId);
    expect(MessageModel.updateMany).toHaveBeenCalledWith(
      {
        conversationId: new Types.ObjectId(convId),
        readBy: { $ne: new Types.ObjectId(uId) },
      },
      {
        $addToSet: { readBy: new Types.ObjectId(uId) },
      },
      { session: undefined }
    );
  });
});
