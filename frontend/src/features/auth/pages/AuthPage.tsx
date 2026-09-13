import React from "react";
import { MessageSquare, Sparkles } from "lucide-react";
import { AuthCard } from "../components/AuthCard";

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
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col justify-between selection:bg-[#22c55e] selection:text-[#0f172a]">
      {/* Header thanh điều hướng thương hiệu */}
      <header className="border-b-2 border-[#2d3748] bg-white/90 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo nhận diện thương hiệu Tactile */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xs bg-[#22c55e] border-2 border-[#2d3748] shadow-uupm-2 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#0f172a]" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-[#0f172a] block">
                AppMessaging
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#64748b] block -mt-1">
                Real-Time Chat Engine
              </span>
            </div>
          </div>

          {/* Huy hiệu phong cách UI/UX Pro Max */}
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xs bg-[#add8e6] border-2 border-[#2d3748] shadow-uupm-2 text-xs font-black text-[#0f172a]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>UI/UX Pro Max • Tactile Neo-brutalist</span>
          </div>
        </div>
      </header>

      {/* Vùng trung tâm: Hiển thị tập trung duy nhất Form Đăng Ký */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 md:py-12 flex items-center justify-center">
        <AuthCard onSuccess={onSuccess} />
      </main>

      {/* Chân trang (Footer) */}
      <footer className="border-t-2 border-[#2d3748] bg-white py-4 px-6 text-center text-xs font-bold text-[#64748b]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AppMessaging © 2026 - Chuẩn thiết kế UI/UX Pro Max & WCAG 2.2 AA</span>
          <div className="flex items-center gap-4">
            <span className="hover:text-[#0f172a] cursor-pointer">Chính Sách Bảo Mật</span>
            <span>•</span>
            <span className="hover:text-[#0f172a] cursor-pointer">Điều Khoản Dịch Vụ</span>
            <span>•</span>
            <span className="hover:text-[#0f172a] cursor-pointer">Bảo Mật Kép RAM & Cookie</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
