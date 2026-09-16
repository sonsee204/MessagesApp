import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { Request, Response, NextFunction } from "express";
import request from "supertest";

// Mock middleware requireAuth để giả lập phiên đăng nhập người dùng
vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      userId: "user_test_123",
      email: "user@example.com",
      username: "testuser",
    };
    next();
  },
}));

// Mock CallService
vi.mock("../services/call.service", () => ({
  callService: {
    getCallHistory: vi.fn(),
    countMissed: vi.fn(),
  },
  CallService: vi.fn(),
}));

// Mock DeviceTokenRepository
vi.mock("../repositories/device-token.repository", () => ({
  deviceTokenRepository: {
    upsert: vi.fn(),
    deleteByToken: vi.fn(),
    findByUserId: vi.fn(),
  },
  MongooseDeviceTokenRepository: vi.fn(),
}));

import { callRoutes } from "../routes/call.routes";
import { callService } from "../services/call.service";
import { deviceTokenRepository } from "../repositories/device-token.repository";
import { errorHandler } from "../middlewares/error-handler";
import { CallController } from "./call.controller";

/**
 * Khởi tạo ứng dụng Express giả lập để kiểm thử API endpoints
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/calls", callRoutes);
  app.use(errorHandler);
  return app;
}

describe("CallController & Routes Integration Tests", () => {
  const app = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /calls (Lịch sử cuộc gọi)", () => {
    it("trả về 200 và danh sách cuộc gọi với phân trang mặc định (page=1, limit=20)", async () => {
      const mockCalls = [
        {
          _id: "call_1",
          callerId: "user_test_123",
          calleeId: "user_other_456",
          type: "video",
          status: "ended",
        },
      ];
      vi.mocked(callService.getCallHistory).mockResolvedValueOnce(
        mockCalls as unknown as Awaited<ReturnType<typeof callService.getCallHistory>>
      );

      const res = await request(app).get("/calls");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: mockCalls,
      });
      expect(callService.getCallHistory).toHaveBeenCalledWith("user_test_123", {
        page: 1,
        limit: 20,
      });
    });

    it("truyền đúng tham số phân trang page và limit tùy chỉnh", async () => {
      vi.mocked(callService.getCallHistory).mockResolvedValueOnce([]);

      const res = await request(app).get("/calls?page=3&limit=50");

      expect(res.status).toBe(200);
      expect(callService.getCallHistory).toHaveBeenCalledWith("user_test_123", {
        page: 3,
        limit: 50,
      });
    });

    it("trả về 400 ValidationError khi tham số page âm (page=-1)", async () => {
      const res = await request(app).get("/calls?page=-1");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(callService.getCallHistory).not.toHaveBeenCalled();
    });

    it("trả về 400 ValidationError khi limit vượt quá 100", async () => {
      const res = await request(app).get("/calls?limit=101");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(callService.getCallHistory).not.toHaveBeenCalled();
    });
  });

  describe("GET /calls/missed-count (Số lượng cuộc gọi nhỡ)", () => {
    it("trả về 200 và số lượng cuộc gọi nhỡ", async () => {
      vi.mocked(callService.countMissed).mockResolvedValueOnce(4);

      const res = await request(app).get("/calls/missed-count");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { count: 4 },
      });
      expect(callService.countMissed).toHaveBeenCalledWith("user_test_123");
    });
  });

  describe("POST /calls/device-tokens (Đăng ký token thiết bị)", () => {
    it("trả về 201 khi dữ liệu hợp lệ và gọi repository upsert đúng", async () => {
      const mockResult = {
        _id: "token_doc_1",
        userId: "user_test_123",
        token: "fcm_token_abc_xyz",
        platform: "android",
      };
      vi.mocked(deviceTokenRepository.upsert).mockResolvedValueOnce(
        mockResult as unknown as Awaited<ReturnType<typeof deviceTokenRepository.upsert>>
      );

      const res = await request(app)
        .post("/calls/device-tokens")
        .send({ token: "fcm_token_abc_xyz", platform: "android" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        success: true,
        data: mockResult,
      });
      expect(deviceTokenRepository.upsert).toHaveBeenCalledWith({
        userId: "user_test_123",
        token: "fcm_token_abc_xyz",
        platform: "android",
      });
    });

    it("trả về 400 ValidationError khi platform không hợp lệ", async () => {
      const res = await request(app)
        .post("/calls/device-tokens")
        .send({ token: "fcm_token_abc_xyz", platform: "windows" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(deviceTokenRepository.upsert).not.toHaveBeenCalled();
    });

    it("trả về 400 ValidationError khi thiếu token", async () => {
      const res = await request(app)
        .post("/calls/device-tokens")
        .send({ platform: "ios" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(deviceTokenRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /calls/device-tokens (Hủy đăng ký token)", () => {
    it("trả về 200 khi xóa token thành công", async () => {
      vi.mocked(deviceTokenRepository.deleteByToken).mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete("/calls/device-tokens")
        .send({ token: "fcm_token_abc_xyz" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(deviceTokenRepository.deleteByToken).toHaveBeenCalledWith("fcm_token_abc_xyz");
    });

    it("trả về 400 ValidationError khi thiếu token trong body", async () => {
      const res = await request(app)
        .delete("/calls/device-tokens")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(deviceTokenRepository.deleteByToken).not.toHaveBeenCalled();
    });
  });

  describe("Unit Error Handling trong CallController", () => {
    it("chuyển lỗi từ service sang middleware xử lý lỗi tiếp theo (next)", async () => {
      const customCallService = {
        getCallHistory: vi.fn().mockRejectedValue(new Error("Database failure")),
        countMissed: vi.fn(),
      };
      const controller = new CallController(
        customCallService as unknown as typeof callService,
        deviceTokenRepository
      );

      const mockReq = {
        user: { userId: "user_test_123" },
        query: { page: 1, limit: 10 },
      } as unknown as Request;
      const mockRes = {} as Response;
      const mockNext = vi.fn();

      await controller.getCallHistory(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
