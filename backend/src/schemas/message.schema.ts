import { z } from "zod";

/**
 * Biểu thức chính quy kiểm tra định dạng chuỗi ObjectId 24 ký tự hex của MongoDB
 */
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Schema xác thực dữ liệu tệp đính kèm trong tin nhắn
 * - url: Đường dẫn tệp hợp lệ
 * - name: Tên tệp hiển thị
 * - size: Dung lượng tệp tính bằng bytes (không âm)
 * - mimeType: Định dạng tệp tin (image/png, application/pdf, ...)
 */
export const AttachmentSchema = z.object({
  url: z.string().url("Đường dẫn tệp không đúng định dạng URL"),
  name: z.string().trim().min(1, "Tên tệp không được để trống"),
  size: z.number().min(0, "Kích thước tệp không được âm"),
  mimeType: z.string().trim().min(1, "MimeType không được để trống"),
  thumbnailUrl: z.string().url().optional(), // Poster video Cloudinary (optional)
  publicId: z.string().optional(),           // ID file Cloudinary (optional)
});

/**
 * Schema xác thực dữ liệu gửi tin nhắn mới (Zero-Trust Input)
 * - params: conversationId (Chuỗi ObjectId 24 ký tự hex hợp lệ)
 * - body:
 *   - content: Nội dung văn bản (tùy chọn, tối đa 5000 ký tự)
 *   - type: Loại tin nhắn (TEXT, IMAGE, FILE, SYSTEM), mặc định là TEXT
 *   - attachments: Danh sách tệp đính kèm, mặc định là mảng rỗng
 *   - replyToMessageId: ID tin nhắn được trả lời (nếu có)
 * - Ràng buộc: Bắt buộc phải có ít nhất nội dung văn bản hoặc 1 tệp đính kèm
 */
export const SendMessageSchema = z.object({
  params: z.object({
    conversationId: z.string().regex(OBJECT_ID_REGEX, "ID cuộc trò chuyện không hợp lệ"),
  }),
  body: z
    .object({
      content: z.string().trim().max(5000, "Nội dung tin nhắn không vượt quá 5000 ký tự").optional(),
      type: z.enum(["TEXT", "IMAGE", "FILE", "SYSTEM"]).default("TEXT"),
      attachments: z.array(AttachmentSchema).default([]),
      replyToMessageId: z.string().regex(OBJECT_ID_REGEX, "ID tin nhắn trả lời không hợp lệ").optional().nullable(),
    })
    .refine(
      (data) => {
        const hasContent = Boolean(data.content && data.content.trim().length > 0);
        const hasAttachments = Array.isArray(data.attachments) && data.attachments.length > 0;
        return hasContent || hasAttachments;
      },
      {
        message: "Nội dung tin nhắn hoặc tệp đính kèm không được để trống",
        path: ["content"],
      }
    ),
});

/**
 * Schema xác thực tham số truy vấn lịch sử tin nhắn kèm phân trang cursor
 * - params: conversationId (ObjectId hợp lệ)
 * - query:
 *   - limit: Số lượng tin nhắn cần lấy (1 đến 50, mặc định là 20)
 *   - cursor: Mốc thời gian hoặc ID tin nhắn để phân trang lịch sử
 */
export const GetMessagesQuerySchema = z.object({
  params: z.object({
    conversationId: z.string().regex(OBJECT_ID_REGEX, "ID cuộc trò chuyện không hợp lệ"),
  }),
  query: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 50, {
        message: "Số lượng tin nhắn (limit) phải nằm trong khoảng từ 1 đến 50",
      }),
    cursor: z.string().optional(),
  }),
});

/**
 * Schema xác thực tham số thu hồi tin nhắn
 * - params:
 *   - conversationId: ID cuộc trò chuyện
 *   - messageId: ID tin nhắn cần thu hồi
 */
export const RecallMessageParamsSchema = z.object({
  params: z.object({
    conversationId: z.string().regex(OBJECT_ID_REGEX, "ID cuộc trò chuyện không hợp lệ"),
    messageId: z.string().regex(OBJECT_ID_REGEX, "ID tin nhắn không hợp lệ"),
  }),
});

/**
 * Schema xác thực tham số đánh dấu đã đọc tin nhắn trong cuộc trò chuyện
 * - params:
 *   - conversationId: ID cuộc trò chuyện
 */
export const MarkMessagesAsReadParamsSchema = z.object({
  params: z.object({
    conversationId: z.string().regex(OBJECT_ID_REGEX, "ID cuộc trò chuyện không hợp lệ"),
  }),
});

/** Kiểu dữ liệu TypeScript suy luận từ các Schema */
export type SendMessageInput = z.infer<typeof SendMessageSchema>["body"];
export type SendMessageDTO = SendMessageInput;
export type GetMessagesQueryInput = z.infer<typeof GetMessagesQuerySchema>["query"];
export type RecallMessageParamsInput = z.infer<typeof RecallMessageParamsSchema>["params"];
