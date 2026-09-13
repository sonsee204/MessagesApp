import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User as UserIcon,
  Lock,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { loginSchema, LoginFormValues } from "../schemas/auth.schema";
import { authService } from "../services/auth.service";
import { useAuthStore } from "../../../stores/auth.store";
import { toast } from "../../../stores/toast.store";
import { formatApiError } from "../../../lib/error-formatter";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

/**
 * Biểu mẫu Đăng Nhập (LoginForm) tối ưu theo chuẩn UI/UX Pro Max:
 * 1. Nút bấm Đăng Nhập dày dặn ("béo"), chiều cao 54px, xúc giác cao (Tactile Neo-Brutalist)
 * 2. Xác thực tức thì (mode: onTouched) thông qua Zod Schema
 * 3. Hỗ trợ hiển thị dấu tích xanh (isValid) khi nhập đúng định dạng
 * 4. Checkbox và liên kết tuân thủ chuẩn WCAG 2.2 AA (vùng chạm lớn >= 44px)
 */
export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onSwitchToRegister }) => {
  const { setAuth } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Khởi tạo React Hook Form kết hợp Zod Resolver
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, touchedFields },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: {
      identifier: "",
      password: "",
      rememberMe: false,
    },
  });

  const identifierValue = watch("identifier");

  // Xử lý khi nộp form đăng nhập hợp lệ
  const onSubmit = async (values: LoginFormValues) => {
    try {
      setServerError(null);
      setSuccessMessage(null);

      const result = await authService.login(values);

      setAuth(result.user, result.accessToken);

      const welcomeText = `Đăng nhập thành công! Chào mừng ${result.user.displayName || result.user.username} trở lại.`;
      setSuccessMessage("Đăng nhập thành công! Đang chuyển hướng...");
      // Kích hoạt thông báo Popup thành công
      toast.success(welcomeText, "Đăng nhập thành công");

      if (onSuccess) {
        setTimeout(onSuccess, 600);
      }
    } catch (error: unknown) {
      // Dịch và chuẩn hóa 100% lỗi sang tiếng Việt
      const errorMessage = formatApiError(error, "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
      setServerError(errorMessage);
      // Kích hoạt thông báo Popup lỗi xúc giác
      toast.error(errorMessage, "Đăng nhập thất bại");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left" noValidate>
      {/* Hộp thông báo lỗi từ máy chủ nếu có */}
      {serverError && (
        <div
          role="alert"
          className="p-4 rounded-xs bg-[#fef2f2] border-2 border-[#ef4444] text-[#991b1b] flex items-start gap-3 shadow-[3px_3px_0px_0px_#ef4444] animate-in fade-in slide-in-from-top-1"
        >
          <ShieldAlert className="w-5 h-5 shrink-0 text-[#ef4444] mt-0.5" />
          <div className="text-xs font-bold leading-relaxed">{serverError}</div>
        </div>
      )}

      {/* Hộp thông báo đăng nhập thành công */}
      {successMessage && (
        <div
          role="status"
          className="p-4 rounded-xs bg-[#f0fdf4] border-2 border-[#22c55e] text-[#166534] flex items-center gap-3 shadow-[3px_3px_0px_0px_#22c55e] animate-in fade-in slide-in-from-top-1"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-[#22c55e]" />
          <div className="text-xs font-black">{successMessage}</div>
        </div>
      )}

      {/* Trường Tên đăng nhập hoặc Email (Validated by Zod) */}
      <Input
        label="Tên đăng nhập hoặc Email"
        placeholder="vd: nguyenvana hoặc an@example.com"
        helperText="Nhập tên tài khoản hoặc email bạn đã đăng ký"
        autoComplete="username"
        leftIcon={<UserIcon className="w-4 h-4" />}
        error={errors.identifier?.message}
        isValid={touchedFields.identifier && !errors.identifier && Boolean(identifierValue)}
        disabled={isSubmitting}
        required
        {...register("identifier")}
      />

      {/* Trường Mật khẩu (Validated by Zod) */}
      <Input
        label="Mật khẩu"
        placeholder="Nhập mật khẩu của bạn"
        autoComplete="current-password"
        isPassword
        leftIcon={<Lock className="w-4 h-4" />}
        error={errors.password?.message}
        disabled={isSubmitting}
        required
        {...register("password")}
      />

      {/* Tùy chọn Ghi nhớ & Quên mật khẩu */}
      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2.5 cursor-pointer select-none group py-1">
          <input
            type="checkbox"
            className="w-5 h-5 rounded-xs border-2 border-[#2d3748] text-[#22c55e] focus:ring-2 focus:ring-blue-500 cursor-pointer accent-[#22c55e] shrink-0 shadow-[1px_1px_0px_0px_#2d3748]"
            {...register("rememberMe")}
          />
          <span className="text-xs font-bold text-[#0f172a] group-hover:text-black">
            Ghi nhớ phiên đăng nhập
          </span>
        </label>

        <button
          type="button"
          onClick={() => toast.info("Tính năng khôi phục mật khẩu đang được phát triển và sẽ sớm ra mắt.", "Khôi phục tài khoản")}
          className="text-xs font-black text-[#64748b] hover:text-[#0f172a] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xs py-1 cursor-pointer"
        >
          Quên mật khẩu?
        </button>
      </div>

      {/* Nút gửi yêu cầu đăng nhập: Kích thước lớn 54px, hiệu ứng bấm lún xúc giác neo-brutalist */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isSubmitting}
        rightIcon={<ArrowRight className="w-5 h-5" />}
        className="w-full mt-3 min-h-[54px] text-base font-black"
      >
        Đăng Nhập Ngay
      </Button>

      {/* Chuyển sang form đăng ký nếu chưa có tài khoản */}
      {onSwitchToRegister && (
        <div className="text-center pt-3 border-t-2 border-slate-100">
          <p className="text-xs font-bold text-slate-500">
            Chưa có tài khoản?{" "}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-black text-[#0f172a] hover:text-[#16a34a] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xs"
            >
              Đăng ký tài khoản mới
            </button>
          </p>
        </div>
      )}
    </form>
  );
};
