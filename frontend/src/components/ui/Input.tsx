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
 * Sinh ID định danh cho input để liên kết với nhãn và thông báo lỗi.
 * Ưu tiên id truyền vào, nếu không có thì slugify từ label (rule a11y htmlFor/aria).
 */
function resolveInputId(id: string | undefined, label: string | undefined): string | undefined {
  if (id) return id;
  if (label) return `input-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  return undefined;
}

/**
 * Tính className cho ô input theo trạng thái (bình thường / lỗi / vô hiệu hóa / padding icon).
 * Tách khỏi component Input để giảm độ phức tạp hàm cha (rule no-high-complexity-react-function).
 */
function buildInputClassName(opts: {
  leftIcon?: React.ReactNode;
  isPassword: boolean;
  isValid: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
}): string {
  return cn(
    // Kích thước chuẩn UI/UX Pro Max: cao tối thiểu 48px, đệm tay thoải mái
    "w-full h-12 min-h-[48px] px-3.5 text-sm font-bold text-uupm-ink bg-uupm-surface rounded-xs border-2 transition-[background-color,box-shadow,transform] placeholder:text-uupm-ink-muted placeholder:font-normal",
    // Tùy biến khoảng thụt đầu dòng theo icon
    opts.leftIcon ? "pl-11" : "pl-3.5",
    opts.isPassword ? "pr-12" : opts.isValid ? "pr-10" : "pr-3.5",
    // Trạng thái bình thường: Viền 2px, hover đậm hơn, focus viền + bóng đổ
    !opts.error && [
      "border-uupm-line",
      "hover:border-uupm-line",
      "focus:border-uupm-line focus:shadow-uupm-2 focus:outline-none focus:ring-2 focus:ring-blue-500",
    ],
    // Trạng thái lỗi (Error State): Viền đỏ, bóng đổ khối đỏ
    opts.error && [
      "border-uupm-danger",
      "shadow-[4px_4px_0px_0px_hsl(var(--uupm-danger))]",
      "focus:border-uupm-danger focus:outline-none focus:ring-2 focus:ring-uupm-danger/40",
    ],
    // Trạng thái vô hiệu hóa
    opts.disabled &&
      "bg-uupm-surface-hover text-uupm-ink-muted border-uupm-ink-muted/40 cursor-not-allowed",
    opts.className
  );
}

/**
 * Thành phần Ô Nhập Liệu (Input) tối ưu chuẩn UI/UX Pro Max:
 * 1. Chiều cao đạt chuẩn chạm tối thiểu >= 46px (Touch Target Guideline)
 * 2. Viền dày 2px đặc trưng và đổ bóng khối khi focus (shadow.2)
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
    const inputId = resolveInputId(id, label);

    // Giao diện đã tính sẵn (presentational) — tách để giảm complexity của forwardRef cha
    return (
      <InputField
        ref={ref}
        inputId={inputId}
        inputType={inputType}
        error={error}
        helperText={helperText}
        leftIcon={leftIcon}
        isPassword={isPassword}
        isValid={isValid}
        disabled={disabled}
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((prev) => !prev)}
        className={buildInputClassName({ leftIcon, isPassword, isValid, error, disabled, className })}
        label={label}
        required={props.required}
        describedById={
          error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
        }
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

/**
 * Thành phần trình bày (presentational) của Input — nhận mọi giá trị đã tính sẵn
 * từ forwardRef cha. Tách riêng để chuyển các nhánh điều kiện render ra khỏi
 * hàm Input (rule no-high-complexity-react-function).
 */
const InputField = React.forwardRef<
  HTMLInputElement,
  Omit<InputProps, "isPassword" | "isValid"> & {
    inputId?: string;
    inputType: string;
    showPassword: boolean;
    onTogglePassword: () => void;
    describedById?: string;
    label?: string;
    isPassword: boolean;
    isValid: boolean;
  }
>(
  (
    {
      inputId,
      inputType,
      error,
      helperText,
      leftIcon,
      isPassword,
      isValid,
      disabled,
      showPassword,
      onTogglePassword,
      className,
      label,
      required,
      describedById,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full space-y-1.5 text-left">
        {/* Nhãn trường dữ liệu (Label in hoa, phân cấp rõ nét) */}
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-black text-uupm-ink tracking-wider uppercase select-none"
          >
            {label}
            {required && <span className="text-uupm-danger-text ml-1 font-black">*</span>}
          </label>
        )}

        {/* Khung chứa input và các biểu tượng tương tác */}
        <div className="relative flex items-center">
          {/* Biểu tượng bên trái */}
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-uupm-ink-muted">
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
            aria-describedby={describedById}
            className={className}
            {...props}
          />

          {/* Biểu tượng trạng thái Hợp lệ (dấu tích xanh) */}
          {!isPassword && isValid && !error && (
            <div className="absolute right-3.5 flex items-center pointer-events-none text-uupm-accent">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}

          {/* Nút bật/tắt hiển thị mật khẩu (Vùng chạm đạt chuẩn tối thiểu 40x40px) */}
          {isPassword && (
            <button
              type="button"
              disabled={disabled}
              onClick={onTogglePassword}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-1.5 w-10 h-10 flex items-center justify-center text-uupm-ink-muted hover:text-uupm-ink active:text-uupm-accent transition-colors rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
            className="flex items-center gap-1.5 text-xs font-bold text-uupm-danger-text mt-1 animate-in fade-in slide-in-from-top-1"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {/* Văn bản hướng dẫn phụ (Helper Text) */}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs font-semibold text-uupm-ink-muted mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

InputField.displayName = "InputField";
