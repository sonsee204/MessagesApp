import { create } from "zustand";

/**
 * Hai chế độ hiển thị của ứng dụng
 */
export type Theme = "light" | "dark";

/**
 * Khóa lưu lựa chọn theme trong localStorage.
 * Trùng với khóa mà đoạn script chống nhấp nháy trong index.html đọc,
 * nên nếu đổi tên ở đây PHẢI đổi cả ở đó.
 */
const STORAGE_KEY = "appmessaging-theme";

/**
 * Đọc theme ban đầu theo thứ tự ưu tiên:
 * 1. Lựa chọn người dùng đã lưu từ lần trước
 * 2. Cài đặt hệ điều hành (prefers-color-scheme)
 * 3. Mặc định "light"
 */
function getInitialTheme(): Theme {
  // localStorage có thể bị chặn (chế độ riêng tư của trình duyệt) và ném lỗi,
  // nên mọi truy cập đều phải bọc try/catch để không làm sập ứng dụng.
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Không đọc được thì bỏ qua, chuyển sang xét cài đặt hệ điều hành
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Gắn hoặc gỡ lớp `dark` trên thẻ <html>.
 * Tailwind cấu hình `darkMode: ["class"]` nên toàn bộ biến CSS trong .dark
 * chỉ kích hoạt khi thẻ <html> có lớp này.
 */
function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface ThemeState {
  theme: Theme;
  // Đặt theme cụ thể và ghi nhớ lựa chọn
  setTheme: (theme: Theme) => void;
  // Đảo qua lại giữa sáng và tối
  toggleTheme: () => void;
}

/**
 * Zustand Store quản lý chế độ hiển thị Sáng/Tối toàn ứng dụng.
 * Việc áp dụng lớp `dark` được thực hiện ngay trong action (chứ không qua useEffect)
 * để trạng thái DOM và trạng thái React luôn đồng bộ trong cùng một bước.
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),

  setTheme: (theme) => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Không ghi được thì thôi — theme vẫn hoạt động trong phiên hiện tại
    }
    set({ theme });
  },

  toggleTheme: () => {
    get().setTheme(get().theme === "dark" ? "light" : "dark");
  },
}));

// Đồng bộ lớp trên <html> ngay khi module được nạp.
// Đoạn script trong index.html đã đặt lớp này trước khi vẽ giao diện (chống nhấp nháy);
// lệnh dưới đây chỉ đảm bảo DOM khớp với state trong trường hợp script đó bị bỏ qua.
applyTheme(useThemeStore.getState().theme);
