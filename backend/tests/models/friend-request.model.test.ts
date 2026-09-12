import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { FriendRequestModel } from "../../src/models/friend-request.model";

describe("FriendRequestModel Schema & Validation", () => {
  it("khởi tạo thành công với các trường hợp lệ và giá trị mặc định", () => {
    const senderId = new Types.ObjectId();
    const receiverId = new Types.ObjectId();

    const request = new FriendRequestModel({
      senderId,
      receiverId,
    });

    const error = request.validateSync();
    expect(error).toBeUndefined();
    expect(request.status).toBe("PENDING");
    expect(request.note).toBe("");
    expect(request.respondedAt).toBeNull();
  });

  it("cho phép gửi kèm note tối đa 200 ký tự", () => {
    const request = new FriendRequestModel({
      senderId: new Types.ObjectId(),
      receiverId: new Types.ObjectId(),
      note: "Chào bạn, mình kết bạn nhé!",
    });

    const error = request.validateSync();
    expect(error).toBeUndefined();
    expect(request.note).toBe("Chào bạn, mình kết bạn nhé!");
  });

  it("thất bại nếu note vượt quá 200 ký tự", () => {
    const request = new FriendRequestModel({
      senderId: new Types.ObjectId(),
      receiverId: new Types.ObjectId(),
      note: "a".repeat(201),
    });

    const error = request.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["note"]).toBeDefined();
  });

  it("thất bại nếu thiếu senderId hoặc receiverId", () => {
    const request = new FriendRequestModel({});

    const error = request.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["senderId"]).toBeDefined();
    expect(error?.errors["receiverId"]).toBeDefined();
  });

  it("thất bại nếu status không hợp lệ", () => {
    const request = new FriendRequestModel({
      senderId: new Types.ObjectId(),
      receiverId: new Types.ObjectId(),
      status: "INVALID_STATUS" as any,
    });

    const error = request.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["status"]).toBeDefined();
  });
});
