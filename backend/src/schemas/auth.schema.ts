import { z } from "zod";

/**
 * Schema xác thực dữ liệu đăng ký tài khoản mới (Register DTO)
 * Ràng buộc các trường đầu vào theo chuẩn Zero-Trust Validation
 */
export const RegisterSchema = z.object({
  body: z.object({
    // Tên tài khoản: độ dài 3-30 ký tự, chỉ cho phép chữ, số và gạch dưới
    username: z
      .string({ required_error: "Tên người dùng không được để trống" })
      .trim()
      .min(3, "Tên người dùng tối thiểu 3 ký tự")
      .max(30, "Tên người dùng tối đa 30 ký tự")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Tên người dùng chỉ được chứa chữ cái, chữ số và dấu gạch dưới (_)"
      ),
    // Địa chỉ email: chuẩn RFC, tự động cắt khoảng trắng, tối đa 100 ký tự
    email: z
      .string({ required_error: "Email không được để trống" })
      .trim()
      .email("Định dạng email không hợp lệ")
      .max(100, "Email tối đa 100 ký tự"),
    // Mật khẩu người dùng: tối thiểu 6 ký tự để bảo đảm độ phức tạp
    password: z
      .string({ required_error: "Mật khẩu không được để trống" })
      .min(6, "Mật khẩu tối thiểu 6 ký tự")
      .max(100, "Mật khẩu tối đa 100 ký tự"),
    // Tên hiển thị công khai (tùy chọn, mặc định lấy theo username nếu bỏ trống)
    displayName: z
      .string()
      .trim()
      .min(1, "Tên hiển thị không được để trống")
      .max(50, "Tên hiển thị tối đa 50 ký tự")
      .optional(),
    // Đường dẫn ảnh đại diện (tùy chọn, phải là URL hợp lệ)
    avatarUrl: z
      .string()
      .url("Đường dẫn ảnh đại diện không hợp lệ")
      .optional()
      .nullable(),
  }),
});

/**
 * Schema xác thực dữ liệu đăng nhập tài khoản (Login DTO)
 * Hỗ trợ đăng nhập linh hoạt bằng địa chỉ Email hoặc Tên đăng nhập (Username)
 */
export const LoginSchema = z.object({
  body: z
    .object({
      // Tên đăng nhập hoặc địa chỉ Email của tài khoản
      identifier: z
        .string()
        .trim()
        .min(1, "Vui lòng nhập email hoặc tên đăng nhập")
        .optional(),
      // Trường email (hỗ trợ tương thích ngược nếu client gửi trường email)
      email: z
        .string()
        .trim()
        .optional(),
      // Mật khẩu tài khoản
      password: z
        .string({ required_error: "Mật khẩu không được để trống" })
        .min(1, "Vui lòng nhập mật khẩu"),
    })
    .refine((data) => Boolean(data.identifier || data.email), {
      message: "Vui lòng nhập email hoặc tên đăng nhập",
      path: ["identifier"],
    }),
});

// Xuất kiểu dữ liệu TypeScript suy diễn trực tiếp từ Zod Schema
export type RegisterDTO = z.infer<typeof RegisterSchema>["body"];
export type LoginDTO = z.infer<typeof LoginSchema>["body"];

/**
 * Schema xác thực yêu cầu làm mới Token (Refresh Token DTO)
 * Hỗ trợ nhận refreshToken từ request body đối với các client không sử dụng Cookie (Mobile/Desktop)
 */
export const RefreshTokenSchema = z.object({
  body: z
    .object({
      refreshToken: z.string().trim().optional(),
    })
    .optional(),
});

export type RefreshTokenDTO = z.infer<typeof RefreshTokenSchema>["body"];
