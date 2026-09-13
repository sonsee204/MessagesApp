import { Request, Response, NextFunction } from "express";
import { conversationService } from "../services/conversation.service";

/**
 * Controller tiếp nhận các yêu cầu liên quan đến Cuộc trò chuyện (Conversation)
 */
export class ConversationController {
  /**
   * [POST /api/conversations]
   * Tạo cuộc trò chuyện mới (1-1 hoặc nhóm)
   * Phản hồi HTTP 201 Created kèm dữ liệu cuộc hội thoại vừa tạo
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Lấy ID người tạo từ JWT payload
      const creatorId = req.user!.userId;

      // Gọi service tạo cuộc trò chuyện
      const conversation = await conversationService.createConversation({
        ...req.body,
        creatorId,
      });

      // Trả về HTTP 201 Created
      res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET /api/conversations]
   * Lấy danh sách tất cả các cuộc trò chuyện của người dùng hiện tại
   * Phản hồi HTTP 200 OK kèm danh sách cuộc hội thoại
   */
  async getMyConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const conversations = await conversationService.getUserConversations(userId);

      // Trả về HTTP 200 OK
      res.status(200).json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET /api/conversations/:id]
   * Lấy chi tiết một cuộc trò chuyện theo ID (có kiểm tra quyền tham gia)
   * Phản hồi HTTP 200 OK kèm thông tin cuộc hội thoại
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const conversation = await conversationService.getConversationById(
        req.params.id,
        userId
      );

      // Trả về HTTP 200 OK
      res.status(200).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const conversationController = new ConversationController();
