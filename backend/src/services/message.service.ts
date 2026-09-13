import mongoose from "mongoose";
import { IMessageRepository, messageRepository } from "../repositories/message.repository";
import {
  IConversationRepository,
  conversationRepository,
} from "../repositories/conversation.repository";
import { IBlockRepository, blockRepository } from "../repositories/block.repository";
import { IMessage, IAttachment } from "../models/message.model";
import { NotFoundError, ForbiddenError, ValidationError } from "../core/errors";
import { emitToConversation } from "../socket";

/**
 * Cấu trúc phân trang danh sách tin nhắn theo con trỏ thời gian (Cursor-based Pagination)
 */
export interface PaginatedMessages {
  messages: IMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Service xử lý toàn bộ logic nghiệp vụ tin nhắn (Message Service Layer)
 * Đảm bảo Zero-Trust Validation, kiểm tra quan hệ chặn (Block check),
 * MongoDB Multi-Document Transactions và phát sự kiện Realtime Socket.IO.
 */
export class MessageService {
  constructor(
    private msgRepo: IMessageRepository = messageRepository,
    private convRepo: IConversationRepository = conversationRepository,
    private blockRepo: IBlockRepository = blockRepository
  ) {}

  /**
   * Gửi tin nhắn mới vào cuộc trò chuyện
   * 1. Kiểm tra sự tồn tại của cuộc trò chuyện
   * 2. Kiểm tra tư cách thành viên của người gửi
   * 3. Kiểm tra quan hệ chặn 2 chiều nếu là cuộc trò chuyện trực tiếp (DIRECT)
   * 4. Kiểm tra tính hợp lệ của tin nhắn được phản hồi (replyToMessageId) nếu có
   * 5. Thực thi Transaction lưu tin nhắn và cập nhật lastMessage cho Conversation
   * 6. Phát sự kiện Socket.IO 'new_message' tới room của cuộc trò chuyện
   *
   * @param data Dữ liệu tin nhắn mới
   * @returns Tin nhắn vừa được lưu thành công
   */
  async sendMessage(data: {
    conversationId: string;
    senderId: string;
    content?: string;
    type?: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
    attachments?: IAttachment[];
    replyToMessageId?: string | null;
  }): Promise<IMessage> {
    // Bước 1: Kiểm tra cuộc trò chuyện có tồn tại trong hệ thống không
    const conversation = await this.convRepo.findById(data.conversationId);
    if (!conversation) {
      throw new NotFoundError("Không tìm thấy cuộc trò chuyện");
    }

    // Bước 2: Kiểm tra người gửi có phải là thành viên hợp lệ của cuộc trò chuyện không
    const isMember = conversation.participants.some((p: unknown) => {
      const pid =
        (p as { _id?: { toString(): string }; id?: string })?._id?.toString() ||
        (p as { id?: string })?.id?.toString() ||
        (p as { toString(): string }).toString();
      return pid === data.senderId;
    });

    if (!isMember) {
      throw new ForbiddenError("Bạn không phải thành viên của cuộc trò chuyện này");
    }

    // Bước 3: Nếu là hội thoại trực tiếp 1-1 (DIRECT), kiểm tra quan hệ chặn giữa 2 người dùng
    if (conversation.type === "DIRECT" && conversation.participants.length === 2) {
      const [p1Raw, p2Raw] = conversation.participants;
      const p1 =
        (p1Raw as unknown as { _id?: { toString(): string }; id?: string })?._id?.toString() ||
        (p1Raw as unknown as { id?: string })?.id?.toString() ||
        (p1Raw as unknown as { toString(): string }).toString();
      const p2 =
        (p2Raw as unknown as { _id?: { toString(): string }; id?: string })?._id?.toString() ||
        (p2Raw as unknown as { id?: string })?.id?.toString() ||
        (p2Raw as unknown as { toString(): string }).toString();

      const isBlocked =
        typeof (this.blockRepo as unknown as { isBlockedBetween?: (a: string, b: string) => Promise<boolean> }).isBlockedBetween === "function"
          ? await (this.blockRepo as unknown as { isBlockedBetween: (a: string, b: string) => Promise<boolean> }).isBlockedBetween(p1, p2)
          : await this.blockRepo.isBlocked(p1, p2);

      if (isBlocked) {
        throw new ForbiddenError("Không thể gửi tin nhắn do quan hệ giữa hai người dùng đã bị chặn");
      }
    }

    // Bước 4: Kiểm tra tin nhắn trích dẫn (replyToMessageId) nếu có
    if (data.replyToMessageId) {
      const replyMsg = await this.msgRepo.findById(data.replyToMessageId);
      if (!replyMsg || replyMsg.conversationId.toString() !== data.conversationId) {
        throw new NotFoundError("Không tìm thấy tin nhắn được trả lời trong cuộc trò chuyện này");
      }
    }

    // Bước 5: Thực thi ghi dữ liệu nguyên tử (Atomic Multi-Document Transaction)
    // Chỉ kích hoạt Session khi kết nối MongoDB đang hoạt động (readyState === 1)
    let session: mongoose.ClientSession | null = null;
    if (mongoose.connection.readyState === 1) {
      try {
        session = await mongoose.startSession();
      } catch {
        session = null;
      }
    }

    let message: IMessage;

    if (session) {
      try {
        await session.withTransaction(async () => {
          message = await this.msgRepo.create(
            {
              conversationId: data.conversationId,
              senderId: data.senderId,
              content: data.content,
              type: data.type || "TEXT",
              attachments: data.attachments,
              replyToMessageId: data.replyToMessageId,
            },
            session!
          );

          await this.convRepo.updateLastMessage(
            data.conversationId,
            message.id,
            message.createdAt,
            session!
          );
        });
      } catch (err: unknown) {
        const errorMsg = (err as Error)?.message || "";
        // Trường hợp MongoDB đang chạy standalone (không hỗ trợ replica set transactions), fallback an toàn
        if (
          errorMsg.includes("Transaction numbers are only allowed") ||
          errorMsg.includes("replica set")
        ) {
          message = await this.msgRepo.create({
            conversationId: data.conversationId,
            senderId: data.senderId,
            content: data.content,
            type: data.type || "TEXT",
            attachments: data.attachments,
            replyToMessageId: data.replyToMessageId,
          });
          await this.convRepo.updateLastMessage(
            data.conversationId,
            message.id,
            message.createdAt
          );
        } else {
          throw err;
        }
      } finally {
        await session.endSession();
      }
    } else {
      // Fallback khi môi trường không khởi tạo được session
      message = await this.msgRepo.create({
        conversationId: data.conversationId,
        senderId: data.senderId,
        content: data.content,
        type: data.type || "TEXT",
        attachments: data.attachments,
        replyToMessageId: data.replyToMessageId,
      });
      await this.convRepo.updateLastMessage(
        data.conversationId,
        message.id,
        message.createdAt
      );
    }

    // Bước 6: Phát sự kiện Real-Time qua Socket.IO tới room của cuộc trò chuyện
    emitToConversation(data.conversationId, "new_message", message!);

    return message!;
  }

  /**
   * Lấy lịch sử tin nhắn trong cuộc trò chuyện theo cơ chế phân trang con trỏ (Cursor-based Pagination)
   * @param conversationId ID cuộc trò chuyện
   * @param userId ID người dùng đang yêu cầu
   * @param options Tham số limit và cursor
   * @returns Danh sách tin nhắn kèm nextCursor và hasMore
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    options: { limit: number; cursor?: string }
  ): Promise<PaginatedMessages> {
    // 1. Kiểm tra sự tồn tại của cuộc trò chuyện
    const conversation = await this.convRepo.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError("Không tìm thấy cuộc trò chuyện");
    }

    // 2. Kiểm tra quyền xem tin nhắn của người dùng
    const isMember = conversation.participants.some((p: unknown) => {
      const pid =
        (p as { _id?: { toString(): string }; id?: string })?._id?.toString() ||
        (p as { id?: string })?.id?.toString() ||
        (p as { toString(): string }).toString();
      return pid === userId;
    });

    if (!isMember) {
      throw new ForbiddenError("Bạn không có quyền xem tin nhắn của cuộc trò chuyện này");
    }

    // 3. Giới hạn số lượng tin nhắn từ 1 đến 50 (mặc định 20)
    const limit = Math.min(Math.max(options.limit || 20, 1), 50);

    // Truy vấn dư 1 bản ghi (limit + 1) để xác định xem còn tin nhắn tiếp theo hay không
    const fetched = await this.msgRepo.findByConversationId(conversationId, {
      limit: limit + 1,
      before: options.cursor,
    });

    // 4. Tính toán nextCursor và cắt gọn mảng kết quả về đúng giới hạn limit
    const hasMore = fetched.length > limit;
    const messages = hasMore ? fetched.slice(0, limit) : fetched;
    const nextCursor =
      hasMore && messages.length > 0
        ? messages[messages.length - 1].createdAt.toISOString()
        : null;

    return {
      messages,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Thu hồi tin nhắn (Soft Delete)
   * 1. Kiểm tra sự tồn tại của tin nhắn
   * 2. Đảm bảo tin nhắn thuộc về đúng cuộc trò chuyện
   * 3. Kiểm tra chỉ người gửi mới có quyền thu hồi tin nhắn
   * 4. Kiểm tra tin nhắn chưa bị thu hồi trước đó
   * 5. Cập nhật cờ isDeleted: true và thời gian deletedAt
   * 6. Phát sự kiện Socket.IO 'message_recalled'
   *
   * @param conversationId ID cuộc trò chuyện
   * @param messageId ID tin nhắn cần thu hồi
   * @param userId ID người dùng yêu cầu thu hồi
   * @returns Tin nhắn đã được cập nhật trạng thái thu hồi
   */
  async recallMessage(
    conversationId: string,
    messageId: string,
    userId: string
  ): Promise<IMessage> {
    // Bước 1: Tìm tin nhắn trong CSDL
    const message = await this.msgRepo.findById(messageId);
    if (!message) {
      throw new NotFoundError("Không tìm thấy tin nhắn");
    }

    // Bước 2: Kiểm tra tin nhắn có thuộc đúng cuộc trò chuyện hay không
    if (message.conversationId.toString() !== conversationId) {
      throw new NotFoundError("Tin nhắn không thuộc cuộc trò chuyện này");
    }

    // Bước 3: Kiểm tra quyền: Chỉ người gửi tin nhắn mới có quyền thu hồi
    const senderId =
      (message.senderId as unknown as { _id?: { toString(): string }; id?: string })?._id?.toString() ||
      (message.senderId as unknown as { id?: string })?.id?.toString() ||
      (message.senderId as unknown as { toString(): string }).toString();

    if (senderId !== userId) {
      throw new ForbiddenError("Bạn chỉ có thể thu hồi tin nhắn do chính mình gửi");
    }

    // Bước 4: Kiểm tra trạng thái: Không thu hồi tin nhắn đã bị thu hồi trước đó
    if (message.isDeleted) {
      throw new ValidationError("Tin nhắn này đã được thu hồi trước đó");
    }

    // Bước 5: Thực hiện xóa mềm tin nhắn trong CSDL
    const updated = await this.msgRepo.softDelete(messageId);

    // Bước 6: Phát sự kiện Socket.IO thông báo tin nhắn đã bị thu hồi tới phòng chat
    emitToConversation(conversationId, "message_recalled", {
      messageId,
      conversationId,
    });

    return updated || message;
  }

  /**
   * Đánh dấu đã đọc tất cả tin nhắn chưa đọc trong cuộc trò chuyện
   * 1. Kiểm tra sự tồn tại của cuộc trò chuyện
   * 2. Kiểm tra tư cách thành viên của người dùng
   * 3. Cập nhật danh sách readBy cho tất cả tin nhắn hợp lệ
   * 4. Phát sự kiện Socket.IO 'messages_read'
   *
   * @param conversationId ID cuộc trò chuyện
   * @param userId ID người dùng đang đọc
   * @returns Kết quả đánh dấu thành công
   */
  async markAsRead(
    conversationId: string,
    userId: string
  ): Promise<{ success: boolean; readCount: number }> {
    // Bước 1: Kiểm tra cuộc trò chuyện tồn tại
    const conversation = await this.convRepo.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError("Không tìm thấy cuộc trò chuyện");
    }

    // Bước 2: Kiểm tra người dùng có phải là thành viên không
    const isMember = conversation.participants.some((p: unknown) => {
      const pid =
        (p as { _id?: { toString(): string }; id?: string })?._id?.toString() ||
        (p as { id?: string })?.id?.toString() ||
        (p as { toString(): string }).toString();
      return pid === userId;
    });

    if (!isMember) {
      throw new ForbiddenError("Bạn không phải thành viên của cuộc trò chuyện này");
    }

    // Bước 3: Đánh dấu đã đọc hàng loạt qua repository
    await this.msgRepo.markAllAsRead(conversationId, userId);

    // Bước 4: Phát sự kiện Real-Time Socket.IO thông báo đã đọc
    emitToConversation(conversationId, "messages_read", {
      conversationId,
      userId,
      readAt: new Date(),
    });

    return { success: true, readCount: 1 };
  }
}

/** Thể hiện mặc định (Singleton) của MessageService */
export const messageService = new MessageService();
