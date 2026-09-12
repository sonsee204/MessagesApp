import { describe, it, expect } from "vitest";
import { getIO, emitToConversation } from "../../src/socket";

describe("Socket Bridge Utilities", () => {
  it("getIO trả về null khi server chưa khởi động", () => {
    expect(getIO()).toBeNull();
  });

  it("emitToConversation không ném lỗi nếu getIO() là null", () => {
    expect(() => {
      emitToConversation("conv_123", "new_message", { content: "test" });
    }).not.toThrow();
  });
});
