import { describe, it, expect } from "vitest";
import {
  SendMessageSchema,
  GetMessagesQuerySchema,
  RecallMessageParamsSchema,
  MarkMessagesAsReadParamsSchema,
} from "../../src/schemas/message.schema";

describe("Message Schemas Validation", () => {
  describe("SendMessageSchema", () => {
    it("hợp lệ với tin nhắn văn bản thông thường", () => {
      const valid = SendMessageSchema.safeParse({
        params: { conversationId: "507f1f77bcf86cd799439011" },
        body: { content: "Xin chào bạn!" },
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.body.content).toBe("Xin chào bạn!");
        expect(valid.data.body.type).toBe("TEXT");
      }
    });

    it("hợp lệ với tin nhắn có đính kèm file dù content rỗng", () => {
      const valid = SendMessageSchema.safeParse({
        params: { conversationId: "507f1f77bcf86cd799439011" },
        body: {
          type: "IMAGE",
          attachments: [
            {
              url: "https://example.com/img.png",
              name: "img.png",
              size: 1024,
              mimeType: "image/png",
            },
          ],
        },
      });
      expect(valid.success).toBe(true);
    });

    it("thất bại nếu cả content và attachments đều rỗng", () => {
      const invalid = SendMessageSchema.safeParse({
        params: { conversationId: "507f1f77bcf86cd799439011" },
        body: { content: "   " },
      });
      expect(invalid.success).toBe(false);
    });

    it("thất bại nếu conversationId sai định dạng ObjectId", () => {
      const invalid = SendMessageSchema.safeParse({
        params: { conversationId: "invalid-id" },
        body: { content: "Hello" },
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("GetMessagesQuerySchema", () => {
    it("hợp lệ và gán limit mặc định là 20", () => {
      const valid = GetMessagesQuerySchema.safeParse({
        params: { conversationId: "507f1f77bcf86cd799439011" },
        query: {},
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.query.limit).toBe(20);
      }
    });

    it("giới hạn limit tối đa 50", () => {
      const invalid = GetMessagesQuerySchema.safeParse({
        params: { conversationId: "507f1f77bcf86cd799439011" },
        query: { limit: "100" },
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("RecallMessageParamsSchema & MarkMessagesAsReadParamsSchema", () => {
    it("hợp lệ khi truyền đúng ObjectId cho conversationId và messageId", () => {
      const validRecall = RecallMessageParamsSchema.safeParse({
        params: {
          conversationId: "507f1f77bcf86cd799439011",
          messageId: "507f1f77bcf86cd799439022",
        },
      });
      expect(validRecall.success).toBe(true);

      const validRead = MarkMessagesAsReadParamsSchema.safeParse({
        params: {
          conversationId: "507f1f77bcf86cd799439011",
        },
      });
      expect(validRead.success).toBe(true);
    });
  });
});
