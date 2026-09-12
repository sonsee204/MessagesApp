import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { generateAccessToken } from "../src/utils/auth";
import { friendService } from "../src/services/friend.service";
import { userRepository } from "../src/repositories/user.repository";

describe("Friend APIs Integration (/api/friends)", () => {
  const app = createApp();
  const user1Id = "507f1f77bcf86cd799439011";
  const user2Id = "607f1f77bcf86cd799439012";
  let token1: string;
  let token2: string;

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(userRepository, "findById").mockImplementation(async (id: string) => {
      return {
        _id: id,
        id,
        username: `user_${id}`,
        email: `user_${id}@example.com`,
      } as any;
    });

    token1 = generateAccessToken({
      userId: user1Id,
      username: "user1",
      email: "user1@example.com",
    });
    token2 = generateAccessToken({
      userId: user2Id,
      username: "user2",
      email: "user2@example.com",
    });
  });

  describe("Authentication Guard", () => {
    it("trả về 401 UNAUTHORIZED nếu gọi API khi chưa đăng nhập", async () => {
      const res = await request(app).get("/api/friends");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Validation Errors", () => {
    it("POST /api/friends/requests trả về 400 nếu receiverId sai định dạng ObjectId", async () => {
      const res = await request(app)
        .post("/api/friends/requests")
        .set("Authorization", `Bearer ${token1}`)
        .send({ receiverId: "invalid-id" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("POST /api/friends/requests trả về 400 nếu note vượt quá 200 ký tự", async () => {
      const res = await request(app)
        .post("/api/friends/requests")
        .set("Authorization", `Bearer ${token1}`)
        .send({ receiverId: user2Id, note: "x".repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Friends & Blocks Listing", () => {
    it("GET /api/friends trả về 200 OK và danh sách bạn bè phân trang", async () => {
      vi.spyOn(friendService, "getFriends").mockResolvedValueOnce({
        items: [
          {
            friendshipId: "friendship1",
            friendSince: new Date(),
            user: {
              id: user2Id,
              username: "user2",
              displayName: "User 2",
              isOnline: true,
              lastSeenAt: new Date(),
            },
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });

      const res = await request(app)
        .get("/api/friends?page=1&limit=10")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data).toHaveProperty("pagination");
      expect(res.body.data.items).toHaveLength(1);
    });

    it("GET /api/friends/blocks trả về 200 OK và danh sách người bị chặn", async () => {
      vi.spyOn(friendService, "getBlockedUsers").mockResolvedValueOnce({
        items: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 1,
        },
      });

      const res = await request(app)
        .get("/api/friends/blocks")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data).toHaveProperty("pagination");
    });

    it("GET /api/friends/status/:targetUserId trả về trạng thái quan hệ hợp lệ", async () => {
      vi.spyOn(friendService, "getRelationshipStatus").mockResolvedValueOnce({
        targetUserId: user2Id,
        status: "NONE",
      });

      const res = await request(app)
        .get(`/api/friends/status/${user2Id}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetUserId).toBe(user2Id);
      expect(res.body.data.status).toBe("NONE");
    });
  });

  describe("Friend Request Lifecycle", () => {
    const requestId = "707f1f77bcf86cd799439013";

    it("POST /api/friends/requests tạo lời mời kết bạn thành công", async () => {
      vi.spyOn(friendService, "sendFriendRequest").mockResolvedValueOnce({
        _id: requestId,
        id: requestId,
        senderId: user1Id as any,
        receiverId: user2Id as any,
        status: "PENDING",
        note: "Hello",
      } as any);

      const res = await request(app)
        .post("/api/friends/requests")
        .set("Authorization", `Bearer ${token1}`)
        .send({ receiverId: user2Id, note: "Hello" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(requestId);
    });

    it("GET /api/friends/requests/received trả về danh sách lời mời nhận được", async () => {
      vi.spyOn(friendService, "getReceivedRequests").mockResolvedValueOnce({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });

      const res = await request(app)
        .get("/api/friends/requests/received")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("items");
    });

    it("GET /api/friends/requests/sent trả về danh sách lời mời đã gửi", async () => {
      vi.spyOn(friendService, "getSentRequests").mockResolvedValueOnce({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });

      const res = await request(app)
        .get("/api/friends/requests/sent")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("items");
    });

    it("POST /api/friends/requests/:requestId/accept chấp nhận lời mời", async () => {
      vi.spyOn(friendService, "acceptFriendRequest").mockResolvedValueOnce({
        friendshipId: "fs1",
        friend: { id: user1Id, username: "user1" },
        acceptedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/friends/requests/${requestId}/accept`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.friendshipId).toBe("fs1");
    });

    it("POST /api/friends/requests/:requestId/reject từ chối lời mời", async () => {
      vi.spyOn(friendService, "rejectFriendRequest").mockResolvedValueOnce();

      const res = await request(app)
        .post(`/api/friends/requests/${requestId}/reject`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Đã từ chối lời mời kết bạn");
    });

    it("DELETE /api/friends/requests/:requestId/cancel hủy lời mời", async () => {
      vi.spyOn(friendService, "cancelFriendRequest").mockResolvedValueOnce();

      const res = await request(app)
        .delete(`/api/friends/requests/${requestId}/cancel`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Đã hủy lời mời kết bạn");
    });
  });

  describe("Block & Unfriend Actions", () => {
    it("POST /api/friends/blocks/:targetUserId chặn người dùng", async () => {
      vi.spyOn(friendService, "blockUser").mockResolvedValueOnce();

      const res = await request(app)
        .post(`/api/friends/blocks/${user2Id}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Đã chặn người dùng thành công");
    });

    it("DELETE /api/friends/blocks/:targetUserId bỏ chặn người dùng", async () => {
      vi.spyOn(friendService, "unblockUser").mockResolvedValueOnce();

      const res = await request(app)
        .delete(`/api/friends/blocks/${user2Id}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Đã bỏ chặn người dùng thành công");
    });

    it("DELETE /api/friends/:targetUserId hủy kết bạn", async () => {
      vi.spyOn(friendService, "removeFriend").mockResolvedValueOnce();

      const res = await request(app)
        .delete(`/api/friends/${user2Id}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Đã hủy kết bạn thành công");
    });
  });
});
