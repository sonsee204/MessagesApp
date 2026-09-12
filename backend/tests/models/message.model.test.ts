import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { MessageModel } from "../../src/models/message.model";

describe("MessageModel Schema & Validation", () => {
  it("khởi tạo thành công với các giá trị mặc định", () => {
    const msg = new MessageModel({
      conversationId: new Types.ObjectId(),
      senderId: new Types.ObjectId(),
      content: "Xin chào bạn bè",
    });

    const error = msg.validateSync();
    expect(error).toBeUndefined();
    expect(msg.type).toBe("TEXT");
    expect(msg.isDeleted).toBe(false);
    expect(msg.deletedAt).toBeNull();
    expect(msg.replyToMessageId).toBeNull();
    expect(msg.attachments).toEqual([]);
    expect(msg.readBy).toEqual([]);
  });

  it("cho phép đính kèm attachments và replyToMessageId", () => {
    const replyId = new Types.ObjectId();
    const msg = new MessageModel({
      conversationId: new Types.ObjectId(),
      senderId: new Types.ObjectId(),
      content: "Xem file đính kèm này",
      replyToMessageId: replyId,
      attachments: [
        {
          url: "https://example.com/file.pdf",
          name: "tailieu.pdf",
          size: 1024,
          mimeType: "application/pdf",
        },
      ],
    });

    const error = msg.validateSync();
    expect(error).toBeUndefined();
    expect(msg.replyToMessageId?.toString()).toBe(replyId.toString());
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments[0].name).toBe("tailieu.pdf");
  });

  it("cho phép content rỗng nếu có attachments", () => {
    const msg = new MessageModel({
      conversationId: new Types.ObjectId(),
      senderId: new Types.ObjectId(),
      type: "IMAGE",
      attachments: [
        {
          url: "https://example.com/photo.png",
          name: "photo.png",
          size: 2048,
          mimeType: "image/png",
        },
      ],
    });

    const error = msg.validateSync();
    expect(error).toBeUndefined();
  });

  it("thất bại nếu thiếu cả content lẫn attachments", () => {
    const msg = new MessageModel({
      conversationId: new Types.ObjectId(),
      senderId: new Types.ObjectId(),
    });

    const error = msg.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["content"]).toBeDefined();
  });

  it("thất bại nếu type không nằm trong enum cho phép", () => {
    const msg = new MessageModel({
      conversationId: new Types.ObjectId(),
      senderId: new Types.ObjectId(),
      content: "Hello",
      type: "INVALID_TYPE" as any,
    });

    const error = msg.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["type"]).toBeDefined();
  });
});
