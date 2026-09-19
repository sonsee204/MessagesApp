import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { CallService } from "./call.service";
import { ICall, CallStatus, CallType } from "../models/call.model";
import { IConversation } from "../models/conversation.model";
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../core/errors";
import { ActiveCallRegistry } from "../socket/active-call.registry";

describe("CallService", () => {
  let callService: CallService;
  let mockCallRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByIds: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    findRecentByUser: ReturnType<typeof vi.fn>;
    countMissed: ReturnType<typeof vi.fn>;
  };
  let mockFriendRepo: {
    isFriend: ReturnType<typeof vi.fn>;
  };
  let mockBlockRepo: {
    isBlocked: ReturnType<typeof vi.fn>;
  };
  let mockConvRepo: {
    findDirectBetween: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let callRegistry: ActiveCallRegistry;

  const callerId = "507f1f77bcf86cd799439011";
  const calleeId = "507f1f77bcf86cd799439012";
  const conversationId = "507f1f77bcf86cd799439013";
  const callId = "507f1f77bcf86cd799439014";

  const createMockCallDoc = (overrides: Partial<Record<string, unknown>> = {}): ICall => {
    return {
      _id: new Types.ObjectId(callId),
      conversationId: new Types.ObjectId(conversationId),
      callerId: new Types.ObjectId(callerId),
      calleeId: new Types.ObjectId(calleeId),
      type: "video" as CallType,
      status: "ringing" as CallStatus,
      startedAt: new Date("2026-09-16T10:00:00.000Z"),
      answeredAt: null,
      endedAt: null,
      durationSec: null,
      ...overrides,
    } as unknown as ICall;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockCallRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByIds: vi.fn().mockResolvedValue(new Map()),
      updateStatus: vi.fn(),
      findRecentByUser: vi.fn(),
      countMissed: vi.fn(),
    };

    mockFriendRepo = {
      isFriend: vi.fn().mockResolvedValue(true),
    };

    mockBlockRepo = {
      isBlocked: vi.fn().mockResolvedValue(false),
    };

    mockConvRepo = {
      findDirectBetween: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(conversationId),
      } as unknown as IConversation),
    };

    callRegistry = new ActiveCallRegistry();

    callService = new CallService(
      mockCallRepo as never,
      mockFriendRepo as never,
      mockBlockRepo as never,
      mockConvRepo as never,
      callRegistry
    );
  });

  describe("initiateCall", () => {
    it("ném ForbiddenError khi tự gọi chính mình (callerId === calleeId)", async () => {
      await expect(
        callService.initiateCall(callerId, callerId, "audio")
      ).rejects.toThrow(ForbiddenError);

      expect(mockCallRepo.create).not.toHaveBeenCalled();
    });

    it("ném ForbiddenError khi một trong hai người chặn người kia", async () => {
      mockBlockRepo.isBlocked.mockResolvedValueOnce(true);

      await expect(
        callService.initiateCall(callerId, calleeId, "video")
      ).rejects.toThrow(ForbiddenError);

      expect(mockBlockRepo.isBlocked).toHaveBeenCalledWith(callerId, calleeId);
      expect(mockFriendRepo.isFriend).not.toHaveBeenCalled();
      expect(mockCallRepo.create).not.toHaveBeenCalled();
    });

    it("ném ForbiddenError khi hai người chưa phải là bạn bè", async () => {
      mockFriendRepo.isFriend.mockResolvedValueOnce(false);

      await expect(
        callService.initiateCall(callerId, calleeId, "audio")
      ).rejects.toThrow(ForbiddenError);

      expect(mockFriendRepo.isFriend).toHaveBeenCalledWith(callerId, calleeId);
      expect(mockCallRepo.create).not.toHaveBeenCalled();
    });

    it("ném ConflictError khi người gọi đang bận một cuộc gọi khác (còn sống)", async () => {
      callRegistry.setBusy(callerId, callId);
      // Cuộc gọi trong registry vẫn ở trạng thái hoạt động -> phải chặn (batch query via findByIds)
      mockCallRepo.findByIds.mockResolvedValueOnce(
        new Map([[callId, createMockCallDoc({ status: "answered" })]])
      );

      await expect(
        callService.initiateCall(callerId, calleeId, "audio")
      ).rejects.toThrow(ConflictError);

      expect(mockCallRepo.create).not.toHaveBeenCalled();
    });

    it("ném ConflictError khi người nhận đang bận một cuộc gọi khác (còn sống)", async () => {
      callRegistry.setBusy(calleeId, callId);
      mockCallRepo.findByIds.mockResolvedValueOnce(
        new Map([[callId, createMockCallDoc({ status: "answered" })]])
      );

      await expect(
        callService.initiateCall(callerId, calleeId, "video")
      ).rejects.toThrow(ConflictError);

      expect(mockCallRepo.create).not.toHaveBeenCalled();
    });

    it("tự chữa entry ma: callId treo đã 'ended' trong CSDL -> clear registry và cho gọi mới", async () => {
      // Mô phỏng đúng bug thực tế: kết thúc cuộc gọi xong gọi lại bị chặn "đang có cuộc gọi khác"
      callRegistry.setBusy(calleeId, callId);
      mockCallRepo.findByIds.mockResolvedValueOnce(
        new Map([[callId, createMockCallDoc({ status: "ended" })]])
      );
      mockCallRepo.create.mockResolvedValueOnce(createMockCallDoc());

      await callService.initiateCall(callerId, calleeId, "video");

      // Entry ma đã được self-heal -> cuộc gọi MỚI tạo thành công (registry giờ bận vì call mới)
      expect(mockCallRepo.create).toHaveBeenCalled();
    });

    it("tự chữa entry ma: 'ringing' treo quá 60s -> clear registry và cho gọi mới", async () => {
      callRegistry.setBusy(callerId, callId);
      mockCallRepo.findByIds.mockResolvedValueOnce(
        new Map([
          [
            callId,
            createMockCallDoc({
              status: "ringing",
              startedAt: new Date(Date.now() - 120_000),
            }),
          ],
        ])
      );
      mockCallRepo.create.mockResolvedValueOnce(createMockCallDoc());

      await callService.initiateCall(callerId, calleeId, "audio");

      // Entry ma đã được self-heal -> cuộc gọi MỚI tạo thành công
      expect(mockCallRepo.create).toHaveBeenCalled();
    });

    it("tự chữa entry ma: 'answered' treo quá 30 phút -> clear registry và cho gọi mới", async () => {
      callRegistry.setBusy(calleeId, callId);
      mockCallRepo.findByIds.mockResolvedValueOnce(
        new Map([
          [
            callId,
            createMockCallDoc({
              status: "answered",
              answeredAt: new Date(Date.now() - 31 * 60_000), // > 30 phút
            }),
          ],
        ])
      );
      mockCallRepo.create.mockResolvedValueOnce(createMockCallDoc());

      await callService.initiateCall(callerId, calleeId, "video");

      // Stale answered entry đã được self-heal -> cuộc gọi MỚI tạo thành công
      expect(mockCallRepo.create).toHaveBeenCalled();
    });

    it("KHÔNG chữa 'answered' non-stale (< 30 phút) -> vẫn throw ConflictError", async () => {
      callRegistry.setBusy(callerId, callId);
      mockCallRepo.findByIds.mockResolvedValueOnce(
        new Map([
          [
            callId,
            createMockCallDoc({
              status: "answered",
              answeredAt: new Date(Date.now() - 5 * 60_000), // < 30 phút → còn sống
            }),
          ],
        ])
      );

      await expect(
        callService.initiateCall(callerId, calleeId, "audio")
      ).rejects.toThrow("Một trong hai người đang bận một cuộc gọi khác");

      expect(mockCallRepo.create).not.toHaveBeenCalled();
    });

    it("tạo cuộc trò chuyện mới nếu chưa có sẵn cuộc trò chuyện trực tiếp (DIRECT)", async () => {
      mockConvRepo.findDirectBetween.mockResolvedValueOnce(null);
      const mockCreatedCall = createMockCallDoc();
      mockCallRepo.create.mockResolvedValueOnce(mockCreatedCall);

      const res = await callService.initiateCall(callerId, calleeId, "video");

      expect(mockConvRepo.findDirectBetween).toHaveBeenCalledWith(callerId, calleeId);
      expect(mockConvRepo.create).toHaveBeenCalledWith({
        type: "DIRECT",
        participants: [callerId, calleeId],
        createdBy: callerId,
      });
      expect(mockCallRepo.create).toHaveBeenCalledWith({
        conversationId,
        callerId,
        calleeId,
        type: "video",
      });
      expect(callRegistry.isBusy(callerId)).toBe(true);
      expect(callRegistry.isBusy(calleeId)).toBe(true);
      expect(callRegistry.getCallId(callerId)).toBe(callId);
      expect(callRegistry.getCallId(calleeId)).toBe(callId);
      expect(res).toEqual(mockCreatedCall);
    });

    it("tái sử dụng cuộc trò chuyện trực tiếp nếu đã tồn tại", async () => {
      const existingConvId = "507f1f77bcf86cd799439099";
      mockConvRepo.findDirectBetween.mockResolvedValueOnce({
        _id: new Types.ObjectId(existingConvId),
      } as unknown as IConversation);

      const mockCreatedCall = createMockCallDoc({
        conversationId: new Types.ObjectId(existingConvId),
      });
      mockCallRepo.create.mockResolvedValueOnce(mockCreatedCall);

      const res = await callService.initiateCall(callerId, calleeId, "audio");

      expect(mockConvRepo.findDirectBetween).toHaveBeenCalledWith(callerId, calleeId);
      expect(mockConvRepo.create).not.toHaveBeenCalled();
      expect(mockCallRepo.create).toHaveBeenCalledWith({
        conversationId: existingConvId,
        callerId,
        calleeId,
        type: "audio",
      });
      expect(res).toEqual(mockCreatedCall);
    });
  });

  describe("acceptCall", () => {
    it("ném NotFoundError nếu cuộc gọi không tồn tại", async () => {
      mockCallRepo.findById.mockResolvedValueOnce(null);

      await expect(callService.acceptCall("non-existent-call", calleeId)).rejects.toThrow(
        NotFoundError
      );
    });

    it("ném ForbiddenError nếu người gọi cố tình nghe máy thay người nhận", async () => {
      const mockCall = createMockCallDoc();
      mockCallRepo.findById.mockResolvedValueOnce(mockCall);

      await expect(callService.acceptCall(callId, callerId)).rejects.toThrow(
        ForbiddenError
      );
      expect(mockCallRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("ném ConflictError nếu cuộc gọi không ở trạng thái ringing", async () => {
      const mockCall = createMockCallDoc({ status: "answered" });
      mockCallRepo.findById.mockResolvedValueOnce(mockCall);

      await expect(callService.acceptCall(callId, calleeId)).rejects.toThrow(
        ConflictError
      );
      expect(mockCallRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("chấp nhận cuộc gọi thành công và cập nhật status sang answered", async () => {
      const mockCall = createMockCallDoc();
      const updatedDoc = createMockCallDoc({
        status: "answered",
        answeredAt: new Date("2026-09-16T10:00:05.000Z"),
      });

      mockCallRepo.findById.mockResolvedValueOnce(mockCall);
      mockCallRepo.updateStatus.mockResolvedValueOnce(updatedDoc);

      callRegistry.setBusy(callerId, callId);
      callRegistry.setBusy(calleeId, callId);

      const res = await callService.acceptCall(callId, calleeId);

      expect(mockCallRepo.updateStatus).toHaveBeenCalledWith(
        callId,
        "answered",
        expect.objectContaining({
          answeredAt: expect.any(Date),
        })
      );
      expect(res).toEqual(updatedDoc);
      // Khi accept, cả 2 người vẫn phải tiếp tục bận trong registry
      expect(callRegistry.isBusy(callerId)).toBe(true);
      expect(callRegistry.isBusy(calleeId)).toBe(true);
    });
  });

  describe("declineCall", () => {
    it("ném NotFoundError nếu cuộc gọi không tồn tại", async () => {
      mockCallRepo.findById.mockResolvedValueOnce(null);

      await expect(callService.declineCall("bad-id", calleeId)).rejects.toThrow(
        NotFoundError
      );
    });

    it("ném ForbiddenError nếu người thực hiện không phải người nhận", async () => {
      const mockCall = createMockCallDoc();
      mockCallRepo.findById.mockResolvedValueOnce(mockCall);

      await expect(callService.declineCall(callId, callerId)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("ném ConflictError nếu cuộc gọi không ở trạng thái ringing", async () => {
      const mockCall = createMockCallDoc({ status: "ended" });
      mockCallRepo.findById.mockResolvedValueOnce(mockCall);

      await expect(callService.declineCall(callId, calleeId)).rejects.toThrow(
        ConflictError
      );
    });

    it("từ chối cuộc gọi thành công, chuyển sang declined và giải phóng registry", async () => {
      const mockCall = createMockCallDoc();
      const updatedDoc = createMockCallDoc({
        status: "declined",
        endedAt: new Date(),
      });

      mockCallRepo.findById.mockResolvedValueOnce(mockCall);
      mockCallRepo.updateStatus.mockResolvedValueOnce(updatedDoc);

      callRegistry.setBusy(callerId, callId);
      callRegistry.setBusy(calleeId, callId);

      const res = await callService.declineCall(callId, calleeId);

      expect(mockCallRepo.updateStatus).toHaveBeenCalledWith(
        callId,
        "declined",
        expect.objectContaining({
          endedAt: expect.any(Date),
        })
      );
      expect(res).toEqual(updatedDoc);
      // Registry phải giải phóng cả 2 người
      expect(callRegistry.isBusy(callerId)).toBe(false);
      expect(callRegistry.isBusy(calleeId)).toBe(false);
    });
  });

  describe("cancelCall", () => {
    it("ném NotFoundError nếu cuộc gọi không tồn tại", async () => {
      mockCallRepo.findById.mockResolvedValueOnce(null);

      await expect(callService.cancelCall("bad-id", callerId)).rejects.toThrow(
        NotFoundError
      );
    });

    it("ném ForbiddenError nếu người thực hiện không phải người gọi", async () => {
      const mockCall = createMockCallDoc();
      mockCallRepo.findById.mockResolvedValueOnce(mockCall);

      await expect(callService.cancelCall(callId, calleeId)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("ném ConflictError nếu cuộc gọi không ở trạng thái ringing", async () => {
      const mockCall = createMockCallDoc({ status: "answered" });
      mockCallRepo.findById.mockResolvedValueOnce(mockCall);

      await expect(callService.cancelCall(callId, callerId)).rejects.toThrow(
        ConflictError
      );
    });

    it("hủy cuộc gọi thành công, chuyển sang missed và giải phóng registry", async () => {
      const mockCall = createMockCallDoc();
      const updatedDoc = createMockCallDoc({
        status: "missed",
        endedAt: new Date(),
      });

      mockCallRepo.findById.mockResolvedValueOnce(mockCall);
      mockCallRepo.updateStatus.mockResolvedValueOnce(updatedDoc);

      callRegistry.setBusy(callerId, callId);
      callRegistry.setBusy(calleeId, callId);

      const res = await callService.cancelCall(callId, callerId);

      expect(mockCallRepo.updateStatus).toHaveBeenCalledWith(
        callId,
        "missed",
        expect.objectContaining({
          endedAt: expect.any(Date),
        })
      );
      expect(res).toEqual(updatedDoc);
      expect(callRegistry.isBusy(callerId)).toBe(false);
      expect(callRegistry.isBusy(calleeId)).toBe(false);
    });
  });

  describe("endCall", () => {
    it("ném NotFoundError nếu cuộc gọi không tồn tại", async () => {
      mockCallRepo.findById.mockResolvedValueOnce(null);

      await expect(callService.endCall("bad-id", callerId)).rejects.toThrow(
        NotFoundError
      );
    });

    it("ném ForbiddenError nếu người kết thúc không thuộc cuộc gọi", async () => {
      const mockCall = createMockCallDoc();
      mockCallRepo.findById.mockResolvedValueOnce(mockCall);

      const strangerId = "507f1f77bcf86cd799439099";
      await expect(callService.endCall(callId, strangerId)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("trả về bản ghi và giải phóng registry nếu cuộc gọi đã kết thúc trước đó (idempotent)", async () => {
      const mockCall = createMockCallDoc({ status: "ended" });
      mockCallRepo.findById.mockResolvedValueOnce(mockCall);
      callRegistry.setBusy(callerId, callId);
      callRegistry.setBusy(calleeId, callId);

      const result = await callService.endCall(callId, callerId);

      expect(result).toEqual(mockCall);
      expect(callRegistry.isBusy(callerId)).toBe(false);
      expect(callRegistry.isBusy(calleeId)).toBe(false);
      expect(mockCallRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("kết thúc cuộc gọi và tính đúng durationSec khi answeredAt có giá trị", async () => {
      const startTime = new Date("2026-09-16T10:00:00.000Z");
      const answeredTime = new Date("2026-09-16T10:00:10.000Z"); // 10 giây sau khi gọi
      const endTime = new Date("2026-09-16T10:02:10.000Z"); // Đàm thoại đúng 120 giây

      vi.useFakeTimers();
      vi.setSystemTime(endTime);

      const mockCall = createMockCallDoc({
        status: "answered",
        startedAt: startTime,
        answeredAt: answeredTime,
      });

      const updatedDoc = createMockCallDoc({
        status: "ended",
        answeredAt: answeredTime,
        endedAt: endTime,
        durationSec: 120,
      });

      mockCallRepo.findById.mockResolvedValueOnce(mockCall);
      mockCallRepo.updateStatus.mockResolvedValueOnce(updatedDoc);

      callRegistry.setBusy(callerId, callId);
      callRegistry.setBusy(calleeId, callId);

      const res = await callService.endCall(callId, calleeId);

      expect(mockCallRepo.updateStatus).toHaveBeenCalledWith(callId, "ended", {
        endedAt: endTime,
        durationSec: 120,
      });
      expect(res).toEqual(updatedDoc);
      expect(callRegistry.isBusy(callerId)).toBe(false);
      expect(callRegistry.isBusy(calleeId)).toBe(false);

      vi.useRealTimers();
    });

    it("kết thúc cuộc gọi khi chưa nghe máy (answeredAt null) thì durationSec là undefined", async () => {
      const mockCall = createMockCallDoc({
        status: "ringing",
        answeredAt: null,
      });

      const updatedDoc = createMockCallDoc({
        status: "ended",
        answeredAt: null,
        endedAt: new Date(),
        durationSec: null,
      });

      mockCallRepo.findById.mockResolvedValueOnce(mockCall);
      mockCallRepo.updateStatus.mockResolvedValueOnce(updatedDoc);

      callRegistry.setBusy(callerId, callId);
      callRegistry.setBusy(calleeId, callId);

      await callService.endCall(callId, callerId);

      expect(mockCallRepo.updateStatus).toHaveBeenCalledWith(
        callId,
        "ended",
        expect.objectContaining({
          endedAt: expect.any(Date),
          durationSec: undefined,
        })
      );
      expect(callRegistry.isBusy(callerId)).toBe(false);
      expect(callRegistry.isBusy(calleeId)).toBe(false);
    });
  });

  describe("getCallHistory & countMissed", () => {
    it("chuyển tiếp tham số phân trang tới repository khi truy vấn lịch sử cuộc gọi", async () => {
      const mockCalls = [createMockCallDoc()];
      mockCallRepo.findRecentByUser.mockResolvedValueOnce(mockCalls);

      const res = await callService.getCallHistory(callerId, { page: 2, limit: 15 });

      expect(mockCallRepo.findRecentByUser).toHaveBeenCalledWith(callerId, {
        page: 2,
        limit: 15,
      });
      expect(res).toEqual(mockCalls);
    });

    it("chuyển tiếp lời gọi đếm cuộc gọi nhỡ tới repository", async () => {
      mockCallRepo.countMissed.mockResolvedValueOnce(4);

      const count = await callService.countMissed(callerId);

      expect(mockCallRepo.countMissed).toHaveBeenCalledWith(callerId);
      expect(count).toBe(4);
    });
  });
});
