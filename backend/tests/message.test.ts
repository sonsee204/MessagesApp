import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { generateAccessToken } from "../src/utils/auth";
import { messageService } from "../src/services/message.service";
import { userRepository } from "../src/repositories/user.repository";
import { NotFoundError, ForbiddenError } from "../src/core/errors";

/**
 * Kiểm thử tích hợp toàn diện cho Messages API (/api/conversations/:conversationId/messages)
 * Bao phủ đầy đủ:
 * 1. Authentication Guard (Xác thực JWT token)
 * 2. Zod Zero-Trust Validation (Ràng buộc dữ liệu đầu vào params, query, body)
 * 3. Luồng nghiệp vụ gửi tin nhắn văn bản và tệp đính kèm (POST)
 * 4. Luồng phân trang con trỏ (Cursor-based Pagination GET)
 * 5. Luồng thu hồi tin nhắn (Soft delete DELETE)
 * 6. Luồng đánh dấu đã đọc (POST /read)
 * 7. Kiểm soát quyền thành viên và kiểm tra quan hệ chặn (403 Forbidden)
 */
describe("Messages APIs Integration (/api/conversations/:conversationId/messages)", () => {
  const app = createApp();

  // Khởi tạo các ID người dùng và cuộc trò chuyện hợp lệ theo chuẩn ObjectId 24 ký tự hex
  const user1Id = "507f1f77bcf86cd799439011"; // User A (Người gửi tin nhắn)
  const user2Id = "607f1f77bcf86cd799439012"; // User B (Người nhận tin nhắn)
  const user3Id = "707f1f77bcf86cd799439013"; // User C (Người ngoài không thuộc cuộc trò chuyện)
  const conversationId = "507f191e810c19729de860ea"; // ID cuộc trò chuyện
  const messageId = "507f191e810c19729de860eb"; // ID tin nhắn mẫu

  let token1: string;
  let token2: string;
  let token3: string;

  beforeEach(() => {
    vi.restoreAllMocks();

    // Giả lập truy vấn người dùng tồn tại trong CSDL cho middleware requireAuth
    vi.spyOn(userRepository, "findById").mockImplementation(async (id: string) => {
      return {
        _id: id,
        id,
        username: `user_${id}`,
        email: `user_${id}@example.com`,
      } as any;
    });

    // Tạo JWT Access Token hợp lệ cho từng người dùng
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
    token3 = generateAccessToken({
      userId: user3Id,
      username: "user3",
      email: "user3@example.com",
    });
  });

  /* ==========================================================================
     1. KIỂM THỬ XÁC THỰC BẢO VỆ TUYẾN ĐƯỜNG (AUTHENTICATION GUARD)
     ========================================================================== */
  describe("Authentication Guard", () => {
    it("POST /messages trả về 401 UNAUTHORIZED nếu chưa đăng nhập", async () => {
      const res = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .send({ content: "Xin chào!" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("GET /messages trả về 401 UNAUTHORIZED nếu chưa đăng nhập", async () => {
      const res = await request(app).get(`/api/conversations/${conversationId}/messages`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("DELETE /messages/:messageId trả về 401 UNAUTHORIZED nếu chưa đăng nhập", async () => {
      const res = await request(app).delete(
        `/api/conversations/${conversationId}/messages/${messageId}`
      );

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("POST /messages/read trả về 401 UNAUTHORIZED nếu chưa đăng nhập", async () => {
      const res = await request(app).post(`/api/conversations/${conversationId}/messages/read`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  /* ==========================================================================
     2. KIỂM THỬ ZERO-TRUST VALIDATION QUA ZOD SCHEMAS
     ========================================================================== */
  describe("Input Validation (Zod Schemas)", () => {
    it("trả về 400 VALIDATION_ERROR nếu conversationId không phải 24-hex ObjectId", async () => {
      const res = await request(app)
        .post("/api/conversations/invalid-conv-id/messages")
        .set("Authorization", `Bearer ${token1}`)
        .send({ content: "Tin nhắn thử nghiệm" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("trả về 400 VALIDATION_ERROR nếu cả content và attachments đều để trống", async () => {
      const res = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${token1}`)
        .send({ content: "   ", attachments: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("trả về 400 VALIDATION_ERROR nếu nội dung tin nhắn vượt quá 5000 ký tự", async () => {
      const longContent = "a".repeat(5001);
      const res = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${token1}`)
        .send({ content: longContent });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("trả về 400 VALIDATION_ERROR nếu limit truy vấn vượt quá 50", async () => {
      const res = await request(app)
        .get(`/api/conversations/${conversationId}/messages?limit=100`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("trả về 400 VALIDATION_ERROR nếu messageId khi thu hồi không hợp lệ", async () => {
      const res = await request(app)
        .delete(`/api/conversations/${conversationId}/messages/invalid-msg-id`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  /* ==========================================================================
     3. LUỒNG NGHIỆP VỤ TÍCH HỢP TOÀN DIỆN (E2E BUSINESS LOGIC FLOWS)
     ========================================================================== */
  describe("Message Lifecycle & Access Controls", () => {
    it("POST /messages: User A gửi tin nhắn văn bản thành công (201 Created)", async () => {
      const mockCreatedMessage = {
        _id: messageId,
        id: messageId,
        conversationId,
        senderId: {
          id: user1Id,
          username: "user1",
          displayName: "User 1",
        },
        content: "Chào bạn, hôm nay thế nào?",
        type: "TEXT",
        attachments: [],
        isDeleted: false,
        readBy: [user1Id],
        createdAt: new Date().toISOString(),
      };

      vi.spyOn(messageService, "sendMessage").mockResolvedValueOnce(mockCreatedMessage as any);

      const res = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          content: "Chào bạn, hôm nay thế nào?",
          type: "TEXT",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(messageId);
      expect(res.body.data.content).toBe("Chào bạn, hôm nay thế nào?");
      expect(messageService.sendMessage).toHaveBeenCalledWith({
        conversationId,
        senderId: user1Id,
        content: "Chào bạn, hôm nay thế nào?",
        type: "TEXT",
        attachments: [],
        replyToMessageId: undefined,
      });
    });

    it("POST /messages: User A gửi tin nhắn hình ảnh đính kèm thành công (201 Created)", async () => {
      const mockImageMessage = {
        _id: messageId,
        id: messageId,
        conversationId,
        senderId: { id: user1Id, username: "user1" },
        content: "Ảnh chụp kỳ nghỉ",
        type: "IMAGE",
        attachments: [
          {
            url: "https://example.com/vacation.jpg",
            name: "vacation.jpg",
            size: 204800,
            mimeType: "image/jpeg",
          },
        ],
        isDeleted: false,
        createdAt: new Date().toISOString(),
      };

      vi.spyOn(messageService, "sendMessage").mockResolvedValueOnce(mockImageMessage as any);

      const res = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${token1}`)
        .send({
          content: "Ảnh chụp kỳ nghỉ",
          type: "IMAGE",
          attachments: [
            {
              url: "https://example.com/vacation.jpg",
              name: "vacation.jpg",
              size: 204800,
              mimeType: "image/jpeg",
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe("IMAGE");
      expect(res.body.data.attachments).toHaveLength(1);
      expect(res.body.data.attachments[0].name).toBe("vacation.jpg");
    });

    it("POST /messages/read: User B đánh dấu tất cả tin nhắn là đã đọc (200 OK)", async () => {
      vi.spyOn(messageService, "markAsRead").mockResolvedValueOnce({
        success: true,
        readCount: 5,
      });

      const res = await request(app)
        .post(`/api/conversations/${conversationId}/messages/read`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.readCount).toBe(5);
      expect(messageService.markAsRead).toHaveBeenCalledWith(conversationId, user2Id);
    });

    it("GET /messages: User B lấy danh sách tin nhắn kèm phân trang con trỏ (200 OK)", async () => {
      const mockMessages = [
        {
          _id: messageId,
          id: messageId,
          content: "Tin nhắn mới nhất",
          createdAt: new Date().toISOString(),
        },
      ];

      vi.spyOn(messageService, "getConversationMessages").mockResolvedValueOnce({
        messages: mockMessages as any,
        nextCursor: "2026-09-12T10:00:00.000Z",
        hasMore: true,
      });

      const res = await request(app)
        .get(`/api/conversations/${conversationId}/messages?limit=10&cursor=2026-09-12T11:00:00.000Z`)
        .set("Authorization", `Bearer ${token2}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.hasMore).toBe(true);
      expect(res.body.pagination.nextCursor).toBe("2026-09-12T10:00:00.000Z");
      expect(messageService.getConversationMessages).toHaveBeenCalledWith(
        conversationId,
        user2Id,
        { limit: 10, cursor: "2026-09-12T11:00:00.000Z" }
      );
    });

    it("DELETE /messages/:messageId: User A thu hồi tin nhắn thành công (200 OK)", async () => {
      const mockRecalledMessage = {
        _id: messageId,
        id: messageId,
        conversationId,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
      };

      vi.spyOn(messageService, "recallMessage").mockResolvedValueOnce(mockRecalledMessage as any);

      const res = await request(app)
        .delete(`/api/conversations/${conversationId}/messages/${messageId}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDeleted).toBe(true);
      expect(messageService.recallMessage).toHaveBeenCalledWith(
        conversationId,
        messageId,
        user1Id
      );
    });

    it("POST /messages: Người ngoài cuộc trò chuyện (User C) bị từ chối gửi tin nhắn (403 FORBIDDEN)", async () => {
      vi.spyOn(messageService, "sendMessage").mockRejectedValueOnce(
        new ForbiddenError("Bạn không phải thành viên của cuộc trò chuyện này")
      );

      const res = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${token3}`)
        .send({ content: "Tôi muốn tham gia!" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.error.message).toBe("Bạn không phải thành viên của cuộc trò chuyện này");
    });

    it("POST /messages: Người dùng bị chặn bị từ chối gửi tin nhắn (403 FORBIDDEN)", async () => {
      vi.spyOn(messageService, "sendMessage").mockRejectedValueOnce(
        new ForbiddenError("Không thể gửi tin nhắn do quan hệ giữa hai người dùng đã bị chặn")
      );

      const res = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${token1}`)
        .send({ content: "Gửi tin nhắn khi đã bị chặn" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.error.message).toBe(
        "Không thể gửi tin nhắn do quan hệ giữa hai người dùng đã bị chặn"
      );
    });

    it("DELETE /messages/:messageId: Trả về 404 NOT_FOUND nếu tin nhắn không tồn tại", async () => {
      vi.spyOn(messageService, "recallMessage").mockRejectedValueOnce(
        new NotFoundError("Không tìm thấy tin nhắn")
      );

      const res = await request(app)
        .delete(`/api/conversations/${conversationId}/messages/${messageId}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });
});
