import mongoose from "mongoose";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FriendService } from "../../src/services/friend.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../src/core/errors";
import * as socketModule from "../../src/socket";

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

    it("trả về blockedByMe = false khi ĐỐI PHƯƠNG chặn mình (chiều chặn có hướng)", async () => {
      // isBlocked 2 chiều = true nhưng chiều "mình chặn đối phương" = false
      mockBlockRepo.isBlocked.mockResolvedValue(true);
      mockBlockRepo.isBlockedBy.mockResolvedValue(false);

      const res = await friendService.getRelationshipStatus("u1", "u2");

      expect(res.status).toBe("BLOCKED");
      expect(res.blockedByMe).toBe(false);
      expect(mockBlockRepo.isBlockedBy).toHaveBeenCalledWith("u1", "u2");
    });

    it("trả về blockedByMe = true khi CHÍNH MÌNH là bên chặn đối phương", async () => {
      mockBlockRepo.isBlocked.mockResolvedValue(true);
      mockBlockRepo.isBlockedBy.mockResolvedValue(true);

      const res = await friendService.getRelationshipStatus("u1", "u2");

      expect(res.status).toBe("BLOCKED");
      expect(res.blockedByMe).toBe(true);
    });
  });

  describe("Socket.IO Real-time Events Emission", () => {
    let emitToUserSpy: any;

    beforeEach(() => {
      emitToUserSpy = vi.spyOn(socketModule, "emitToUser").mockImplementation(() => {});
      vi.spyOn(mongoose, "startSession").mockResolvedValue({
        withTransaction: vi.fn().mockImplementation(async (cb) => cb()),
        endSession: vi.fn(),
      } as any);
    });

    it("phát sự kiện friend:request_received kèm hồ sơ người gửi đã POPULATE và note", async () => {
      // Hồ sơ người gửi phải là object đã populate (có displayName/username), KHÔNG phải ObjectId thô,
      // để store phía client hiển thị đúng tên trong toast lời mời kết bạn.
      const senderUser = {
        _id: "u1",
        id: "u1",
        username: "alice",
        displayName: "Alice Nguyen",
      };
      mockUserRepo.findById.mockResolvedValue(senderUser);
      mockBlockRepo.isBlocked.mockResolvedValue(false);
      mockFriendRepo.isFriend.mockResolvedValue(false);
      mockFriendRequestRepo.findPending.mockResolvedValue(null);
      mockFriendRequestRepo.create.mockResolvedValue({
        _id: "req1",
        senderId: "u1",
        receiverId: "u2",
        note: "Hello",
      });

      await friendService.sendFriendRequest("u1", "u2", "Hello");

      expect(emitToUserSpy).toHaveBeenCalledWith(
        "u2",
        "friend:request_received",
        expect.objectContaining({
          _id: "req1",
          note: "Hello",
          // senderId và sender đều phải mang hồ sơ đã populate
          senderId: expect.objectContaining({
            displayName: "Alice Nguyen",
            username: "alice",
          }),
          sender: expect.objectContaining({
            displayName: "Alice Nguyen",
            username: "alice",
          }),
        })
      );
    });

    it("phát sự kiện friend:request_accepted cho cả người gửi và người nhận khi chấp nhận kết bạn", async () => {
      mockFriendRequestRepo.findById.mockResolvedValue({
        _id: "req1",
        senderId: { toString: () => "u1" },
        receiverId: { toString: () => "u2" },
        status: "PENDING",
      });
      mockFriendRepo.createFriendship.mockResolvedValue({ _id: "fs1" });
      mockUserRepo.findById.mockImplementation(async (id: string) => ({
        id,
        displayName: `User ${id}`,
      }));

      await friendService.acceptFriendRequest("u2", "req1");

      expect(emitToUserSpy).toHaveBeenCalledWith("u1", "friend:request_accepted", expect.objectContaining({
        friendshipId: "fs1",
      }));
      expect(emitToUserSpy).toHaveBeenCalledWith("u2", "friend:request_accepted", expect.objectContaining({
        friendshipId: "fs1",
      }));
    });

    it("phát sự kiện friend:request_rejected khi từ chối lời mời kết bạn", async () => {
      mockFriendRequestRepo.findById.mockResolvedValue({
        _id: "req1",
        senderId: { toString: () => "u1" },
        receiverId: { toString: () => "u2" },
        status: "PENDING",
      });

      await friendService.rejectFriendRequest("u2", "req1");

      expect(emitToUserSpy).toHaveBeenCalledWith("u1", "friend:request_rejected", {
        requestId: "req1",
        receiverId: "u2",
      });
    });

    it("phát sự kiện friend:request_canceled khi người gửi hủy lời mời kết bạn", async () => {
      mockFriendRequestRepo.findById.mockResolvedValue({
        _id: "req1",
        senderId: { toString: () => "u1" },
        receiverId: { toString: () => "u2" },
        status: "PENDING",
      });

      await friendService.cancelFriendRequest("u1", "req1");

      expect(emitToUserSpy).toHaveBeenCalledWith("u2", "friend:request_canceled", {
        requestId: "req1",
        senderId: "u1",
      });
    });

    it("phát sự kiện friend:removed khi hủy quan hệ bạn bè", async () => {
      mockFriendRepo.isFriend.mockResolvedValue(true);

      await friendService.removeFriend("u1", "u2");

      expect(emitToUserSpy).toHaveBeenCalledWith("u2", "friend:removed", {
        userId: "u1",
      });
    });

    it("phát sự kiện friend:blocked khi chặn một người dùng", async () => {
      mockUserRepo.findById.mockResolvedValue({ id: "u2" });
      mockBlockRepo.isBlockedBy.mockResolvedValue(false);

      await friendService.blockUser("u1", "u2");

      expect(emitToUserSpy).toHaveBeenCalledWith("u2", "friend:blocked", {
        blockerId: "u1",
      });
    });
  });

  describe("Transaction Fallback Handling", () => {
    let mockSession: any;

    beforeEach(() => {
      mockSession = {
        withTransaction: vi.fn(),
        endSession: vi.fn(),
      };
      vi.spyOn(mongoose, "startSession").mockResolvedValue(mockSession);
    });

    it("tự động fallback thực thi không transaction khi MongoDB standalone báo lỗi replica set trong acceptFriendRequest", async () => {
      // Giả lập trạng thái kết nối CSDL sẵn sàng
      vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(1);

      // Giả lập withTransaction ném lỗi MongoDB standalone (không replica set)
      mockSession.withTransaction.mockRejectedValueOnce(
        new Error("Transaction numbers are only allowed on a replica set member or mongos")
      );

      mockFriendRequestRepo.findById.mockResolvedValue({
        _id: "req1",
        senderId: { toString: () => "u1" },
        receiverId: { toString: () => "u2" },
        status: "PENDING",
      });
      mockFriendRepo.createFriendship.mockResolvedValue({ _id: "fs_fallback" });
      mockUserRepo.findById.mockImplementation(async (id: string) => ({
        id,
        displayName: `User ${id}`,
      }));

      const result = await friendService.acceptFriendRequest("u2", "req1");

      // Kiểm tra kết quả thành công qua nhánh fallback
      expect(result.friendshipId).toBe("fs_fallback");
      expect(mockSession.endSession).toHaveBeenCalled();
      // Xác nhận các thao tác repo vẫn được gọi với session = undefined trong fallback
      expect(mockFriendRequestRepo.updateStatus).toHaveBeenCalledWith(
        "req1",
        "ACCEPTED",
        expect.any(Date),
        undefined
      );
      expect(mockFriendRepo.createFriendship).toHaveBeenCalledWith(
        "u1",
        "u2",
        "req1",
        undefined
      );
    });

    it("tự động fallback thực thi không transaction khi MongoDB standalone báo lỗi replica set trong blockUser", async () => {
      // Giả lập trạng thái kết nối CSDL sẵn sàng
      vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(1);

      // Giả lập withTransaction ném lỗi standalone
      mockSession.withTransaction.mockRejectedValueOnce(
        new Error("This MongoDB deployment does not support replica set transactions")
      );

      mockUserRepo.findById.mockResolvedValue({ id: "u2" });
      mockBlockRepo.isBlockedBy.mockResolvedValue(false);

      await friendService.blockUser("u1", "u2");

      expect(mockSession.endSession).toHaveBeenCalled();
      // Xác nhận repo thao tác không truyền session trong fallback
      expect(mockBlockRepo.createBlock).toHaveBeenCalledWith("u1", "u2", undefined);
      expect(mockFriendRepo.removeFriendship).toHaveBeenCalledWith("u1", "u2", undefined);
      expect(mockFriendRequestRepo.cancelPendingBetween).toHaveBeenCalledWith("u1", "u2", undefined);
    });

    it("ném lại lỗi nếu lỗi phát sinh trong transaction không phải lỗi replica set", async () => {
      vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(1);

      const dbError = new Error("Lỗi kết nối cơ sở dữ liệu ngẫu nhiên");
      mockSession.withTransaction.mockRejectedValueOnce(dbError);

      mockUserRepo.findById.mockResolvedValue({ id: "u2" });
      mockBlockRepo.isBlockedBy.mockResolvedValue(false);

      await expect(friendService.blockUser("u1", "u2")).rejects.toThrow(
        "Lỗi kết nối cơ sở dữ liệu ngẫu nhiên"
      );
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
