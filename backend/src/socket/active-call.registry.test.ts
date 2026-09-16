import { describe, it, expect, beforeEach } from "vitest";
import { ActiveCallRegistry, activeCallRegistry } from "./active-call.registry";

describe("ActiveCallRegistry", () => {
  let registry: ActiveCallRegistry;

  beforeEach(() => {
    registry = new ActiveCallRegistry();
  });

  it("mặc định người dùng không bận và không có callId", () => {
    expect(registry.isBusy("user-1")).toBe(false);
    expect(registry.getCallId("user-1")).toBeUndefined();
  });

  it("đánh dấu người dùng bận khi setBusy", () => {
    registry.setBusy("user-1", "call-100");

    expect(registry.isBusy("user-1")).toBe(true);
    expect(registry.getCallId("user-1")).toBe("call-100");
    expect(registry.isBusy("user-2")).toBe(false);
  });

  it("giải phóng trạng thái bận của một người dùng bằng clearUser", () => {
    registry.setBusy("user-1", "call-100");
    registry.setBusy("user-2", "call-100");

    registry.clearUser("user-1");

    expect(registry.isBusy("user-1")).toBe(false);
    expect(registry.getCallId("user-1")).toBeUndefined();
    expect(registry.isBusy("user-2")).toBe(true);
    expect(registry.getCallId("user-2")).toBe("call-100");
  });

  it("giải phóng toàn bộ người dùng của cuộc gọi bằng clearCall", () => {
    registry.setBusy("caller-1", "call-abc");
    registry.setBusy("callee-1", "call-abc");
    registry.setBusy("other-user", "call-xyz");

    registry.clearCall("call-abc");

    expect(registry.isBusy("caller-1")).toBe(false);
    expect(registry.isBusy("callee-1")).toBe(false);
    expect(registry.getCallId("caller-1")).toBeUndefined();
    expect(registry.getCallId("callee-1")).toBeUndefined();

    // Cuộc gọi khác không bị ảnh hưởng
    expect(registry.isBusy("other-user")).toBe(true);
    expect(registry.getCallId("other-user")).toBe("call-xyz");
  });

  it("xóa sạch toàn bộ map bằng clearAll", () => {
    registry.setBusy("user-1", "call-1");
    registry.setBusy("user-2", "call-2");

    registry.clearAll();

    expect(registry.isBusy("user-1")).toBe(false);
    expect(registry.isBusy("user-2")).toBe(false);
  });

  it("singleton instance hoạt động bình thường", () => {
    activeCallRegistry.clearAll();
    activeCallRegistry.setBusy("singleton-user", "call-999");

    expect(activeCallRegistry.isBusy("singleton-user")).toBe(true);
    expect(activeCallRegistry.getCallId("singleton-user")).toBe("call-999");

    activeCallRegistry.clearCall("call-999");
    expect(activeCallRegistry.isBusy("singleton-user")).toBe(false);
  });
});
