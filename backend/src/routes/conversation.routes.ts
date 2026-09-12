import { Router } from "express";
import { conversationController } from "../controllers/conversation.controller";
import { messageController } from "../controllers/message.controller";
import { validate } from "../middlewares/validate";
import { requireAuth } from "../middlewares/auth";
import {
  CreateConversationSchema,
  GetConversationParamsSchema,
} from "../schemas/conversation.schema";
import {
  SendMessageSchema,
  GetMessagesQuerySchema,
  RecallMessageParamsSchema,
  MarkMessagesAsReadParamsSchema,
} from "../schemas/message.schema";

const router = Router();

// Toàn bộ các tuyến đường liên quan đến Cuộc trò chuyện & Tin nhắn đều yêu cầu xác thực JWT (Protected Routes)
router.use(requireAuth);

/**
 * [POST /api/conversations]
 * Tuyến đường tạo cuộc trò chuyện mới (1-1 hoặc nhóm)
 */
router.post("/", validate(CreateConversationSchema), conversationController.create);

/**
 * [GET /api/conversations]
 * Tuyến đường lấy danh sách các cuộc trò chuyện của người dùng hiện tại
 */
router.get("/", conversationController.getMyConversations);

/**
 * [GET /api/conversations/:id]
 * Tuyến đường lấy thông tin chi tiết cuộc trò chuyện theo ID
 */
router.get("/:id", validate(GetConversationParamsSchema), conversationController.getById);

/* ==========================================================================
   CÁC TUYẾN ĐƯỜNG TIN NHẮN TRONG CUỘC TRÒ CHUYỆN (NESTED MESSAGES ROUTES)
   ========================================================================== */

/**
 * [POST /api/conversations/:conversationId/messages]
 * Gửi tin nhắn mới vào cuộc trò chuyện
 */
router.post(
  "/:conversationId/messages",
  validate(SendMessageSchema),
  messageController.send
);

/**
 * [GET /api/conversations/:conversationId/messages]
 * Lấy danh sách lịch sử tin nhắn trong cuộc trò chuyện kèm phân trang con trỏ (cursor)
 */
router.get(
  "/:conversationId/messages",
  validate(GetMessagesQuerySchema),
  messageController.getMessages
);

/**
 * [DELETE /api/conversations/:conversationId/messages/:messageId]
 * Thu hồi tin nhắn đã gửi trong cuộc trò chuyện (Soft delete)
 */
router.delete(
  "/:conversationId/messages/:messageId",
  validate(RecallMessageParamsSchema),
  messageController.recall
);

/**
 * [POST /api/conversations/:conversationId/messages/read]
 * Đánh dấu toàn bộ tin nhắn chưa đọc trong cuộc trò chuyện là đã đọc
 */
router.post(
  "/:conversationId/messages/read",
  validate(MarkMessagesAsReadParamsSchema),
  messageController.markAsRead
);

export const conversationRoutes = router;
