import React, { useState } from "react";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  isPassword?: boolean;
  isValid?: boolean; // Hiển thị biểu tượng hợp lệ (dấu tích xanh) khi trường đã đạt chuẩn
}

/**
 * Thành phần Ô Nhập Liệu (Input) tối ưu chuẩn UI/UX Pro Max:
 * 1. Chiều cao đạt chuẩn chạm tối thiểu >= 46px (Touch Target Guideline)
 * 2. Viền dày 2px đặc trưng (#2d3748) và đổ bóng khối khi focus (shadow.2)
 * 3. Nút ẩn/hiện mật khẩu có vùng chạm 40x40px, hỗ trợ WCAG 2.2 AA aria-label
 * 4. Trạng thái phản hồi tức thì: Bình thường, Hover, Focus, Lỗi, và Hợp lệ
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      leftIcon,
      isPassword = false,
      isValid = false,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    // Trạng thái ẩn/hiện mật khẩu
    const [showPassword, setShowPassword] = useState(false);

    // Xác định kiểu hiển thị của input
    const inputType = isPassword ? (showPassword ? "text" : "password") : type;

    // Sinh ID định danh cho input để liên kết với nhãn và thông báo lỗi
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {/* Nhãn trường dữ liệu (Label in hoa, phân cấp rõ nét) */}
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-black text-[#0f172a] tracking-wider uppercase select-none"
          >
            {label}
            {props.required && <span className="text-[#ef4444] ml-1 font-black">*</span>}
          </label>
        )}

        {/* Khung chứa input và các biểu tượng tương tác */}
        <div className="relative flex items-center">
          {/* Biểu tượng bên trái */}
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-500">
              {leftIcon}
            </div>
          )}

          {/* Ô nhập liệu chính */}
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                ? `${inputId}-helper`
                : undefined
            }
            className={cn(
              // Kích thước chuẩn UI/UX Pro Max: cao tối thiểu 48px, đệm tay thoải mái
              "w-full h-12 min-h-[48px] px-3.5 text-sm font-bold text-[#0f172a] bg-white rounded-xs border-2 transition-all placeholder:text-slate-400 placeholder:font-normal",
              // Tùy biến khoảng thụt đầu dòng theo icon
              leftIcon ? "pl-11" : "pl-3.5",
              isPassword ? "pr-12" : isValid ? "pr-10" : "pr-3.5",
              // Trạng thái bình thường: Viền 2px #2d3748, hover đậm hơn, focus viền đen bóng đổ
              !error && [
                "border-[#2d3748]",
                "hover:border-[#0f172a]",
                "focus:border-[#0f172a] focus:shadow-uupm-2 focus:outline-none focus:ring-2 focus:ring-blue-500",
              ],
              // Trạng thái lỗi (Error State): Viền đỏ #ef4444, bóng đổ khối đỏ
              error && [
                "border-[#ef4444]",
                "shadow-[4px_4px_0px_0px_#ef4444]",
                "focus:border-[#ef4444] focus:outline-none focus:ring-2 focus:ring-[#ef4444]/40",
              ],
              // Trạng thái vô hiệu hóa
              disabled && "bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed",
              className
            )}
            {...props}
          />

          {/* Biểu tượng trạng thái Hợp lệ (dấu tích xanh) */}
          {!isPassword && isValid && !error && (
            <div className="absolute right-3.5 flex items-center pointer-events-none text-[#22c55e]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}

          {/* Nút bật/tắt hiển thị mật khẩu (Vùng chạm đạt chuẩn tối thiểu 40x40px) */}
          {isPassword && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-1.5 w-10 h-10 flex items-center justify-center text-slate-500 hover:text-[#0f172a] active:text-[#22c55e] transition-colors rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Thông báo lỗi khi xác thực thất bại (Kèm icon AlertCircle nổi bật) */}
        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="flex items-center gap-1.5 text-xs font-bold text-[#ef4444] mt-1 animate-in fade-in slide-in-from-top-1"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {/* Văn bản hướng dẫn phụ (Helper Text) */}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs font-semibold text-slate-500 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
