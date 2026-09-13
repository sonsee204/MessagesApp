import { z } from "zod";

/**
 * Zod Schema xác thực biểu mẫu ĐĂNG NHẬP (LoginForm)
 * Kiểm tra tính hợp lệ của định dạng Email hoặc Tên đăng nhập và độ dài Mật khẩu
 */
export const loginSchema = z.object({
  identifier: z
    .string({ required_error: "Vui lòng nhập email hoặc tên đăng nhập" })
    .trim()
    .min(1, "Vui lòng nhập email hoặc tên đăng nhập"),
  password: z
    .string({ required_error: "Mật khẩu không được để trống" })
    .min(1, "Vui lòng nhập mật khẩu của bạn")
    .min(6, "Mật khẩu phải chứa tối thiểu 6 ký tự"),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Zod Schema xác thực biểu mẫu ĐĂNG KÝ (RegisterForm)
 * Kiểm tra toàn diện mọi quy tắc nghiệp vụ:
 * 1. Tên người dùng: 3-30 ký tự, không dấu, không ký tự đặc biệt ngoài gạch dưới (_)
 * 2. Email: Chuẩn cú pháp RFC
 * 3. Tên hiển thị: Tùy chọn, tối đa 50 ký tự
 * 4. Mật khẩu: Tối thiểu 6 ký tự
 * 5. Xác nhận mật khẩu: Phải khớp 100% với mật khẩu đã nhập
 * 6. Điều khoản: Bắt buộc tích chọn đồng ý
 */
export const registerSchema = z
  .object({
    username: z
      .string({ required_error: "Tên đăng nhập không được để trống" })
      .trim()
      .min(1, "Vui lòng nhập tên đăng nhập")
      .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự")
      .max(30, "Tên đăng nhập không được vượt quá 30 ký tự")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Tên đăng nhập chỉ được chứa chữ cái không dấu, chữ số và dấu gạch dưới (_)"
      ),
    email: z
      .string({ required_error: "Email không được để trống" })
      .trim()
      .min(1, "Vui lòng nhập địa chỉ email")
      .email("Địa chỉ email không hợp lệ (ví dụ: yourname@domain.com)")
      .max(100, "Email không được vượt quá 100 ký tự"),
    displayName: z
      .string()
      .trim()
      .max(50, "Tên hiển thị không được vượt quá 50 ký tự")
      .optional()
      .or(z.literal("")),
    password: z
      .string({ required_error: "Mật khẩu không được để trống" })
      .min(1, "Vui lòng nhập mật khẩu")
      .min(6, "Mật khẩu phải có ít nhất 6 ký tự")
      .max(100, "Mật khẩu không được vượt quá 100 ký tự"),
    confirmPassword: z
      .string({ required_error: "Vui lòng xác nhận mật khẩu" })
      .min(1, "Vui lòng nhập lại mật khẩu để xác nhận"),
    agreeTerms: z.boolean().refine((val) => val === true, {
      message: "Bạn cần đánh dấu đồng ý với Điều khoản dịch vụ và Chính sách bảo mật",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không trùng khớp với mật khẩu đã nhập",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
