import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import {
  createFriendMiddlewares,
  resolveTargetUserId,
} from "../../src/middlewares/friend";
import { UnauthorizedError, ForbiddenError, ValidationError } from "../../src/core/errors";
import { IFriendRepository } from "../../src/repositories/friend.repository";
import { IBlockRepository } from "../../src/repositories/block.repository";

describe("Friend Middlewares", () => {
  const currentUserId = "507f1f77bcf86cd799439011";
  const targetUserId = "507f1f77bcf86cd799439022";

  let mockFriendRepo: IFriendRepository;
  let mockBlockRepo: IBlockRepository;
  let friendMiddlewares: ReturnType<typeof createFriendMiddlewares>;

  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mockFriendRepo = {
      createFriendship: vi.fn(),
      isFriend: vi.fn().mockResolvedValue(true),
      removeFriendship: vi.fn(),
      findFriends: vi.fn(),
      countFriends: vi.fn(),
    };

    mockBlockRepo = {
      createBlock: vi.fn(),
      removeBlock: vi.fn(),
      isBlocked: vi.fn().mockResolvedValue(false),
      isBlockedBy: vi.fn().mockResolvedValue(false),
      findBlockedUsers: vi.fn(),
    };

    friendMiddlewares = createFriendMiddlewares(mockFriendRepo, mockBlockRepo);

    mockReq = {
      user: {
        userId: currentUserId,
        username: "testuser",
        email: "test@example.com",
      },
      params: { targetUserId },
      body: {},
      query: {},
    };

    mockRes = {};
    next = vi.fn();
  });

  describe("resolveTargetUserId", () => {
    it("trích xuất chính xác targetUserId từ req.params.targetUserId", () => {
      const req = { params: { targetUserId: "user_123" } } as unknown as Request;
      expect(resolveTargetUserId(req)).toBe("user_123");
    });

    it("fallback sang req.params.userId khi không có targetUserId", () => {
      const req = { params: { userId: "user_456" } } as unknown as Request;
      expect(resolveTargetUserId(req)).toBe("user_456");
    });

    it("fallback sang req.body.receiverId khi params rỗng", () => {
      const req = { params: {}, body: { receiverId: "user_789" } } as unknown as Request;
      expect(resolveTargetUserId(req)).toBe("user_789");
    });

    it("fallback sang req.body.targetUserId khi receiverId rỗng", () => {
      const req = { params: {}, body: { targetUserId: "user_abc" } } as unknown as Request;
      expect(resolveTargetUserId(req)).toBe("user_abc");
    });

    it("sử dụng custom string extractor để lấy từ query hoặc params chỉ định", () => {
      const req = {
        params: {},
        body: {},
        query: { friendId: "user_custom_query" },
      } as unknown as Request;
      expect(resolveTargetUserId(req, "friendId")).toBe("user_custom_query");
    });

    it("sử dụng custom function extractor", () => {
      const req = {
        headers: { "x-target-id": "header_user_123" },
      } as unknown as Request;
      const extractor = (r: Request) => r.headers["x-target-id"] as string;
      expect(resolveTargetUserId(req, extractor)).toBe("header_user_123");
    });

    it("trả về undefined nếu không tìm thấy bất kỳ ID nào", () => {
      const req = { params: {}, body: {}, query: {} } as unknown as Request;
      expect(resolveTargetUserId(req)).toBeUndefined();
    });
  });

  describe("preventSelfAction Middleware", () => {
    it("ném lỗi 401 UNAUTHORIZED nếu req.user chưa tồn tại", () => {
      mockReq.user = undefined;
      const middleware = friendMiddlewares.preventSelfAction();

      middleware(mockReq as Request, mockRes as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const err = vi.mocked(next).mock.calls[0][0] as UnauthorizedError;
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe("UNAUTHORIZED");
    });

    it("ném lỗi 400 VALIDATION_ERROR nếu không trích xuất được targetUserId", () => {
      mockReq.params = {};
      const middleware = friendMiddlewares.preventSelfAction();

      middleware(mockReq as Request, mockRes as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const err = vi.mocked(next).mock.calls[0][0] as ValidationError;
      expect(err.message).toContain("Thiếu thông tin ID người dùng mục tiêu");
    });

    it("ném lỗi 400 VALIDATION_ERROR khi targetUserId trùng với currentUserId", () => {
      mockReq.params = { targetUserId: currentUserId };
      const middleware = friendMiddlewares.preventSelfAction();

      middleware(mockReq as Request, mockRes as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const err = vi.mocked(next).mock.calls[0][0] as ValidationError;
      expect(err.message).toContain("Không thể thực hiện hành động này với chính mình");
    });

    it("gọi next() hợp lệ khi currentUserId khác targetUserId", () => {
      const middleware = friendMiddlewares.preventSelfAction();

      middleware(mockReq as Request, mockRes as Response, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("checkNotBlocked Middleware", () => {
    it("ném lỗi 401 UNAUTHORIZED nếu người dùng chưa đăng nhập", async () => {
      mockReq.user = undefined;
      const middleware = friendMiddlewares.checkNotBlocked();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it("ném lỗi 400 VALIDATION_ERROR nếu thiếu targetUserId", async () => {
      mockReq.params = {};
      const middleware = friendMiddlewares.checkNotBlocked();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it("bỏ qua kiểm tra và gọi next() nếu targetUserId trùng currentUserId", async () => {
      mockReq.params = { targetUserId: currentUserId };
      const middleware = friendMiddlewares.checkNotBlocked();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(mockBlockRepo.isBlocked).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });

    it("ném lỗi 403 FORBIDDEN nếu quan hệ giữa 2 người dùng bị chặn", async () => {
      vi.mocked(mockBlockRepo.isBlocked).mockResolvedValue(true);
      const middleware = friendMiddlewares.checkNotBlocked();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(mockBlockRepo.isBlocked).toHaveBeenCalledWith(currentUserId, targetUserId);
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
      const err = vi.mocked(next).mock.calls[0][0] as ForbiddenError;
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
      expect(err.message).toContain("bị chặn");
    });

    it("gọi next() khi không có quan hệ chặn 2 chiều", async () => {
      vi.mocked(mockBlockRepo.isBlocked).mockResolvedValue(false);
      const middleware = friendMiddlewares.checkNotBlocked();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(mockBlockRepo.isBlocked).toHaveBeenCalledWith(currentUserId, targetUserId);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("requireFriendship Middleware", () => {
    it("ném lỗi 401 UNAUTHORIZED nếu người dùng chưa đăng nhập", async () => {
      mockReq.user = undefined;
      const middleware = friendMiddlewares.requireFriendship();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it("ném lỗi 400 VALIDATION_ERROR nếu thiếu targetUserId", async () => {
      mockReq.params = {};
      const middleware = friendMiddlewares.requireFriendship();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it("ném lỗi 403 FORBIDDEN nếu 2 người dùng không phải là bạn bè", async () => {
      vi.mocked(mockFriendRepo.isFriend).mockResolvedValue(false);
      const middleware = friendMiddlewares.requireFriendship();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(mockFriendRepo.isFriend).toHaveBeenCalledWith(currentUserId, targetUserId);
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
      const err = vi.mocked(next).mock.calls[0][0] as ForbiddenError;
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
      expect(err.message).toContain("Yêu cầu quan hệ bạn bè");
    });

    it("gọi next() khi 2 người dùng là bạn bè hợp lệ", async () => {
      vi.mocked(mockFriendRepo.isFriend).mockResolvedValue(true);
      const middleware = friendMiddlewares.requireFriendship();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(mockFriendRepo.isFriend).toHaveBeenCalledWith(currentUserId, targetUserId);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("attachRelationshipStatus Middleware", () => {
    it("ném lỗi 401 UNAUTHORIZED nếu người dùng chưa đăng nhập", async () => {
      mockReq.user = undefined;
      const middleware = friendMiddlewares.attachRelationshipStatus();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it("truy vấn song song và gắn chính xác req.relationship khi chưa ai chặn ai", async () => {
      vi.mocked(mockFriendRepo.isFriend).mockResolvedValue(true);
      vi.mocked(mockBlockRepo.isBlockedBy).mockResolvedValue(false);

      const middleware = friendMiddlewares.attachRelationshipStatus();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(mockReq.relationship).toEqual({
        targetUserId,
        isFriend: true,
        isBlocked: false,
        isBlockedByMe: false,
        isBlockedByTarget: false,
      });
      expect(next).toHaveBeenCalledWith();
    });

    it("gắn chính xác khi người dùng hiện tại đang chặn người dùng mục tiêu", async () => {
      vi.mocked(mockFriendRepo.isFriend).mockResolvedValue(false);
      // isBlockedByMe = true, isBlockedByTarget = false
      vi.mocked(mockBlockRepo.isBlockedBy)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const middleware = friendMiddlewares.attachRelationshipStatus();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(mockReq.relationship).toEqual({
        targetUserId,
        isFriend: false,
        isBlocked: true,
        isBlockedByMe: true,
        isBlockedByTarget: false,
      });
      expect(next).toHaveBeenCalledWith();
    });

    it("gắn chính xác khi người dùng mục tiêu đang chặn người dùng hiện tại", async () => {
      vi.mocked(mockFriendRepo.isFriend).mockResolvedValue(false);
      // isBlockedByMe = false, isBlockedByTarget = true
      vi.mocked(mockBlockRepo.isBlockedBy)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const middleware = friendMiddlewares.attachRelationshipStatus();

      await middleware(mockReq as Request, mockRes as Response, next);

      expect(mockReq.relationship).toEqual({
        targetUserId,
        isFriend: false,
        isBlocked: true,
        isBlockedByMe: false,
        isBlockedByTarget: true,
      });
      expect(next).toHaveBeenCalledWith();
    });
  });
});
