import { describe, it, expect } from "vitest";
import {
  GetNotificationsQuerySchema,
  NotificationIdParamSchema,
} from "../../src/schemas/notification.schema";

describe("Notification Schemas Validation Unit Tests", () => {
  describe("GetNotificationsQuerySchema", () => {
    it("chấp nhận query mặc định và tự gán page=1, limit=20, unreadOnly=false", () => {
      const result = GetNotificationsQuerySchema.safeParse({ query: {} });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(1);
        expect(result.data.query.limit).toBe(20);
        expect(result.data.query.unreadOnly).toBe(false);
      }
    });

    it("chấp nhận query hợp lệ với chuỗi số cần ép kiểu", () => {
      const result = GetNotificationsQuerySchema.safeParse({
        query: {
          page: "2",
          limit: "15",
          unreadOnly: "true",
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(2);
        expect(result.data.query.limit).toBe(15);
        expect(result.data.query.unreadOnly).toBe(true);
      }
    });

    it("từ chối khi limit vượt quá trần 50", () => {
      const result = GetNotificationsQuerySchema.safeParse({
        query: {
          limit: "51",
        },
      });
      expect(result.success).toBe(false);
    });

    it("từ chối khi page nhỏ hơn 1", () => {
      const result = GetNotificationsQuerySchema.safeParse({
        query: {
          page: "0",
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("NotificationIdParamSchema", () => {
    it("chấp nhận id ObjectId 24 ký tự hex hợp lệ", () => {
      const validId = "507f1f77bcf86cd799439011";
      const result = NotificationIdParamSchema.safeParse({
        params: { id: validId },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.params.id).toBe(validId);
      }
    });

    it("từ chối id sai định dạng ObjectId", () => {
      const result = NotificationIdParamSchema.safeParse({
        params: { id: "not-an-object-id" },
      });
      expect(result.success).toBe(false);
    });
  });
});
