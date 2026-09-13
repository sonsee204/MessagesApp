import React from "react";
import { UserPlus, LogIn } from "lucide-react";
import { cn } from "../../lib/utils";

export type AuthMode = "register" | "login";

interface AuthSwitchProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
  className?: string;
}

/**
 * Thành phần Switch chuyển đổi Đăng Ký / Đăng Nhập (AuthSwitch)
 * Phong cách Tactile Neo-Brutalist với thanh trượt chuyển động mượt mà (Animated Sliding Pill):
 * 1. Khung chứa viền 2px #2d3748, đổ bóng khối shadow-uupm
 * 2. Thanh trượt nền xanh #22c55e lướt qua lại giữa 2 tab với gia tốc đàn hồi mượt mà (cubic-bezier)
 * 3. Chữ và icon chuyển đổi màu sắc êm ái (transition-colors)
 * 4. Tuân thủ chuẩn tiếp cận WCAG 2.2 AA (ARIA role tablist, tab)
 */
export const AuthSwitch: React.FC<AuthSwitchProps> = ({
  mode,
  onChange,
  className,
}) => {
  return (
    <div
      role="tablist"
      aria-label="Chuyển đổi giữa Đăng ký và Đăng nhập"
      className={cn(
        "relative p-1.5 bg-slate-100 rounded-xs border-2 border-[#2d3748] shadow-[3px_3px_0px_0px_#2d3748] select-none",
        className
      )}
    >
      {/*
        Thanh trượt chỉ báo nền động (Tactile Sliding Pill Indicator):
        - Chiều rộng tính toán chính xác khớp 100% từng nút bấm: calc(50% - 10px)
        - Khi chuyển tab: Dịch chuyển mượt mà sang phải bằng translate-x-[calc(100%+8px)]
        - Đường cong gia tốc nảy nhẹ cubic-bezier(0.34, 1.56, 0.64, 1) tạo cảm giác cơ học sống động
      */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute top-1.5 bottom-1.5 w-[calc(50%-10px)] rounded-xs bg-[#22c55e] border-2 border-[#2d3748] shadow-uupm-2 transition-transform duration-300 ease-spring pointer-events-none",
          mode === "register"
            ? "left-1.5 translate-x-0"
            : "left-1.5 translate-x-[calc(100%+8px)]"
        )}
      />

      {/* Lưới 2 nút bấm tương tác nằm nổi phía trên thanh trượt (z-10) */}
      <div className="grid grid-cols-2 gap-2 relative z-10">
        {/* Nút Tab Đăng Ký */}
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          onClick={() => onChange("register")}
          className={cn(
            "min-h-[46px] py-3 px-4 text-xs md:text-sm rounded-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
            mode === "register"
              ? "text-[#0f172a] font-black"
              : "text-[#64748b] hover:text-[#0f172a] font-extrabold hover:bg-slate-200/40"
          )}
        >
          <UserPlus
            className={cn(
              "w-4 h-4 shrink-0 transition-transform duration-200",
              mode === "register" ? "scale-110" : "scale-100"
            )}
          />
          <span className="tracking-wide uppercase">Đăng Ký</span>
        </button>

        {/* Nút Tab Đăng Nhập */}
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => onChange("login")}
          className={cn(
            "min-h-[46px] py-3 px-4 text-xs md:text-sm rounded-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
            mode === "login"
              ? "text-[#0f172a] font-black"
              : "text-[#64748b] hover:text-[#0f172a] font-extrabold hover:bg-slate-200/40"
          )}
        >
          <LogIn
            className={cn(
              "w-4 h-4 shrink-0 transition-transform duration-200",
              mode === "login" ? "scale-110" : "scale-100"
            )}
          />
          <span className="tracking-wide uppercase">Đăng Nhập</span>
        </button>
      </div>
    </div>
  );
};
