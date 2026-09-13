import React from "react";
import { MessageSquare } from "lucide-react";
import { AuthCard } from "../components/AuthCard";
import { ThemeToggle } from "../../../components/ui/ThemeToggle";

interface AuthPageProps {
  onSuccess?: () => void;
}

/**
 * Trang Đăng Ký (AuthPage) chuẩn UI/UX Pro Max:
 * 1. Bố cục tập trung tối giản, đặt khung Đăng Ký (AuthCard) ngay chính giữa màn hình
 * 2. Phông chữ Nunito, viền đậm 2px #2d3748, bóng đổ tactile shadow.1 và shadow.2
 * 3. Hiển thị duy nhất Form Đăng ký tài khoản theo đúng chỉ dẫn của người dùng
 * 4. Đáp ứng hoàn hảo trên mọi kích cỡ màn hình từ Mobile đến Desktop lớn
 */
export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  return (
    <div className="min-h-screen bg-uupm-page text-uupm-ink flex flex-col justify-between selection:bg-uupm-accent selection:text-uupm-accent-text">
      {/* Header thanh điều hướng thương hiệu */}
      <header className="border-b-2 border-uupm-line bg-uupm-surface/90 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo nhận diện thương hiệu Tactile */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xs bg-uupm-accent border-2 border-uupm-line shadow-uupm-2 flex items-center justify-center">
              {/* Icon nằm TRÊN nền accent nên phải dùng --uupm-accent-text
                  (theme tối = trắng, đạt 4.61:1 trên blurple); nếu dùng
                  --uupm-ink (#f2f3f5) chỉ đạt 4.15:1 — dưới ngưỡng WCAG AA. */}
              <MessageSquare className="w-5 h-5 text-uupm-accent-text" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-uupm-ink block">
                AppMessaging
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-uupm-ink-muted block -mt-1">
                Real-Time Chat Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Nút chuyển đổi chế độ Sáng / Tối */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Vùng trung tâm: Hiển thị tập trung duy nhất Form Đăng Ký */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 md:py-12 flex items-center justify-center">
        <AuthCard onSuccess={onSuccess} />
      </main>

      {/* Chân trang (Footer) */}
      <footer className="border-t-2 border-uupm-line bg-uupm-surface py-4 px-6 text-center text-xs font-bold text-uupm-ink-muted">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AppMessaging © 2026 - Chuẩn thiết kế UI/UX Pro Max & WCAG 2.2 AA</span>
          <div className="flex items-center gap-4">
            <span className="hover:text-uupm-ink cursor-pointer">Chính Sách Bảo Mật</span>
            <span>•</span>
            <span className="hover:text-uupm-ink cursor-pointer">Điều Khoản Dịch Vụ</span>
            <span>•</span>
            <span className="hover:text-uupm-ink cursor-pointer">Bảo Mật Kép RAM & Cookie</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
