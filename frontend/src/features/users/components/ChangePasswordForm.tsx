import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, KeyRound, ShieldAlert, CheckCircle2, Save } from "lucide-react";
import { changePasswordSchema, ChangePasswordFormValues } from "../schemas/user.schema";
import { userService } from "../services/user.service";
import { toast } from "../../../stores/toast.store";
import { formatApiError } from "../../../lib/error-formatter";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

/**
 * Đánh giá độ mạnh mật khẩu mới theo 3 mức, dùng lại đúng thang điểm của form Đăng ký
 * để trải nghiệm nhất quán giữa hai màn hình. Toàn bộ màu đều là token uupm-*.
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
 * Phân mục "Mật khẩu & Bảo mật" trong popup cài đặt người dùng.
 * Vì access token chỉ tồn tại trong RAM, mỗi lần đổi mật khẩu bắt buộc gửi kèm
 * mật khẩu hiện tại để backend xác thực lại chính chủ tài khoản.
 */
export const ChangePasswordForm: React.FC = () => {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const newPasswordValue = watch("newPassword") || "";
  const confirmPasswordValue = watch("confirmPassword") || "";

  const passwordStrength = useMemo(() => evaluatePasswordStrength(newPasswordValue), [newPasswordValue]);

  // Chỉ báo trực quan khi hai ô mật khẩu đã khớp nhau
  const isPasswordMatch = useMemo(
    () => confirmPasswordValue.length > 0 && newPasswordValue === confirmPasswordValue,
    [newPasswordValue, confirmPasswordValue]
  );

  // Gửi yêu cầu đổi mật khẩu lên máy chủ
  const onSubmit = async (values: ChangePasswordFormValues) => {
    try {
      setServerError(null);

      await userService.changePassword(values);

      // Xoá sạch các ô nhập để tránh để lại mật khẩu trên màn hình
      reset();
      toast.success("Mật khẩu đã được cập nhật. Hãy dùng mật khẩu mới cho lần đăng nhập sau.", "Đổi mật khẩu");
    } catch (error: unknown) {
      const message = formatApiError(error, "Không thể đổi mật khẩu. Vui lòng thử lại.");
      setServerError(message);
      toast.error(message, "Đổi mật khẩu thất bại");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left" noValidate>
      {/* Hộp thông báo lỗi từ máy chủ (ví dụ: mật khẩu hiện tại không chính xác) */}
      {serverError && (
        <div
          role="alert"
          className="p-3 rounded-xs bg-uupm-danger/10 border-2 border-uupm-danger text-uupm-danger-text flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1"
        >
          <ShieldAlert className="w-4 h-4 shrink-0 text-uupm-danger-text mt-0.5" />
          <div className="text-xs font-bold leading-relaxed">{serverError}</div>
        </div>
      )}

      {/* Trường Mật khẩu hiện tại */}
      <Input
        label="Mật khẩu hiện tại"
        placeholder="Nhập mật khẩu đang sử dụng"
        autoComplete="current-password"
        isPassword
        leftIcon={<Lock className="w-4 h-4" />}
        error={errors.currentPassword?.message}
        disabled={isSubmitting}
        required
        {...register("currentPassword")}
      />

      {/* Trường Mật khẩu mới + thanh đo độ mạnh */}
      <div>
        <Input
          label="Mật khẩu mới"
          placeholder="Tối thiểu 6 ký tự"
          autoComplete="new-password"
          isPassword
          leftIcon={<KeyRound className="w-4 h-4" />}
          error={errors.newPassword?.message}
          disabled={isSubmitting}
          required
          {...register("newPassword")}
        />

        {newPasswordValue.length > 0 && (
          <div className="mt-2 p-2 rounded-xs bg-uupm-surface-hover border-2 border-uupm-line shadow-[2px_2px_0px_0px_hsl(var(--uupm-line))]">
            <div className="flex items-center justify-between text-[11px] font-black uppercase mb-1.5 text-uupm-ink">
              <span>Độ an toàn mật khẩu:</span>
              <span className="font-extrabold">{passwordStrength.label}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 h-2">
              <div
                className={`rounded-xs transition-all border border-uupm-line ${
                  passwordStrength.score >= 1 ? passwordStrength.color : "bg-uupm-surface-strong"
                }`}
              />
              <div
                className={`rounded-xs transition-all border border-uupm-line ${
                  passwordStrength.score >= 2 ? passwordStrength.color : "bg-uupm-surface-strong"
                }`}
              />
              <div
                className={`rounded-xs transition-all border border-uupm-line ${
                  passwordStrength.score >= 3 ? passwordStrength.color : "bg-uupm-surface-strong"
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Trường Xác nhận mật khẩu mới */}
      <div>
        <Input
          label="Xác nhận mật khẩu mới"
          placeholder="Nhập lại chính xác mật khẩu mới"
          autoComplete="new-password"
          isPassword
          leftIcon={<Lock className="w-4 h-4" />}
          error={errors.confirmPassword?.message}
          isValid={isPasswordMatch}
          disabled={isSubmitting}
          required
          {...register("confirmPassword")}
        />
        {isPasswordMatch && (
          <p className="flex items-center gap-1.5 text-xs font-black text-uupm-accent-hover mt-1 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mật khẩu xác nhận trùng khớp hoàn hảo!</span>
          </p>
        )}
      </div>

      {/* Nút gửi yêu cầu đổi mật khẩu */}
      <Button
        type="submit"
        variant="primary"
        size="md"
        isLoading={isSubmitting}
        leftIcon={<Save className="w-4 h-4" />}
        className="w-full"
      >
        Cập nhật mật khẩu
      </Button>
    </form>
  );
};
