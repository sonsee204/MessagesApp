import React from "react";
import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../../stores/theme.store";
import { cn } from "../../lib/utils";

interface ThemeToggleProps {
  // Lớp bổ sung để căn chỉnh theo từng vị trí đặt nút
  className?: string;
}

/**
 * Nút chuyển đổi chế độ hiển thị Sáng / Tối (Theme Toggle)
 * Đọc và ghi trực tiếp vào Theme Store; store tự lo việc gắn lớp `dark` lên <html>.
 * Nút chỉ có biểu tượng nên bắt buộc phải có aria-label để trình đọc màn hình hiểu được.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className }) => {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      // Trạng thái đang bật/tắt được thông báo qua aria-pressed
      aria-pressed={isDark}
      aria-label={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      title={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      className={cn(
        "w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uupm-accent",
        className
      )}
    >
      {/* Hiển thị mặt trăng khi đang ở theme sáng (bấm để chuyển sang tối) và ngược lại */}
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
