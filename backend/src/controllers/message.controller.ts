import { Request, Response, NextFunction } from "express";
import { messageService } from "../services/message.service";

/**
 * Controller tiếp nhận và điều phối các yêu cầu HTTP liên quan đến Tin nhắn (Message Controller)
 * Tuân thủ Layered Architecture: Tiếp nhận request, trích xuất dữ liệu xác thực,
 * gọi Service Layer và trả về định dạng JSON chuẩn.
 */
export class MessageController {
  /**
   * [POST /api/conversations/:conversationId/messages]
   * Gửi tin nhắn mới vào cuộc trò chuyện
   * Phản hồi HTTP 201 Created kèm dữ liệu tin nhắn vừa tạo
   */
  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const senderId = req.user!.userId;
      const { conversationId } = req.params;

      // Điều phối sang Service xử lý lưu tin nhắn, transaction và realtime socket
      const message = await messageService.sendMessage({
        conversationId,
        senderId,
        content: req.body.content,
        type: req.body.type,
        attachments: req.body.attachments,
        replyToMessageId: req.body.replyToMessageId,
      });

      // Trả về kết quả HTTP 201 Created
      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET /api/conversations/:conversationId/messages]
   * Lấy danh sách lịch sử tin nhắn trong cuộc trò chuyện (hỗ trợ cursor-based pagination)
   * Phản hồi HTTP 200 OK kèm mảng tin nhắn và metadata phân trang
   */
  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const cursor = req.query.cursor as string | undefined;

      // Gọi service lấy danh sách tin nhắn theo con trỏ thời gian
      const result = await messageService.getConversationMessages(
        conversationId,
        userId,
        { limit, cursor }
      );

      // Trả về kết quả HTTP 200 OK
      res.status(200).json({
        success: true,
        data: result.messages,
        pagination: {
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE /api/conversations/:conversationId/messages/:messageId]
   * Thu hồi tin nhắn đã gửi trong cuộc trò chuyện (Soft delete)
   * Phản hồi HTTP 200 OK kèm thông tin tin nhắn đã thu hồi
   */
  async recall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId, messageId } = req.params;

      // Gọi service xử lý thu hồi tin nhắn
      const message = await messageService.recallMessage(
        conversationId,
        messageId,
        userId
      );

      // Trả về kết quả HTTP 200 OK
      res.status(200).json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST /api/conversations/:conversationId/messages/read]
   * Đánh dấu toàn bộ tin nhắn trong cuộc trò chuyện là đã đọc
   * Phản hồi HTTP 200 OK
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;

      // Gọi service cập nhật trạng thái đọc tin nhắn
      const result = await messageService.markAsRead(conversationId, userId);

      // Trả về kết quả HTTP 200 OK
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

/** Thể hiện mặc định (Singleton) của MessageController */
export const messageController = new MessageController();
