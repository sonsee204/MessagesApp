import { z } from "zod";

// Biểu thức chính quy kiểm tra định dạng MongoDB ObjectId hợp lệ (24 ký tự hex)
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Schema xác thực dữ liệu khi gửi lời mời kết bạn
 * - receiverId: ID người nhận (bắt buộc, đúng định dạng ObjectId)
 * - note: Lời nhắn kèm theo (tùy chọn, tối đa 200 ký tự)
 */
export const SendFriendRequestSchema = z.object({
  body: z.object({
    receiverId: z
      .string({ required_error: "ID người nhận không được để trống" })
      .regex(OBJECT_ID_REGEX, "ID người nhận không hợp lệ"),
    note: z
      .string()
      .max(200, "Lời nhắn tối đa 200 ký tự")
      .optional()
      .default(""),
  }),
});

/**
 * Schema xác thực query phân trang chung cho danh sách lời mời và danh sách chặn
 * - page: Số trang (mặc định: 1, tối thiểu: 1)
 * - limit: Số lượng phần tử trên mỗi trang (mặc định: 20, tối đa: 100)
 */
export const PaginationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

/**
 * Schema xác thực query truy vấn danh sách bạn bè
 * - page, limit: Phân trang danh sách
 * - search: Từ khóa tìm kiếm theo tên đăng nhập hoặc tên hiển thị
 * - onlineOnly: Lọc chỉ những bạn bè đang hoạt động trực tuyến
 */
export const FriendQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    onlineOnly: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  }),
});

/**
 * Schema xác thực URL parameter chứa requestId (chấp nhận/từ chối/hủy lời mời)
 */
export const RequestIdParamSchema = z.object({
  params: z.object({
    requestId: z
      .string({ required_error: "ID lời mời không được để trống" })
      .regex(OBJECT_ID_REGEX, "ID lời mời không hợp lệ"),
  }),
});

/**
 * Schema xác thực URL parameter chứa targetUserId (chặn/bỏ chặn/hủy kết bạn/trạng thái quan hệ)
 */
export const TargetUserParamSchema = z.object({
  params: z.object({
    targetUserId: z
      .string({ required_error: "ID người dùng mục tiêu không được để trống" })
      .regex(OBJECT_ID_REGEX, "ID người dùng mục tiêu không hợp lệ"),
  }),
});

// Kiểu dữ liệu TypeScript trích xuất tự động từ Schema
export type SendFriendRequestInput = z.infer<typeof SendFriendRequestSchema>["body"];
export type FriendQueryInput = z.infer<typeof FriendQuerySchema>["query"];
export type PaginationQueryInput = z.infer<typeof PaginationQuerySchema>["query"];
