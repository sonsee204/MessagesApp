import React, { useState } from "react";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { AuthSwitch, AuthMode } from "../../../components/ui/AuthSwitch";
import { RegisterForm } from "./RegisterForm";
import { LoginForm } from "./LoginForm";
import { cn } from "../../../lib/utils";

interface AuthCardProps {
  defaultMode?: AuthMode;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Thẻ Xác Thực Toàn Diện (AuthCard) chuẩn UI/UX Pro Max:
 * 1. Khung Card chuẩn bo góc md (24px) với viền 2px #2d3748 và bóng đổ xúc giác shadow.1
 * 2. Tích hợp bộ Switch chuyển đổi linh hoạt giữa Đăng Ký và Đăng Nhập
 * 3. Xác thực biểu mẫu thời gian thực 100% bằng thư viện Zod (Zod Schema Validation)
 * 4. Huy hiệu nhận diện thương hiệu với nền surfaceStrong (#add8e6)
 * 5. Tích hợp đầy đủ các trường xác thực và cam kết bảo mật tin cậy
 */
export const AuthCard: React.FC<AuthCardProps> = ({
  defaultMode = "register",
  onSuccess,
  className,
}) => {
  // Trạng thái Switch: "register" (Đăng ký) hoặc "login" (Đăng nhập)
  const [authMode, setAuthMode] = useState<AuthMode>(defaultMode);

  return (
    <Card
      className={cn(
        "w-full max-w-lg bg-uupm-surface border-2 border-uupm-line shadow-uupm-1 rounded-md overflow-hidden",
        className
      )}
    >
      {/* Phần đầu của Thẻ: Huy hiệu thương hiệu & Tiêu đề */}
      <CardHeader className="text-center pb-2 pt-7 px-7">
        {/* Huy hiệu ứng dụng Tactile Neo-brutalist */}
        <div className="flex justify-center mb-3">
          {/* Chip nằm TRÊN nền --uupm-accent-soft nên dùng --uupm-accent-text
              (đồng bộ với mọi chip accent-soft khác trong app); ở theme tối nền
              chip là #4a4f7a nên chữ trắng đạt 7.80:1. Bỏ fill-current để icon
              không còn là khối trắng đặc chói trên nền tối. */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line shadow-uupm-2">
            <MessageSquare className="w-4 h-4 text-uupm-accent-text" />
            <span className="text-xs font-black tracking-wider text-uupm-accent-text uppercase">
              AppMessaging Auth
            </span>
          </div>
        </div>

        {/* Tiêu đề biến đổi theo chế độ Switch */}
        <h1 className="text-2xl font-black text-uupm-ink tracking-tight">
          {authMode === "register" ? "Tạo tài khoản mới" : "Chào mừng trở lại!"}
        </h1>

        {/* Mô tả phụ hướng dẫn */}
        <p className="text-xs font-semibold text-uupm-ink-muted mt-1 max-w-sm mx-auto">
          {authMode === "register"
            ? "Điền thông tin bên dưới để đăng ký tài khoản và trải nghiệm nhắn tin bảo mật."
            : "Nhập thông tin đăng nhập để truy cập vào không gian làm việc của bạn."}
        </p>

        {/* Bộ Switch chuyển đổi Đăng Ký / Đăng Nhập phong cách Tactile */}
        <div className="mt-5">
          <AuthSwitch mode={authMode} onChange={setAuthMode} />
        </div>
      </CardHeader>

      {/* Nội dung Biểu mẫu tương ứng có hiệu ứng mờ hiện chuyển cảnh êm ái */}
      <CardContent className="p-7 pt-4">
        <div key={authMode} className="animate-in fade-in duration-200">
          {authMode === "register" ? (
            <RegisterForm
              onSuccess={onSuccess}
              onSwitchToLogin={() => setAuthMode("login")}
            />
          ) : (
            <LoginForm
              onSuccess={onSuccess}
              onSwitchToRegister={() => setAuthMode("register")}
            />
          )}
        </div>

        {/* Chân thẻ: Chứng nhận bảo mật kép */}
        <div className="mt-5 pt-3.5 border-t border-uupm-ink-muted/30 flex items-center justify-center gap-2 text-uupm-ink-muted">
          <ShieldCheck className="w-4 h-4 text-uupm-accent shrink-0" />
          <span className="text-[11px] font-bold tracking-tight">
            Xác thực Token RAM & Signed HTTP-Only Cookie
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
