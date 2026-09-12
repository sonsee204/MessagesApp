import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { FriendModel, normalizeFriendIds } from "../../src/models/friend.model";

describe("FriendModel Schema & Helpers", () => {
  describe("normalizeFriendIds()", () => {
    it("luôn sắp xếp userA có chuỗi ObjectId nhỏ hơn userB", () => {
      const idSmall = new Types.ObjectId("507f1f77bcf86cd799439011");
      const idLarge = new Types.ObjectId("607f1f77bcf86cd799439012");

      const [uA1, uB1] = normalizeFriendIds(idSmall, idLarge);
      expect(uA1.toString()).toBe(idSmall.toString());
      expect(uB1.toString()).toBe(idLarge.toString());

      // Ngược lại khi đảo thứ tự truyền vào
      const [uA2, uB2] = normalizeFriendIds(idLarge, idSmall);
      expect(uA2.toString()).toBe(idSmall.toString());
      expect(uB2.toString()).toBe(idLarge.toString());
    });

    it("ném lỗi nếu 2 user id trùng nhau", () => {
      const id = new Types.ObjectId();
      expect(() => normalizeFriendIds(id, id)).toThrowError(
        "Không thể tạo quan hệ bạn bè với chính mình"
      );
    });
  });

  describe("FriendModel Schema Validation", () => {
    it("khởi tạo thành công với userA và userB hợp lệ", () => {
      const idA = new Types.ObjectId("507f1f77bcf86cd799439011");
      const idB = new Types.ObjectId("607f1f77bcf86cd799439012");

      const friend = new FriendModel({
        userA: idA,
        userB: idB,
      });

      const error = friend.validateSync();
      expect(error).toBeUndefined();
      expect(friend.friendRequestId).toBeNull();
    });

    it("cho phép liên kết friendRequestId", () => {
      const reqId = new Types.ObjectId();
      const friend = new FriendModel({
        userA: new Types.ObjectId("507f1f77bcf86cd799439011"),
        userB: new Types.ObjectId("607f1f77bcf86cd799439012"),
        friendRequestId: reqId,
      });

      const error = friend.validateSync();
      expect(error).toBeUndefined();
      expect(friend.friendRequestId?.toString()).toBe(reqId.toString());
    });

    it("thất bại nếu thiếu userA hoặc userB", () => {
      const friend = new FriendModel({});
      const error = friend.validateSync();
      expect(error).toBeDefined();
      expect(error?.errors["userA"]).toBeDefined();
      expect(error?.errors["userB"]).toBeDefined();
    });
  });
});
