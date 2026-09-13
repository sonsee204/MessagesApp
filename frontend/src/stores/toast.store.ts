import { create } from "zustand";

/**
 * Các loại thông báo Popup (Toast Notification)
 */
export type ToastType = "success" | "error" | "warning" | "info";

/**
 * Cấu trúc dữ liệu của một thông báo Toast Popup
 */
export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];

  // Thêm một thông báo mới vào hàng đợi
  addToast: (toast: Omit<ToastItem, "id">) => string;

  // Xóa một thông báo theo ID
  removeToast: (id: string) => void;

  // Xóa toàn bộ thông báo đang hiển thị
  clearAll: () => void;
}

/**
 * Zustand Store quản lý hàng đợi thông báo Popup (Toast Store)
 * Tự động đóng sau khoảng thời gian cấu hình (mặc định 4 giây)
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: ({ type, title, message, duration = 4000 }) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastItem = { id, type, title, message, duration };

    set((state) => ({
      // Giới hạn tối đa 5 thông báo cùng lúc để không làm choáng ngợp màn hình
      toasts: [newToast, ...state.toasts.slice(0, 4)],
    }));

    // Tự động biến mất sau thời gian quy định
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }

    return id;
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearAll: () => set({ toasts: [] }),
}));

/**
 * Đối tượng tiện ích gọi nhanh các hàm thông báo Popup (Toast Helper)
 * Dùng ở bất kỳ đâu trong component, service hoặc hook mà không cần khởi tạo lại hook
 */
export const toast = {
  success: (message: string, title = "Thành công") =>
    useToastStore.getState().addToast({ type: "success", title, message }),

  error: (message: string, title = "Thất bại") =>
    useToastStore.getState().addToast({ type: "error", title, message }),

  warning: (message: string, title = "Cảnh báo") =>
    useToastStore.getState().addToast({ type: "warning", title, message }),

  info: (message: string, title = "Thông báo") =>
    useToastStore.getState().addToast({ type: "info", title, message }),
};
