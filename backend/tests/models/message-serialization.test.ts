import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { MessageModel } from "../../src/models/message.model";
import { isParticipant } from "../../src/socket";

/**
 * Trích xuất hàm transform của toJSON từ Schema.
 * Gọi trực tiếp hàm này là cách duy nhất kiểm chứng đúng đường chạy thật:
 * `populate()` chèn document User vào `ret.senderId` SAU khi Mongoose cast,
 * nên không thể mô phỏng nó bằng cách khởi tạo MessageModel với object thường
 * (Mongoose sẽ cast object đó về ObjectId trước khi transform chạy).
 *
 * @param ret Đối tượng thô đúng hình dạng mà Mongoose đưa vào transform
 * @returns Đối tượng sau khi transform — chính là JSON trả về cho client
 */
function applyToJSON(ret: Record<string, unknown>): Record<string, unknown> {
  const toJSON = MessageModel.schema.get("toJSON") as {
    transform: (doc: unknown, ret: Record<string, unknown>) => Record<string, unknown>;
  };
  return toJSON.transform({}, ret);
}

/**
 * Khoá lại hợp đồng dữ liệu Message giữa Backend và Frontend.
 * Frontend khai báo `senderId: string` + `sender?: User`; nếu repository populate
 * `senderId` thành object thì mọi so sánh `senderId === currentUserId` phía client
 * đều sai âm thầm (không crash, không log).
 */
describe("Hợp đồng shape của Message trả về client", () => {
  it("tách senderId thành chuỗi và chuyển document User sang trường sender", () => {
    const senderObjectId = new Types.ObjectId();

    // Đúng hình dạng Mongoose sinh ra sau .populate("senderId", "username displayName avatarUrl")
    const json = applyToJSON({
      _id: new Types.ObjectId(),
      senderId: {
        _id: senderObjectId,
        username: "verify_a",
        displayName: "Người gửi A",
        avatarUrl: null,
      },
      content: "Xin chào",
    });

    // senderId phải là CHUỖI để client so sánh được với ID người dùng hiện tại
    expect(typeof json.senderId).toBe("string");
    expect(json.senderId).toBe(senderObjectId.toString());

    // Toàn bộ thông tin hiển thị nằm ở trường `sender`
    expect(json.sender).toMatchObject({ username: "verify_a", displayName: "Người gửi A" });
  });

  it("giữ nguyên senderId và không sinh trường sender khi chưa populate", () => {
    const senderObjectId = new Types.ObjectId();

    const json = applyToJSON({
      _id: new Types.ObjectId(),
      senderId: senderObjectId,
      content: "Tin nhắn thô",
    });

    // ObjectId thô cũng là "object" — nếu không loại trừ tường minh, `sender` sẽ bị gán rác
    expect(json.sender).toBeUndefined();
    expect(json.senderId).toBe(senderObjectId);
  });
});

/**
 * Khoá lại kiểm tra thành viên dùng cho phòng Socket.IO.
 * Trước đây `join_conversation` join vô điều kiện nên người ngoài đọc được tin nhắn riêng.
 */
describe("isParticipant — chốt chặn quyền vào phòng Socket.IO", () => {
  const userA = new Types.ObjectId().toString();
  const userB = new Types.ObjectId().toString();
  const outsider = new Types.ObjectId().toString();

  it("chấp nhận thành viên khi participants chứa ObjectId thô", () => {
    expect(isParticipant([new Types.ObjectId(userA)], userA)).toBe(true);
  });

  it("chấp nhận thành viên khi participants đã populate thành document User", () => {
    expect(isParticipant([{ _id: new Types.ObjectId(userA), username: "a" }], userA)).toBe(true);
  });

  it("từ chối người không thuộc cuộc trò chuyện", () => {
    expect(isParticipant([new Types.ObjectId(userA), new Types.ObjectId(userB)], outsider)).toBe(
      false
    );
  });

  it("từ chối an toàn với dữ liệu rỗng hoặc dị dạng", () => {
    expect(isParticipant([], userA)).toBe(false);
    expect(isParticipant(undefined as unknown as unknown[], userA)).toBe(false);
    expect(isParticipant([null], userA)).toBe(false);
  });
});
