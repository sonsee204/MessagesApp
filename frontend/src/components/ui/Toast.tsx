import React from "react";
import { CheckCircle2, ShieldAlert, AlertTriangle, Info, X } from "lucide-react";
import { useToastStore, ToastItem, ToastType } from "../../stores/toast.store";
import { cn } from "../../lib/utils";

/**
 * Cấu hình giao diện biểu tượng và màu sắc theo loại thông báo Popup.
 *
 * Toàn bộ màu ở đây đi qua token --uupm-* (nền = token pha alpha 10%, chữ =
 * token gốc). Trước đây mỗi loại dùng một cặp hex pastel cứng, nên ở theme tối
 * nền vẫn sáng trong khi chữ đổi sang tông sáng -> chữ gần như tàng hình.
 * Riêng icon trên nền đặc phải dùng token "chữ đặt trên nền" (danger-ink /
 * warn-soft-ink), không dùng text-white cố định.
 */
const toastConfig: Record<
  ToastType,
  {
    icon: React.ReactNode;
    bgClass: string;
    iconBgClass: string;
    titleColor: string;
    messageColor: string;
  }
> = {
  success: {
    icon: <CheckCircle2 className="w-4 h-4 text-uupm-accent-text" />,
    bgClass: "bg-uupm-accent/10",
    iconBgClass: "bg-uupm-accent",
    titleColor: "text-uupm-ink",
    messageColor: "text-uupm-ink-soft",
  },
  error: {
    icon: <ShieldAlert className="w-4 h-4 text-uupm-danger-ink" />,
    bgClass: "bg-uupm-danger/10",
    iconBgClass: "bg-uupm-danger",
    titleColor: "text-uupm-danger-text",
    messageColor: "text-uupm-danger-text",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 text-uupm-warn-soft-ink" />,
    bgClass: "bg-uupm-warn-soft/10",
    iconBgClass: "bg-uupm-warn-soft",
    titleColor: "text-uupm-ink-soft",
    messageColor: "text-uupm-ink-soft",
  },
  info: {
    icon: <Info className="w-4 h-4 text-uupm-accent-text" />,
    bgClass: "bg-uupm-accent/10",
    iconBgClass: "bg-uupm-accent-soft",
    titleColor: "text-uupm-ink",
    messageColor: "text-uupm-ink-soft",
  },
};

interface ToastCardProps {
  toast: ToastItem;
  onClose: (id: string) => void;
}

/**
 * Thẻ hiển thị thông báo đơn lẻ (Toast Card)
 * Chuẩn phong cách Tactile Neo-Brutalist:
 * 1. Viền 2px #2d3748, bóng đổ vật lý sắc nét shadow-uupm-2
 * 2. Biểu tượng trạng thái nổi bật với viền riêng biệt
 * 3. Nút đóng tactile có hiệu ứng lún nhẹ khi bấm
 * 4. Hiệu ứng trượt vào mượt mà (slide-in)
 */
const ToastCard: React.FC<ToastCardProps> = ({ toast, onClose }) => {
  const config = toastConfig[toast.type];

  return (
    <div
      role="alert"
      className={cn(
        "pointer-events-auto w-full p-3.5 rounded-xs border-2 border-uupm-line shadow-uupm-2 select-none",
        "flex items-start gap-3 transition-all duration-200 ease-out",
        "animate-in slide-in-from-top-3 fade-in duration-200",
        config.bgClass
      )}
    >
      {/* Huy hiệu Icon trạng thái Tactile */}
      <div
        className={cn(
          "w-8 h-8 rounded-xs border-2 border-uupm-line shadow-uupm-active flex items-center justify-center shrink-0 mt-0.5",
          config.iconBgClass
        )}
      >
        {config.icon}
      </div>

      {/* Nội dung thông báo */}
      <div className="flex-1 min-w-0 pr-1">
        {toast.title && (
          <h4 className={cn("text-xs font-black uppercase tracking-wider mb-0.5", config.titleColor)}>
            {toast.title}
          </h4>
        )}
        <p className={cn("text-xs font-bold leading-relaxed break-words", config.messageColor)}>
          {toast.message}
        </p>
      </div>

      {/* Nút Đóng Tactile */}
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="w-7 h-7 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink shrink-0 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
        aria-label="Đóng thông báo"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/**
 * Khung chứa toàn bộ thông báo Popup (ToastContainer)
 * Được gắn tại gốc ứng dụng (Root level) để hiển thị nổi trên tất cả các màn hình
 */
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-[calc(100%-40px)] pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
};
