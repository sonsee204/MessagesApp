import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

// Mock CallModel trước khi import callRepository
vi.mock("../models/call.model", () => {
  return {
    CallModel: {
      create: vi.fn(),
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
      find: vi.fn(),
      countDocuments: vi.fn(),
    },
  };
});

import { CallModel, ICall } from "../models/call.model";
import { callRepository } from "./call.repository";

describe("CallRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCallDoc = {
    _id: new Types.ObjectId("507f1f77bcf86cd799439011"),
    conversationId: new Types.ObjectId("507f1f77bcf86cd799439012"),
    callerId: new Types.ObjectId("507f1f77bcf86cd799439013"),
    calleeId: new Types.ObjectId("507f1f77bcf86cd799439014"),
    type: "video",
    status: "ringing",
    startedAt: new Date("2026-09-16T10:00:00.000Z"),
    answeredAt: null,
    endedAt: null,
    durationSec: null,
  } as unknown as ICall;

  describe("create", () => {
    it("tạo cuộc gọi với trạng thái mặc định ringing và startedAt hợp lệ", async () => {
      vi.mocked(CallModel.create).mockResolvedValueOnce(mockCallDoc as never);

      const res = await callRepository.create({
        conversationId: "507f1f77bcf86cd799439012",
        callerId: "507f1f77bcf86cd799439013",
        calleeId: "507f1f77bcf86cd799439014",
        type: "video",
      });

      expect(CallModel.create).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(CallModel.create).mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.status).toBe("ringing");
      expect(callArgs.type).toBe("video");
      expect(callArgs.startedAt).toBeInstanceOf(Date);
      expect(callArgs.conversationId).toBeInstanceOf(Types.ObjectId);
      expect(callArgs.callerId).toBeInstanceOf(Types.ObjectId);
      expect(callArgs.calleeId).toBeInstanceOf(Types.ObjectId);
      expect(res).toEqual(mockCallDoc);
    });
  });

  describe("findById", () => {
    it("tìm cuộc gọi theo ID trả về tài liệu hợp lệ", async () => {
      vi.mocked(CallModel.findById).mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(mockCallDoc),
      } as unknown as ReturnType<typeof CallModel.findById>);

      const res = await callRepository.findById("507f1f77bcf86cd799439011");

      expect(CallModel.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
      expect(res).toEqual(mockCallDoc);
    });

    it("trả về null nếu không tìm thấy cuộc gọi", async () => {
      vi.mocked(CallModel.findById).mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(null),
      } as unknown as ReturnType<typeof CallModel.findById>);

      const res = await callRepository.findById("507f1f77bcf86cd799439099");
      expect(res).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("cập nhật trạng thái và các trường patch (answeredAt, endedAt, durationSec)", async () => {
      const answeredAt = new Date("2026-09-16T10:01:00.000Z");
      const endedAt = new Date("2026-09-16T10:05:00.000Z");
      const updatedDoc = {
        ...mockCallDoc,
        status: "ended",
        answeredAt,
        endedAt,
        durationSec: 240,
      } as unknown as ICall;

      vi.mocked(CallModel.findByIdAndUpdate).mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(updatedDoc),
      } as unknown as ReturnType<typeof CallModel.findByIdAndUpdate>);

      const res = await callRepository.updateStatus("507f1f77bcf86cd799439011", "ended", {
        answeredAt,
        endedAt,
        durationSec: 240,
      });

      expect(CallModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        {
          $set: {
            status: "ended",
            answeredAt,
            endedAt,
            durationSec: 240,
          },
        },
        { new: true }
      );
      expect(res).toEqual(updatedDoc);
    });
  });

  describe("findRecentByUser", () => {
    it("truy vấn cuộc gọi của người dùng theo cả callerId và calleeId kèm phân trang", async () => {
      const mockChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([mockCallDoc]),
      };

      vi.mocked(CallModel.find).mockReturnValueOnce(
        mockChain as unknown as ReturnType<typeof CallModel.find>
      );

      const userId = "507f1f77bcf86cd799439013";
      const res = await callRepository.findRecentByUser(userId, { page: 2, limit: 10 });

      expect(CallModel.find).toHaveBeenCalledWith({
        $or: [
          { callerId: new Types.ObjectId(userId) },
          { calleeId: new Types.ObjectId(userId) },
        ],
      });
      expect(mockChain.sort).toHaveBeenCalledWith({ startedAt: -1 });
      expect(mockChain.skip).toHaveBeenCalledWith(10);
      expect(mockChain.limit).toHaveBeenCalledWith(10);
      expect(res).toEqual([mockCallDoc]);
    });

    it("sử dụng giá trị phân trang mặc định khi không truyền options", async () => {
      const mockChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([]),
      };

      vi.mocked(CallModel.find).mockReturnValueOnce(
        mockChain as unknown as ReturnType<typeof CallModel.find>
      );

      const userId = "507f1f77bcf86cd799439013";
      await callRepository.findRecentByUser(userId);

      expect(mockChain.skip).toHaveBeenCalledWith(0);
      expect(mockChain.limit).toHaveBeenCalledWith(20);
    });
  });

  describe("countMissed", () => {
    it("đếm chính xác số lượng cuộc gọi nhỡ liên quan đến người dùng", async () => {
      vi.mocked(CallModel.countDocuments).mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(3),
      } as unknown as ReturnType<typeof CallModel.countDocuments>);

      const userId = "507f1f77bcf86cd799439013";
      const count = await callRepository.countMissed(userId);

      expect(CallModel.countDocuments).toHaveBeenCalledWith({
        status: "missed",
        $or: [
          { callerId: new Types.ObjectId(userId) },
          { calleeId: new Types.ObjectId(userId) },
        ],
      });
      expect(count).toBe(3);
    });
  });
});
