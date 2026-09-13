import { describe, it, expect, beforeEach, vi } from "vitest";
import { FriendService } from "../../src/services/friend.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../src/core/errors";

describe("FriendService Business Logic", () => {
  let friendService: FriendService;
  let mockFriendRequestRepo: any;
  let mockFriendRepo: any;
  let mockBlockRepo: any;
  let mockUserRepo: any;
  let mockNotifService: any;

  beforeEach(() => {
    mockFriendRequestRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findPending: vi.fn(),
      updateStatus: vi.fn(),
      findReceived: vi.fn(),
      findSent: vi.fn(),
      cancelPendingBetween: vi.fn(),
    };
    mockFriendRepo = {
      createFriendship: vi.fn(),
      isFriend: vi.fn(),
      removeFriendship: vi.fn(),
      findFriends: vi.fn(),
      countFriends: vi.fn(),
    };
    mockBlockRepo = {
      createBlock: vi.fn(),
      removeBlock: vi.fn(),
      isBlocked: vi.fn(),
      isBlockedBy: vi.fn(),
      findBlockedUsers: vi.fn(),
    };
    mockUserRepo = {
      findById: vi.fn(),
    };
    mockNotifService = {
      createNotification: vi.fn().mockResolvedValue({} as any),
      getUserNotifications: vi.fn(),
      markNotificationAsRead: vi.fn(),
      markAllNotificationsAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    };

    friendService = new FriendService(
      mockFriendRequestRepo,
      mockFriendRepo,
      mockBlockRepo,
      mockUserRepo,
      mockNotifService
    );
  });

  describe("sendFriendRequest()", () => {
    it("ném lỗi nếu gửi lời mời cho chính mình", async () => {
      await expect(
        friendService.sendFriendRequest("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439011")
      ).rejects.toThrow(ValidationError);
    });

    it("ném lỗi nếu người nhận không tồn tại", async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        friendService.sendFriendRequest("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012")
      ).rejects.toThrow(NotFoundError);
    });

    it("ném lỗi nếu bị chặn (isBlocked = true)", async () => {
      mockUserRepo.findById.mockResolvedValue({ id: "user2" });
      mockBlockRepo.isBlocked.mockResolvedValue(true);

      await expect(
        friendService.sendFriendRequest("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012")
      ).rejects.toThrow(ForbiddenError);
    });

    it("ném lỗi nếu đã là bạn bè (isFriend = true)", async () => {
      mockUserRepo.findById.mockResolvedValue({ id: "user2" });
      mockBlockRepo.isBlocked.mockResolvedValue(false);
      mockFriendRepo.isFriend.mockResolvedValue(true);

      await expect(
        friendService.sendFriendRequest("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012")
      ).rejects.toThrow(ConflictError);
    });

    it("tạo lời mời thành công khi thỏa mãn tất cả điều kiện", async () => {
      mockUserRepo.findById.mockResolvedValue({ id: "user2" });
      mockBlockRepo.isBlocked.mockResolvedValue(false);
      mockFriendRepo.isFriend.mockResolvedValue(false);
      mockFriendRequestRepo.findPending.mockResolvedValue(null);
      mockFriendRequestRepo.create.mockResolvedValue({ id: "req1", status: "PENDING" });

      const res = await friendService.sendFriendRequest(
        "507f1f77bcf86cd799439011",
        "507f1f77bcf86cd799439012",
        "Chào bạn"
      );
      expect(res.id).toBe("req1");
      expect(mockFriendRequestRepo.create).toHaveBeenCalled();
      expect(mockNotifService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: "507f1f77bcf86cd799439012",
          type: "FRIEND_REQUEST_RECEIVED",
        })
      );
    });
  });

  describe("getRelationshipStatus()", () => {
    it("trả về NONE nếu chưa có quan hệ gì", async () => {
      mockBlockRepo.isBlocked.mockResolvedValue(false);
      mockFriendRepo.isFriend.mockResolvedValue(false);
      mockFriendRequestRepo.findPending.mockResolvedValue(null);

      const res = await friendService.getRelationshipStatus("u1", "u2");
      expect(res.status).toBe("NONE");
    });

    it("trả về BLOCKED nếu có chiều chặn", async () => {
      mockBlockRepo.isBlocked.mockResolvedValue(true);
      const res = await friendService.getRelationshipStatus("u1", "u2");
      expect(res.status).toBe("BLOCKED");
    });

    it("trả về FRIENDS nếu đã là bạn bè", async () => {
      mockBlockRepo.isBlocked.mockResolvedValue(false);
      mockFriendRepo.isFriend.mockResolvedValue(true);
      const res = await friendService.getRelationshipStatus("u1", "u2");
      expect(res.status).toBe("FRIENDS");
    });
  });
});
