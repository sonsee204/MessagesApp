import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageService } from "../../src/services/message.service";
import { NotFoundError, ForbiddenError, ValidationError } from "../../src/core/errors";

describe("MessageService", () => {
  let service: MessageService;
  const mockMsgRepo: any = {
    create: vi.fn(),
    findById: vi.fn(),
    findByConversationId: vi.fn(),
    softDelete: vi.fn(),
    markAllAsRead: vi.fn(),
  };
  const mockConvRepo: any = {
    findById: vi.fn(),
    updateLastMessage: vi.fn(),
  };
  const mockBlockRepo: any = {
    isBlockedBetween: vi.fn(),
    isBlocked: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new MessageService(mockMsgRepo, mockConvRepo, mockBlockRepo);
  });

  describe("sendMessage", () => {
    it("ném NotFoundError nếu conversation không tồn tại", async () => {
      mockConvRepo.findById.mockResolvedValue(null);

      await expect(
        service.sendMessage({
          conversationId: "conv_1",
          senderId: "u_1",
          content: "Hello",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("ném ForbiddenError nếu sender không phải participant", async () => {
      mockConvRepo.findById.mockResolvedValue({
        id: "conv_1",
        participants: ["u_2", "u_3"],
      });

      await expect(
        service.sendMessage({
          conversationId: "conv_1",
          senderId: "u_1",
          content: "Hello",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("ném ForbiddenError nếu 2 bên trong hội thoại DIRECT bị chặn", async () => {
      mockConvRepo.findById.mockResolvedValue({
        id: "conv_1",
        type: "DIRECT",
        participants: ["u_1", "u_2"],
      });
      mockBlockRepo.isBlockedBetween.mockResolvedValue(true);

      await expect(
        service.sendMessage({
          conversationId: "conv_1",
          senderId: "u_1",
          content: "Hello",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("gửi tin nhắn thành công và cập nhật lastMessage cho cuộc trò chuyện", async () => {
      mockConvRepo.findById.mockResolvedValue({
        id: "conv_1",
        type: "GROUP",
        participants: ["u_1", "u_2", "u_3"],
      });
      const createdMsg = {
        id: "msg_1",
        conversationId: "conv_1",
        senderId: "u_1",
        content: "Hello group",
        createdAt: new Date(),
      };
      mockMsgRepo.create.mockResolvedValue(createdMsg);

      const result = await service.sendMessage({
        conversationId: "conv_1",
        senderId: "u_1",
        content: "Hello group",
      });

      expect(result).toEqual(createdMsg);
      expect(mockMsgRepo.create).toHaveBeenCalled();
      expect(mockConvRepo.updateLastMessage).toHaveBeenCalledWith(
        "conv_1",
        "msg_1",
        createdMsg.createdAt
      );
    });
  });

  describe("getConversationMessages", () => {
    it("ném NotFoundError nếu conversation không tồn tại", async () => {
      mockConvRepo.findById.mockResolvedValue(null);

      await expect(
        service.getConversationMessages("conv_1", "u_1", { limit: 20 })
      ).rejects.toThrow(NotFoundError);
    });

    it("ném ForbiddenError nếu user không phải thành viên cuộc trò chuyện", async () => {
      mockConvRepo.findById.mockResolvedValue({
        id: "conv_1",
        participants: ["u_2", "u_3"],
      });

      await expect(
        service.getConversationMessages("conv_1", "u_1", { limit: 20 })
      ).rejects.toThrow(ForbiddenError);
    });

    it("trả về danh sách tin nhắn và tính toán nextCursor chính xác", async () => {
      mockConvRepo.findById.mockResolvedValue({
        id: "conv_1",
        participants: ["u_1", "u_2"],
      });
      const msg1 = { id: "m1", createdAt: new Date("2026-09-12T10:00:00Z") };
      const msg2 = { id: "m2", createdAt: new Date("2026-09-12T09:00:00Z") };
      const msg3 = { id: "m3", createdAt: new Date("2026-09-12T08:00:00Z") };

      mockMsgRepo.findByConversationId.mockResolvedValue([msg1, msg2, msg3]);

      const result = await service.getConversationMessages("conv_1", "u_1", { limit: 2 });
      expect(result.messages).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe(msg2.createdAt.toISOString());
    });
  });

  describe("recallMessage", () => {
    it("ném NotFoundError nếu tin nhắn không tồn tại", async () => {
      mockMsgRepo.findById.mockResolvedValue(null);

      await expect(
        service.recallMessage("conv_1", "msg_1", "u_1")
      ).rejects.toThrow(NotFoundError);
    });

    it("ném ForbiddenError nếu người thu hồi không phải người gửi tin nhắn", async () => {
      mockMsgRepo.findById.mockResolvedValue({
        id: "msg_1",
        conversationId: "conv_1",
        senderId: { id: "u_2", _id: "u_2" },
        isDeleted: false,
      });

      await expect(
        service.recallMessage("conv_1", "msg_1", "u_1")
      ).rejects.toThrow(ForbiddenError);
    });

    it("ném ValidationError nếu tin nhắn đã được thu hồi trước đó", async () => {
      mockMsgRepo.findById.mockResolvedValue({
        id: "msg_1",
        conversationId: "conv_1",
        senderId: { id: "u_1", _id: "u_1" },
        isDeleted: true,
      });

      await expect(
        service.recallMessage("conv_1", "msg_1", "u_1")
      ).rejects.toThrow(ValidationError);
    });

    it("thu hồi tin nhắn thành công nếu người gọi là chủ sở hữu", async () => {
      mockMsgRepo.findById.mockResolvedValue({
        id: "msg_1",
        conversationId: "conv_1",
        senderId: { id: "u_1", _id: "u_1" },
        isDeleted: false,
      });
      const updated = {
        id: "msg_1",
        isDeleted: true,
      };
      mockMsgRepo.softDelete.mockResolvedValue(updated);

      const result = await service.recallMessage("conv_1", "msg_1", "u_1");
      expect(result.isDeleted).toBe(true);
      expect(mockMsgRepo.softDelete).toHaveBeenCalledWith("msg_1");
    });
  });

  describe("markAsRead", () => {
    it("ném NotFoundError nếu conversation không tồn tại", async () => {
      mockConvRepo.findById.mockResolvedValue(null);

      await expect(service.markAsRead("conv_1", "u_1")).rejects.toThrow(NotFoundError);
    });

    it("ném ForbiddenError nếu user không phải thành viên cuộc trò chuyện", async () => {
      mockConvRepo.findById.mockResolvedValue({
        id: "conv_1",
        participants: ["u_2"],
      });

      await expect(service.markAsRead("conv_1", "u_1")).rejects.toThrow(ForbiddenError);
    });

    it("đánh dấu đã đọc thành công và gọi repository", async () => {
      mockConvRepo.findById.mockResolvedValue({
        id: "conv_1",
        participants: ["u_1", "u_2"],
      });
      mockMsgRepo.markAllAsRead.mockResolvedValue(undefined);

      const result = await service.markAsRead("conv_1", "u_1");
      expect(result.success).toBe(true);
      expect(mockMsgRepo.markAllAsRead).toHaveBeenCalledWith("conv_1", "u_1");
    });
  });
});
