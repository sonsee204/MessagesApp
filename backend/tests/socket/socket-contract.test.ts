import { describe, it, expect } from "vitest";
import { resolveConversationId, normalizeHandshakeToken } from "../../src/socket";
import { generateAccessToken, verifyAccessToken } from "../../src/utils/auth";

/**
 * Kiểm thử hợp đồng (contract) giữa Frontend Socket.IO Client và Backend Socket.IO Server.
 * Mục tiêu: khoá lại 2 lỗi từng làm hỏng toàn bộ luồng realtime.
 */
describe("Socket contract FE ↔ BE", () => {
  describe("normalizeHandshakeToken — lỗi 'jwt malformed'", () => {
    it("bỏ tiền tố 'Bearer ' mà Frontend gửi trong handshake auth", () => {
      // Frontend lib/socket.ts gửi: `Bearer ${accessToken}`
      const jwt = generateAccessToken({ userId: "u1", email: "a@b.com", username: "son" });

      expect(normalizeHandshakeToken(`Bearer ${jwt}`)).toBe(jwt);

      // Sau khi chuẩn hóa phải xác thực được, đây chính là bước từng thất bại
      expect(verifyAccessToken(normalizeHandshakeToken(`Bearer ${jwt}`)!).userId).toBe("u1");
    });

    it("giữ nguyên JWT thô khi client không gửi tiền tố", () => {
      const jwt = generateAccessToken({ userId: "u2", email: "x@y.com", username: "an" });
      expect(normalizeHandshakeToken(jwt)).toBe(jwt);
      expect(() => verifyAccessToken(normalizeHandshakeToken(jwt)!)).not.toThrow();
    });

    it("trả về undefined với giá trị rỗng hoặc không phải chuỗi", () => {
      expect(normalizeHandshakeToken(undefined)).toBeUndefined();
      expect(normalizeHandshakeToken("")).toBeUndefined();
      expect(normalizeHandshakeToken(null)).toBeUndefined();
      expect(normalizeHandshakeToken(123)).toBeUndefined();
    });
  });

  describe("resolveConversationId — lỗi typing indicator rơi vào room 'undefined'", () => {
    it("đọc đúng conversationId từ dạng đối tượng mà Frontend gửi", () => {
      // Frontend useChatSocket.ts phát: { conversationId }
      expect(resolveConversationId({ conversationId: "652f1a2b3c4d5e6f7a8b9c0d" })).toBe(
        "652f1a2b3c4d5e6f7a8b9c0d"
      );
    });

    it("vẫn chấp nhận dạng chuỗi thô của các client cũ", () => {
      expect(resolveConversationId("652f1a2b3c4d5e6f7a8b9c0d")).toBe("652f1a2b3c4d5e6f7a8b9c0d");
    });

    it("trả về chuỗi rỗng với payload sai để handler không phát vào room rác", () => {
      expect(resolveConversationId({})).toBe("");
      expect(resolveConversationId({ conversationId: undefined as unknown as string })).toBe("");
    });
  });
});
