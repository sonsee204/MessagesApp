/**
 * Kiểm thử Socket.IO WebRTC signaling handlers (call:*).
 * Mock toàn bộ Service/Repository/Registry và emitToUser để cô lập tầng điều phối Socket.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { registerCallHandlers, cleanupOrphanCalls, CallHandlerDeps } from "./call.handlers";
import type { AuthenticatedSocket } from "./index";
import { ICall } from "../models/call.model";
import { ConflictError, ForbiddenError, NotFoundError } from "../core/errors";

// Mock Model Call ở mức module để cleanupOrphanCalls không cần kết nối MongoDB thật
vi.mock("../models/call.model", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../models/call.model")>();
  return {
    ...actual,
    CallModel: { updateMany: vi.fn() },
  };
});

import { CallModel } from "../models/call.model";

/**
 * Mock socket tối giản: chỉ cần user đã xác thực, bắt sự kiện qua socket.on và mô phỏng phòng.
 * Phòng (`rooms`) được mô phỏng để kiểm chứng cơ chế "còn tab khác" ở tầng handler.
 */
const createMockSocket = () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const rooms = new Set<string>();
  const socket = {
    user: { userId: callerId, email: "caller@test.com", username: "NguoiGoi" },
    rooms,
    join: (room: string) => rooms.add(room),
    leave: (room: string) => rooms.delete(room),
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(event, handler);
    }),
  };
  return {
    socket: socket as unknown as AuthenticatedSocket,
    rooms,
    handlers,
    trigger: (event: string, payload?: unknown) =>
      handlers.get(event)!(payload) as Promise<void>,
    /**
     * Mô phỏng đóng kết nối. Socket.IO thực hiện rời toàn bộ phòng (_cleanup) TRƯỚC khi phát
     * sự kiện "disconnect" (xem node_modules/socket.io/dist/socket.js - _onclose), nên thứ tự
     * này là bất biến mà handler dựa vào để biết "còn phiên khác hay không".
     */
    disconnect: async () => {
      rooms.clear();
      await handlers.get("disconnect")!();
    },
  };
};

const callerId = "507f1f77bcf86cd799439011";
const calleeId = "507f1f77bcf86cd799439012";
const conversationId = "507f1f77bcf86cd799439013";
const callId = "507f1f77bcf86cd799439014";

const createCallDoc = (overrides: Partial<Record<string, unknown>> = {}): ICall =>
  ({
    _id: new Types.ObjectId(callId),
    conversationId: new Types.ObjectId(conversationId),
    callerId: new Types.ObjectId(callerId),
    calleeId: new Types.ObjectId(calleeId),
    type: "video",
    status: "ringing",
    startedAt: new Date("2026-09-16T10:00:00.000Z"),
    answeredAt: null,
    endedAt: null,
    durationSec: null,
    ...overrides,
  }) as unknown as ICall;

describe("registerCallHandlers", () => {
  let mockCallSvc: {
    initiateCall: ReturnType<typeof vi.fn>;
    acceptCall: ReturnType<typeof vi.fn>;
    declineCall: ReturnType<typeof vi.fn>;
    cancelCall: ReturnType<typeof vi.fn>;
    endCall: ReturnType<typeof vi.fn>;
  };
  let mockCallRepo: { findById: ReturnType<typeof vi.fn> };
  let mockRegistry: {
    getCallId: ReturnType<typeof vi.fn>;
    clearUser: ReturnType<typeof vi.fn>;
  };
  let emitToUserFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCallSvc = {
      initiateCall: vi.fn(),
      acceptCall: vi.fn(),
      declineCall: vi.fn(),
      cancelCall: vi.fn(),
      endCall: vi.fn(),
    };
    mockCallRepo = { findById: vi.fn() };
    mockRegistry = { getCallId: vi.fn(), clearUser: vi.fn() };
    emitToUserFn = vi.fn();
  });

  /** Khởi tạo handler với đầy đủ dependency giả lập */
  const setup = (isUserOnline = true) => {
    const mock = createMockSocket();
    registerCallHandlers(mock.socket, deps(() => isUserOnline));
    return mock;
  };
  /** Đóng gói các dependency giả lập thành đúng kiểu CallHandlerDeps */
  const deps = (isUserOnlineFn: (userId: string) => boolean): CallHandlerDeps => ({
    callSvc: mockCallSvc as unknown as CallHandlerDeps["callSvc"],
    callRepo: mockCallRepo as unknown as CallHandlerDeps["callRepo"],
    registry: mockRegistry as unknown as CallHandlerDeps["registry"],
    emitToUserFn: emitToUserFn as unknown as CallHandlerDeps["emitToUserFn"],
    isUserOnlineFn,
  });

  it("đăng ký đủ 8 sự kiện call:* kèm xử lý disconnect", () => {
    const { handlers } = setup();

    expect([...handlers.keys()].sort()).toEqual([
      "call:accept",
      "call:answer",
      "call:cancel",
      "call:decline",
      "call:end",
      "call:ice",
      "call:initiate",
      "call:offer",
      "disconnect",
    ]);
  });

  it("call:initiate thành công -> người nhận có kết nối nhận call:incoming", async () => {
    mockCallSvc.initiateCall.mockResolvedValue(createCallDoc());
    const { trigger } = setup();

    await trigger("call:initiate", { calleeId, type: "video" });

    expect(mockCallSvc.initiateCall).toHaveBeenCalledWith(callerId, calleeId, "video");
    expect(emitToUserFn).toHaveBeenCalledWith(calleeId, "call:incoming", {
      callId,
      callerId,
      callerName: "NguoiGoi",
      type: "video",
    });
    // Người nhận online nên KHÔNG phát call:offline
    expect(emitToUserFn).not.toHaveBeenCalledWith(callerId, "call:offline", expect.anything());
  });

  it("call:initiate khi người nhận offline -> người gọi nhận call:offline", async () => {
    mockCallSvc.initiateCall.mockResolvedValue(createCallDoc());
    const { trigger } = setup(false);

    await trigger("call:initiate", { calleeId, type: "audio" });

    expect(emitToUserFn).toHaveBeenCalledWith(callerId, "call:offline", { callId, calleeId });
  });

  it("call:initiate ConflictError -> người gọi nhận call:busy (race hai chiều)", async () => {
    mockCallSvc.initiateCall.mockRejectedValue(
      new ConflictError("Một trong hai người đang bận một cuộc gọi khác")
    );
    const { trigger } = setup();

    await trigger("call:initiate", { calleeId, type: "audio" });

    expect(emitToUserFn).toHaveBeenCalledWith(callerId, "call:busy", { calleeId });
    expect(emitToUserFn).not.toHaveBeenCalledWith(callerId, "call:error", expect.anything());
  });

  it("call:initiate ForbiddenError -> người gọi nhận call:error kèm mã lỗi", async () => {
    mockCallSvc.initiateCall.mockRejectedValue(new ForbiddenError("Chỉ bạn bè mới được gọi nhau"));
    const { trigger } = setup();

    await trigger("call:initiate", { calleeId, type: "video" });

    expect(emitToUserFn).toHaveBeenCalledWith(callerId, "call:error", {
      code: "FORBIDDEN",
      message: "Chỉ bạn bè mới được gọi nhau",
    });
  });

  it("call:initiate với type không hợp lệ -> call:error, không gọi service", async () => {
    const { trigger } = setup();

    await trigger("call:initiate", { calleeId, type: "hologram" });

    expect(mockCallSvc.initiateCall).not.toHaveBeenCalled();
    expect(emitToUserFn).toHaveBeenCalledWith(callerId, "call:error", {
      code: "VALIDATION_ERROR",
      message: "Dữ liệu khởi tạo cuộc gọi không hợp lệ",
    });
  });

  it("call:accept -> người gọi nhận call:accepted", async () => {
    mockCallSvc.acceptCall.mockResolvedValue(createCallDoc({ status: "answered" }));
    const { trigger } = setup();

    await trigger("call:accept", { callId });

    expect(mockCallSvc.acceptCall).toHaveBeenCalledWith(callId, callerId);
    expect(emitToUserFn).toHaveBeenCalledWith(callerId, "call:accepted", { callId });
  });

  it("call:decline -> người gọi nhận call:declined", async () => {
    mockCallSvc.declineCall.mockResolvedValue(createCallDoc({ status: "declined" }));
    const { trigger } = setup();

    await trigger("call:decline", { callId });

    expect(emitToUserFn).toHaveBeenCalledWith(callerId, "call:declined", { callId });
  });

  it("call:cancel -> người nhận nhận call:canceled", async () => {
    mockCallSvc.cancelCall.mockResolvedValue(createCallDoc({ status: "missed" }));
    const { trigger } = setup();

    await trigger("call:cancel", { callId });

    expect(emitToUserFn).toHaveBeenCalledWith(calleeId, "call:canceled", { callId });
  });

  it("call:offer relay đúng người nhận (caller -> callee)", async () => {
    mockCallRepo.findById.mockResolvedValue(createCallDoc());
    const { trigger } = setup();

    await trigger("call:offer", { callId, sdp: { type: "offer", sdp: "v=0" } });

    expect(emitToUserFn).toHaveBeenCalledWith(calleeId, "call:offer", {
      callId,
      sdp: { type: "offer", sdp: "v=0" },
      from: callerId,
    });
  });

  it("call:answer relay ngược chiều (callee -> caller)", async () => {
    mockCallRepo.findById.mockResolvedValue(createCallDoc());
    const mock = createMockSocket();
    // Giả lập phiên của người nhận (callee) gửi answer
    mock.socket.user = { userId: calleeId, email: "callee@test.com", username: "NguoiNhan" };
    registerCallHandlers(mock.socket, {
      callRepo: mockCallRepo as unknown as CallHandlerDeps["callRepo"],
      emitToUserFn: emitToUserFn as unknown as CallHandlerDeps["emitToUserFn"],
    });

    await mock.trigger("call:answer", { callId, sdp: { type: "answer", sdp: "v=0" } });

    expect(emitToUserFn).toHaveBeenCalledWith(callerId, "call:answer", {
      callId,
      sdp: { type: "answer", sdp: "v=0" },
      from: calleeId,
    });
  });

  it("call:ice relay candidate sang phía đối diện", async () => {
    mockCallRepo.findById.mockResolvedValue(createCallDoc());
    const { trigger } = setup();
    const candidate = { candidate: "candidate:1", sdpMLineIndex: 0 };

    await trigger("call:ice", { callId, candidate });

    expect(emitToUserFn).toHaveBeenCalledWith(calleeId, "call:ice", {
      callId,
      candidate,
      from: callerId,
    });
  });

  it("call:offer với callId không tồn tại -> call:error, không relay", async () => {
    mockCallRepo.findById.mockResolvedValue(null);
    const { trigger } = setup();

    await trigger("call:offer", { callId, sdp: { type: "offer" } });

    expect(emitToUserFn).toHaveBeenCalledWith(callerId, "call:error", {
      code: "NOT_FOUND",
      message: "Không tìm thấy cuộc gọi",
    });
    expect(emitToUserFn).toHaveBeenCalledTimes(1);
  });

  it("call:offer khi người gửi không thuộc cuộc gọi -> call:error FORBIDDEN", async () => {
    // Cuộc gọi của hai người khác, socket hiện tại không phải participant
    mockCallRepo.findById.mockResolvedValue(
      createCallDoc({
        callerId: new Types.ObjectId("507f1f77bcf86cd799439021"),
        calleeId: new Types.ObjectId("507f1f77bcf86cd799439022"),
      })
    );
    const { trigger } = setup();

    await trigger("call:offer", { callId, sdp: { type: "offer" } });

    expect(emitToUserFn).toHaveBeenCalledWith(callerId, "call:error", {
      code: "FORBIDDEN",
      message: "Bạn không thuộc cuộc gọi này",
    });
  });

  it("call:end -> service được gọi và phía bên kia nhận call:ended", async () => {
    mockCallSvc.endCall.mockResolvedValue(createCallDoc({ status: "ended" }));
    const { trigger } = setup();

    await trigger("call:end", { callId });

    expect(mockCallSvc.endCall).toHaveBeenCalledWith(callId, callerId);
    expect(emitToUserFn).toHaveBeenCalledWith(calleeId, "call:ended", { callId });
  });

  it("call:end ConflictError (cuộc gọi đã kết thúc) -> call:busy", async () => {
    mockCallSvc.endCall.mockRejectedValue(new ConflictError("Cuộc gọi đã kết thúc trước đó"));
    const { trigger } = setup();

    await trigger("call:end", { callId });

    expect(emitToUserFn).toHaveBeenCalledWith(callerId, "call:busy", {});
  });

  it("call:end NotFoundError -> call:error NOT_FOUND", async () => {
    mockCallSvc.endCall.mockRejectedValue(new NotFoundError("Không tìm thấy cuộc gọi"));
    const { trigger } = setup();

    await trigger("call:end", { callId });

    expect(emitToUserFn).toHaveBeenCalledWith(callerId, "call:error", {
      code: "NOT_FOUND",
      message: "Không tìm thấy cuộc gọi",
    });
  });

  it("disconnect giữa cuộc gọi khi còn phiên khác -> không dọn registry, không báo đối phương", async () => {
    mockRegistry.getCallId.mockReturnValue(callId);
    const mock = createMockSocket();
    // Hai tab của cùng người dùng: socket hiện tại + một socket khác đang giữ phòng user:<id>
    mock.rooms.add(`user:${callerId}`);
    registerCallHandlers(mock.socket, { ...deps(() => false), isUserOnlineFn: () => true });

    await mock.disconnect();

    expect(mockRegistry.clearUser).not.toHaveBeenCalled();
    expect(emitToUserFn).not.toHaveBeenCalled();
  });

  it("disconnect kết nối cuối cùng -> giải phóng registry và báo đối phương call:peer_disconnected", async () => {
    mockRegistry.getCallId.mockReturnValue(callId);
    mockCallRepo.findById.mockResolvedValue(createCallDoc());
    const mock = createMockSocket();
    mock.rooms.add(`user:${callerId}`);
    registerCallHandlers(mock.socket, deps(() => false));

    await mock.disconnect();

    expect(mockRegistry.clearUser).toHaveBeenCalledWith(callerId);
    expect(emitToUserFn).toHaveBeenCalledWith(calleeId, "call:peer_disconnected", { callId });
  });

  it("disconnect khi không có cuộc gọi -> không làm gì", async () => {
    mockRegistry.getCallId.mockReturnValue(undefined);
    const mock = createMockSocket();
    mock.rooms.add(`user:${callerId}`);
    registerCallHandlers(mock.socket, deps(() => false));

    await mock.disconnect();

    expect(mockRegistry.clearUser).not.toHaveBeenCalled();
    expect(emitToUserFn).not.toHaveBeenCalled();
  });
});

describe("cleanupOrphanCalls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chuyển toàn bộ cuộc gọi ringing sang missed kèm endedAt", async () => {
    const updateManyMock = vi.mocked(CallModel.updateMany);
    updateManyMock.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ modifiedCount: 3 }),
    } as never);

    await cleanupOrphanCalls();

    expect(updateManyMock).toHaveBeenCalledWith(
      { status: "ringing" },
      { $set: { status: "missed", endedAt: expect.any(Date) } }
    );
  });

  it("ném lại lỗi CSDL để tầng gọi ghi log", async () => {
    const updateManyMock = vi.mocked(CallModel.updateMany);
    updateManyMock.mockReturnValue({
      exec: vi.fn().mockRejectedValue(new Error("Mất kết nối MongoDB")),
    } as never);

    await expect(cleanupOrphanCalls()).rejects.toThrow("Mất kết nối MongoDB");
  });
});
