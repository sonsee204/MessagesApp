import { z } from "zod";

/**
 * Kiểm tra đường dẫn ảnh ở phía client — PHẢI khớp quy tắc bên backend
 * (imagePathSchema trong src/schemas/user.schema.ts), nếu không người dùng sẽ
 * bị chặn ngay trên giao diện dù máy chủ hoàn toàn chấp nhận giá trị đó.
 * Chấp nhận hai dạng:
 *  1. Chuỗi rỗng — nghĩa là xoá ảnh, quay về mặc định.
 *  2. URL tuyệt đối http/https, HOẶC đường dẫn nội bộ /api/uploads/... do backend
 *     sinh ra sau khi xử lý tệp tải lên.
 */
const imagePathSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^https?:\/\/\S+$/.test(value) || value.startsWith("/api/uploads/"),
    { message: "Đường dẫn ảnh không hợp lệ" }
  );

/**
 * Schema xác thực biểu mẫu cập nhật hồ sơ cá nhân.
 * Ràng buộc được sao chép đúng theo UpdateProfileSchema của backend (user.schema.ts)
 * để người dùng nhận phản hồi lỗi ngay tại chỗ thay vì phải chờ server trả về.
 */
export const updateProfileSchema = z.object({
  // Tên hiển thị: bắt buộc, tối đa 50 ký tự
  displayName: z
    .string()
    .trim()
    .min(1, "Tên hiển thị không được để trống")
    .max(50, "Tên hiển thị tối đa 50 ký tự"),
  // Ảnh đại diện: để trống nghĩa là xoá ảnh, hoặc URL/đường dẫn nội bộ hợp lệ
  avatarUrl: imagePathSchema,
  // Ảnh bìa trang hồ sơ: cùng quy tắc với ảnh đại diện
  bannerUrl: imagePathSchema,
  // Tiểu sử ngắn hiển thị trong hồ sơ
  bio: z.string().trim().max(200, "Tiểu sử tối đa 200 ký tự"),
  // Dòng trạng thái (Discord gọi là "custom status")
  statusMessage: z.string().trim().max(100, "Trạng thái tối đa 100 ký tự"),
});

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;

/**
 * Schema xác thực biểu mẫu đổi mật khẩu.
 * Hai điều kiện refine bám sát ChangePasswordSchema của backend:
 * xác nhận phải khớp mật khẩu mới, và mật khẩu mới không được trùng mật khẩu cũ.
 */
export const changePasswordSchema = z
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
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
