import { z } from "zod";

// Biểu thức chính quy kiểm tra định dạng 24 ký tự hex của MongoDB ObjectId
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Schema xác thực query parameters khi lấy danh sách thông báo
 * - page: Số trang (mặc định: 1, tối thiểu: 1)
 * - limit: Số lượng phần tử mỗi trang (mặc định: 20, tối đa: 50)
 * - unreadOnly: Chỉ lấy thông báo chưa đọc (mặc định: false)
 */
export const GetNotificationsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1, "Số trang tối thiểu là 1").default(1),
    limit: z.coerce.number().int().min(1, "Số lượng tối thiểu là 1").max(50, "Số lượng tối đa là 50").default(20),
    unreadOnly: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  }),
});

/**
 * Schema xác thực route params chứa ID thông báo
 * - id: ID thông báo hợp lệ định dạng MongoDB ObjectId
 */
export const NotificationIdParamSchema = z.object({
  params: z.object({
    id: z
      .string({ required_error: "ID thông báo không được để trống" })
      .regex(OBJECT_ID_REGEX, "ID thông báo không hợp lệ"),
  }),
});

export type GetNotificationsQueryInput = z.infer<typeof GetNotificationsQuerySchema>["query"];
export type NotificationIdParamInput = z.infer<typeof NotificationIdParamSchema>["params"];
