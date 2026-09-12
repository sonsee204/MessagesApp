import { describe, it, expect } from "vitest";
import {
  SendFriendRequestSchema,
  FriendQuerySchema,
  PaginationQuerySchema,
  RequestIdParamSchema,
  TargetUserParamSchema,
} from "../../src/schemas/friend.schema";

describe("Friend Schemas Validation", () => {
  describe("SendFriendRequestSchema", () => {
    it("hợp lệ khi receiverId là ObjectId 24 ký tự hex và note hợp lệ", () => {
      const valid = SendFriendRequestSchema.safeParse({
        body: {
          receiverId: "507f1f77bcf86cd799439011",
          note: "Kết bạn nhé",
        },
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.body.note).toBe("Kết bạn nhé");
      }
    });

    it("tự gán note rỗng nếu không truyền", () => {
      const valid = SendFriendRequestSchema.safeParse({
        body: {
          receiverId: "507f1f77bcf86cd799439011",
        },
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.body.note).toBe("");
      }
    });

    it("thất bại nếu receiverId không phải ObjectId 24 ký tự", () => {
      const invalid = SendFriendRequestSchema.safeParse({
        body: {
          receiverId: "invalid-id-123",
        },
      });
      expect(invalid.success).toBe(false);
    });

    it("thất bại nếu note vượt quá 200 ký tự", () => {
      const invalid = SendFriendRequestSchema.safeParse({
        body: {
          receiverId: "507f1f77bcf86cd799439011",
          note: "a".repeat(201),
        },
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("FriendQuerySchema & PaginationQuerySchema", () => {
    it("chuyển đổi chuỗi query sang number và gán giá trị mặc định", () => {
      const valid = FriendQuerySchema.safeParse({
        query: {
          page: "2",
          limit: "15",
          search: "son",
          onlineOnly: "true",
        },
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.query.page).toBe(2);
        expect(valid.data.query.limit).toBe(15);
        expect(valid.data.query.search).toBe("son");
        expect(valid.data.query.onlineOnly).toBe(true);
      }
    });

    it("áp dụng page=1, limit=20 mặc định khi query rỗng", () => {
      const valid = PaginationQuerySchema.safeParse({
        query: {},
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.query.page).toBe(1);
        expect(valid.data.query.limit).toBe(20);
      }
    });
  });

  describe("Param Schemas", () => {
    it("RequestIdParamSchema kiểm tra hợp lệ param requestId", () => {
      const valid = RequestIdParamSchema.safeParse({
        params: { requestId: "507f1f77bcf86cd799439011" },
      });
      expect(valid.success).toBe(true);

      const invalid = RequestIdParamSchema.safeParse({
        params: { requestId: "invalid" },
      });
      expect(invalid.success).toBe(false);
    });

    it("TargetUserParamSchema kiểm tra hợp lệ param targetUserId", () => {
      const valid = TargetUserParamSchema.safeParse({
        params: { targetUserId: "507f1f77bcf86cd799439011" },
      });
      expect(valid.success).toBe(true);
    });
  });
});
