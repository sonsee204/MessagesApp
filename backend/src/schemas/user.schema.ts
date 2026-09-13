import { z } from "zod";

/**
 * Kiểm tra đường dẫn ảnh hợp lệ.
 * Chấp nhận HAI dạng:
 *  1. URL tuyệt đối (http/https) — ảnh ngoài hoặc dữ liệu cũ do người dùng dán vào.
 *  2. Đường dẫn nội bộ bắt đầu bằng /api/uploads/ — do chính backend sinh ra sau khi
 *     xử lý tệp tải lên. z.string().url() thuần sẽ TỪ CHỐI dạng này vì nó là đường dẫn
 *     tương đối, nên phải kiểm tra riêng.
 */
const imagePathSchema = z
  .string()
  .refine(
    (val) => /^https?:\/\/\S+$/.test(val) || val.startsWith("/api/uploads/"),
    "Đường dẫn ảnh không hợp lệ"
  );

/**
 * Schema cập nhật thông tin cá nhân (Profile)
 */
export const UpdateProfileSchema = z.object({
  body: z.object({
    displayName: z
      .string()
      .trim()
      .min(1, "Tên hiển thị không được để trống")
      .max(50, "Tên hiển thị tối đa 50 ký tự")
      .optional(),
    avatarUrl: imagePathSchema.nullable().optional(),
    // Ảnh bìa trang hồ sơ; null nghĩa là xoá về nền mặc định
    bannerUrl: imagePathSchema.nullable().optional(),
    bio: z
      .string()
      .trim()
      .max(200, "Tiểu sử tối đa 200 ký tự")
      .optional(),
    statusMessage: z
      .string()
      .trim()
      .max(100, "Trạng thái tối đa 100 ký tự")
      .optional(),
  }),
});

/**
 * Schema đổi mật khẩu (Change Password)
 */
export const ChangePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
      newPassword: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự"),
      confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu mới"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Mật khẩu xác nhận không khớp với mật khẩu mới",
      path: ["confirmPassword"],
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: "Mật khẩu mới không được trùng với mật khẩu hiện tại",
      path: ["newPassword"],
    }),
});

/**
 * Schema tìm kiếm người dùng (Search Users)
 */
export const SearchUsersQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().min(1, "Từ khóa tìm kiếm tối thiểu 1 ký tự"),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .refine((val) => val > 0 && val <= 50, {
        message: "Giới hạn kết quả từ 1 đến 50",
      }),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => val > 0, {
        message: "Trang tìm kiếm phải lớn hơn 0",
      }),
  }),
});

/**
 * Schema tham số truy vấn ID người dùng
 */
export const GetUserByIdParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1, "ID người dùng không được để trống"),
  }),
});

// Trích xuất DTO Types chuẩn xác
export type UpdateProfileDTO = z.infer<typeof UpdateProfileSchema>["body"];
export type ChangePasswordDTO = z.infer<typeof ChangePasswordSchema>["body"];
export type SearchUsersQueryDTO = z.infer<typeof SearchUsersQuerySchema>["query"];
export type GetUserByIdParamsDTO = z.infer<typeof GetUserByIdParamsSchema>["params"];
