import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Các biến thể giao diện của nút bấm theo hệ thống thiết kế UI/UX Pro Max
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/**
 * Thành phần Nút bấm (Button) tuân thủ tiêu chuẩn UI/UX Pro Max:
 * 1. Viền nổi bật 2px (#2d3748)
 * 2. Đổ bóng vật lý sắc nét (Shadow 4px 4px rgb(45, 55, 72))
 * 3. Chiều cao và đệm (padding) dày dặn ("béo", vững chãi, dễ bấm)
 * 4. Hiệu ứng xúc giác lún xuống khi nhấn (Active State: translate 2px + shadow 1px)
 * 5. Đầy đủ 7 trạng thái: default, hover, focus-visible, active, disabled, loading, error
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Khai báo kiểu dáng màu sắc
    const variantStyles: Record<ButtonVariant, string> = {
      // Primary: Màu xanh nổi bật #22c55e, chữ đen đậm tương phản cao
      primary: "bg-[#22c55e] text-[#0f172a] hover:bg-[#16a34a] border-[#2d3748]",
      // Secondary: Màu xanh phấn #add8e6, chữ đen đậm
      secondary: "bg-[#add8e6] text-[#0f172a] hover:bg-[#90cdf4] border-[#2d3748]",
      // Outline: Nền trắng sạch, viền đậm
      outline: "bg-white text-[#0f172a] hover:bg-slate-50 border-[#2d3748]",
      // Ghost: Trong suốt không viền
      ghost: "bg-transparent text-[#0f172a] hover:bg-slate-100 border-transparent shadow-none hover:shadow-none hover:translate-x-0 hover:translate-y-0",
      // Danger: Màu đỏ cảnh báo
      danger: "bg-[#ef4444] text-white hover:bg-[#dc2626] border-[#2d3748]",
    };

    // Khai báo kích thước nút bấm: chiều cao tối thiểu và đệm (padding) dày dặn, béo đẹp
    const sizeStyles: Record<ButtonSize, string> = {
      sm: "min-h-[40px] px-4 py-2 text-xs rounded-xs font-bold",
      md: "min-h-[48px] px-6 py-3 text-sm rounded-xs font-black",
      lg: "min-h-[54px] px-8 py-4 text-base rounded-xs font-black tracking-wide",
      xl: "min-h-[60px] px-10 py-4.5 text-lg rounded-xs font-black tracking-wide",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          // Định dạng cơ bản: Viền 2px #2d3748, font chữ Nunito, căn giữa, con trỏ pointer
          "relative inline-flex items-center justify-center font-black tracking-wide cursor-pointer transition-all duration-100 ease-out select-none border-2",
          // Hiệu ứng đổ bóng khối và cơ chế nhấn chìm vật lý (Tactile Neo-brutalist Press Down):
          // - Mặc định (Default): Nút nổi lên với bóng khối 4px (#2d3748)
          // - Rê chuột (Hover): Nút chìm xuống 2px (+2px, +2px) và bóng thu nhỏ còn 2px (tạo cảm giác bị nhấn chìm nhẹ xuống)
          // - Nhấn chuột (Active): Nút lún phẳng hoàn toàn (+4px, +4px) và triệt tiêu bóng (shadow-none)
          variant !== "ghost" && [
            "shadow-uupm-2",
            "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#2d3748]",
            "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none active:duration-75",
          ],
          // Chuẩn tiếp cận Accessibility WCAG 2.2 AA (Vòng sáng Focus)
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          // Trạng thái vô hiệu hóa (Disabled)
          (disabled || isLoading) &&
            "opacity-60 cursor-not-allowed hover:translate-x-0 hover:translate-y-0 hover:shadow-uupm-2 active:translate-x-0 active:translate-y-0 active:shadow-uupm-2",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {/* Biểu tượng trạng thái Loading */}
        {isLoading && <Loader2 className="w-5 h-5 mr-2 animate-spin text-current shrink-0" />}

        {/* Icon bên trái */}
        {!isLoading && leftIcon && <span className="mr-2.5 inline-flex items-center shrink-0">{leftIcon}</span>}

        {/* Nội dung chữ nút bấm */}
        <span className="truncate">{children}</span>

        {/* Icon bên phải */}
        {!isLoading && rightIcon && <span className="ml-2.5 inline-flex items-center shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
