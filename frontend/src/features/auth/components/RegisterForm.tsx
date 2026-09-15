import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User as UserIcon,
  Mail,
  Lock,
  Smile,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { registerSchema, RegisterFormValues } from "../schemas/auth.schema";
import { authService } from "../services/auth.service";
import { useAuthStore } from "../../../stores/auth.store";
import { toast } from "../../../stores/toast.store";
import { formatApiError } from "../../../lib/error-formatter";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

/**
 * Đánh giá độ mạnh của mật khẩu theo chuẩn bảo mật UI/UX Pro Max:
 * - Điểm 0-1: Yếu (Đỏ)
 * - Điểm 2: Khá / Trung bình (Vàng cam)
 * - Điểm 3: Mạnh (Xanh lá)
 */
function evaluatePasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "Chưa nhập", color: "bg-uupm-surface-strong" };
  if (password.length < 6) return { score: 1, label: "Quá ngắn (Yếu)", color: "bg-uupm-danger" };

  let score = 1;
  const hasNumbers = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const hasMixed = /[a-z]/.test(password) && /[A-Z]/.test(password);

  if (password.length >= 8 && (hasNumbers || hasSpecial || hasMixed)) score = 2;
  if (password.length >= 10 && hasNumbers && (hasSpecial || hasMixed)) score = 3;

  switch (score) {
    case 3:
      return { score: 3, label: "Mạnh - Rất an toàn", color: "bg-uupm-accent" };
    case 2:
      return { score: 2, label: "Trung bình - Đạt chuẩn", color: "bg-uupm-warn-soft-ink" };
    default:
      return { score: 1, label: "Yếu - Nên thêm số/chữ hoa", color: "bg-uupm-danger" };
  }
}

/**
 * Biểu mẫu Đăng Ký (RegisterForm) tối ưu chuẩn UI/UX Pro Max:
 * 1. Thanh đo độ mạnh mật khẩu trực quan (Password Strength Meter) 3 cấp độ
 * 2. Chỉ báo thời gian thực khi xác nhận mật khẩu trùng khớp
 * 3. Hướng dẫn phụ (Helper text) rõ ràng dưới từng trường
 * 4. Xác thực Zod Schema tức thì và nút bấm kích thước lớn (54px), xúc giác cao
 */
export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin }) => {
  const { setAuth } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Khởi tạo React Hook Form kết hợp Zod Resolver
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, touchedFields },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      username: "",
      email: "",
      displayName: "",
      password: "",
      confirmPassword: "",
      agreeTerms: false,
    },
  });

  // Lắng nghe giá trị mật khẩu để tính toán thanh đo độ mạnh và kiểm tra trùng khớp
  const passwordValue = watch("password") || "";
  const confirmPasswordValue = watch("confirmPassword") || "";

  // Tính toán mức độ bảo mật của mật khẩu
  const passwordStrength = useMemo(() => evaluatePasswordStrength(passwordValue), [passwordValue]);

  // Kiểm tra trạng thái khớp mật khẩu
  const isPasswordMatch = useMemo(() => {
    return confirmPasswordValue.length > 0 && passwordValue === confirmPasswordValue;
  }, [passwordValue, confirmPasswordValue]);

  // Xử lý khi nộp form đăng ký hợp lệ
  const onSubmit = async (values: RegisterFormValues) => {
    try {
      setServerError(null);
      setSuccessMessage(null);

      const result = await authService.register(values);

      setAuth(result.user, result.accessToken);

      setSuccessMessage("Đăng ký tài khoản thành công! Đang chuyển hướng...");
      // Kích hoạt thông báo Popup thành công
      toast.success(
        `Tạo tài khoản thành công! Chào mừng ${result.user.displayName || result.user.username} gia nhập hệ thống.`,
        "Đăng ký thành công"
      );

      if (onSuccess) {
        setTimeout(onSuccess, 600);
      }
    } catch (error: unknown) {
      // Dịch và chuẩn hóa 100% lỗi sang tiếng Việt
      const errorMessage = formatApiError(error, "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.");
      setServerError(errorMessage);
      // Kích hoạt thông báo Popup lỗi xúc giác
      toast.error(errorMessage, "Đăng ký thất bại");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left" noValidate>
      {/* Hộp thông báo lỗi từ máy chủ nếu có */}
      {serverError && (
        <div
          role="alert"
          className="p-4 rounded-xs bg-uupm-danger/10 border-2 border-uupm-danger text-uupm-danger-text flex items-start gap-3 shadow-[3px_3px_0px_0px_hsl(var(--uupm-danger))] animate-in fade-in slide-in-from-top-1"
        >
          <ShieldAlert className="w-5 h-5 shrink-0 text-uupm-danger-text mt-0.5" />
          <div className="text-xs font-bold leading-relaxed">{serverError}</div>
        </div>
      )}

      {/* Hộp thông báo thành công */}
      {successMessage && (
        <div
          role="status"
          className="p-4 rounded-xs bg-uupm-accent/10 border-2 border-uupm-accent text-uupm-accent flex items-center gap-3 shadow-[3px_3px_0px_0px_hsl(var(--uupm-accent))] animate-in fade-in slide-in-from-top-1"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-uupm-accent" />
          <div className="text-xs font-black">{successMessage}</div>
        </div>
      )}

      {/* Trường Tên đăng nhập (Validated by Zod) */}
      <Input
        label="Tên đăng nhập"
        placeholder="vd: nguyenvana"
        helperText="Tối thiểu 3 ký tự không dấu, số và gạch dưới (_)"
        autoComplete="username"
        leftIcon={<UserIcon className="w-4 h-4" />}
        error={errors.username?.message}
        isValid={touchedFields.username && !errors.username && Boolean(watch("username"))}
        disabled={isSubmitting}
        required
        {...register("username")}
      />

      {/* Trường Địa chỉ Email (Validated by Zod) */}
      <Input
        label="Địa chỉ Email"
        type="email"
        placeholder="vd: yourname@example.com"
        helperText="Email bảo mật dùng để nhận thông báo và làm mới phiên"
        autoComplete="email"
        leftIcon={<Mail className="w-4 h-4" />}
        error={errors.email?.message}
        isValid={touchedFields.email && !errors.email && Boolean(watch("email"))}
        disabled={isSubmitting}
        required
        {...register("email")}
      />

      {/* Trường Tên hiển thị (Tùy chọn) */}
      <Input
        label="Tên hiển thị công khai (Tùy chọn)"
        placeholder="vd: Nguyễn Văn An"
        helperText="Tên bạn bè sẽ nhìn thấy khi bạn trò chuyện"
        leftIcon={<Smile className="w-4 h-4" />}
        error={errors.displayName?.message}
        disabled={isSubmitting}
        {...register("displayName")}
      />

      {/* Trường Mật khẩu (Validated by Zod) */}
      <div>
        <Input
          label="Mật khẩu"
          placeholder="Tối thiểu 6 ký tự"
          autoComplete="new-password"
          isPassword
          leftIcon={<Lock className="w-4 h-4" />}
          error={errors.password?.message}
          disabled={isSubmitting}
          required
          {...register("password")}
        />

        {/* Thanh đo độ mạnh mật khẩu (Password Strength Meter) Tactile */}
        {passwordValue.length > 0 && (
          <div className="mt-2 p-2 rounded-xs bg-uupm-surface-hover border-2 border-uupm-line shadow-[2px_2px_0px_0px_hsl(var(--uupm-line))]">
            <div className="flex items-center justify-between text-[11px] font-black uppercase mb-1.5 text-uupm-ink">
              <span>Độ an toàn mật khẩu:</span>
              <span className="font-extrabold">{passwordStrength.label}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 h-2">
              {/* 3 thanh biểu thị mức yếu — trung bình — mạnh (score >= thanh index) */}
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={`rounded-xs transition-[background-color,box-shadow,transform] border border-uupm-line ${
                    passwordStrength.score >= level ? passwordStrength.color : "bg-uupm-surface-strong"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trường Xác nhận mật khẩu (Validated by Zod refine) */}
      <div>
        <Input
          label="Xác nhận mật khẩu"
          placeholder="Nhập lại chính xác mật khẩu phía trên"
          autoComplete="new-password"
          isPassword
          leftIcon={<Lock className="w-4 h-4" />}
          error={errors.confirmPassword?.message}
          isValid={isPasswordMatch}
          disabled={isSubmitting}
          required
          {...register("confirmPassword")}
        />
        {/* Phản hồi trực quan khi khớp mật khẩu */}
        {isPasswordMatch && (
          <p className="flex items-center gap-1.5 text-xs font-black text-uupm-accent-hover mt-1 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mật khẩu xác nhận trùng khớp hoàn hảo!</span>
          </p>
        )}
      </div>

      {/* Checkbox Điều khoản dịch vụ chuẩn WCAG 2.2 AA */}
      <div className="pt-2">
        <label className="flex items-start gap-3 cursor-pointer select-none group">
          <input
            type="checkbox"
            className="w-5 h-5 mt-0.5 rounded-xs border-2 border-uupm-line text-uupm-accent focus:ring-2 focus:ring-blue-500 cursor-pointer accent-uupm-accent shrink-0 shadow-[1px_1px_0px_0px_hsl(var(--uupm-line))]"
            {...register("agreeTerms")}
          />
          <span className="text-xs font-bold text-uupm-ink leading-relaxed group-hover:text-uupm-ink">
            Tôi xác nhận đã đọc và đồng ý với{" "}
            <span className="font-black underline underline-offset-2 hover:text-uupm-accent-hover">
              Điều khoản dịch vụ
            </span>{" "}
            cùng{" "}
            <span className="font-black underline underline-offset-2 hover:text-uupm-accent-hover">
              Chính sách bảo mật
            </span>.
          </span>
        </label>
        {errors.agreeTerms && (
          <p className="text-xs font-bold text-uupm-danger-text mt-1.5 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errors.agreeTerms.message}</span>
          </p>
        )}
      </div>

      {/* Nút nộp form đăng ký: Kích thước lớn 54px, hiệu ứng bấm lún xúc giác neo-brutalist */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isSubmitting}
        rightIcon={<ArrowRight className="w-5 h-5" />}
        className="w-full mt-3 min-h-[54px] text-base font-black"
      >
        Tạo Tài Khoản Ngay
      </Button>

      {/* Liên kết chuyển sang Đăng nhập */}
      {onSwitchToLogin && (
        <div className="text-center pt-3 border-t-2 border-uupm-ink-muted/40">
          <p className="text-xs font-bold text-uupm-ink-muted">
            Đã có tài khoản?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-black text-uupm-ink hover:text-uupm-accent-hover hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xs"
            >
              Đăng nhập ngay
            </button>
          </p>
        </div>
      )}
    </form>
  );
};
