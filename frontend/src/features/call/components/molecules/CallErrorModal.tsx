import React, { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "../../../../lib/utils";

interface CallErrorModalProps {
  /** Nội dung lỗi thân thiện (lấy từ state.error, đã được xử lý thành tiếng Việt) */
  message: string;
  /** Có hiển thị nút "Thử lại" không — false khi lỗi không thể retry */
  canRetry?: boolean;
  /** Callback nút Thử lại: khởi tạo lại cuộc gọi */
  onRetry?: () => void;
  /** Callback nút Đóng: reset state về idle */
  onClose: () => void;
}

/**
 * Hộp thoại thông báo lỗi cuộc gọi (CallErrorModal - Molecule)
 * - Hiển thị cảnh báo sự cố kỹ thuật cuộc gọi (Watchdog timeout / ICE failed / lỗi thiết bị)
 * - Áp dụng native <dialog> kết hợp showModal() thuộc top-layer (tự động đè lên overlay CallScreen)
 * - Hỗ trợ phím tắt: Enter = Thử lại (khi canRetry) hoặc Đóng, Escape = Đóng
 * - Đạt chuẩn tiếp cận a11y với role="alertdialog" và aria-live="assertive"
 */
export const CallErrorModal: React.FC<CallErrorModalProps> = ({
  message,
  canRetry = false,
  onRetry,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  // Mở modal và khóa focus vào nút chính ngay khi component được render
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }

    // Tự động focus vào nút Thử lại nếu có thể retry, ngược lại focus nút Đóng
    primaryButtonRef.current?.focus();

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  // Xử lý phím tắt bàn phím: Enter = Thử lại (hoặc Đóng nếu không thể retry)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (canRetry && onRetry) {
        onRetry();
      } else {
        onClose();
      }
    }
  };

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      aria-labelledby="call-error-title"
      aria-describedby="call-error-desc"
      onCancel={(e) => {
        // Chặn đóng mặc định của trình duyệt để đảm bảo gọi onClose dọn dẹp state
        e.preventDefault();
        onClose();
      }}
      onKeyDown={handleKeyDown}
      className="m-auto w-full max-w-sm bg-transparent border-0 p-4 backdrop:bg-black/60 backdrop:backdrop-blur-sm z-50"
    >
      <div className="relative w-full bg-uupm-surface border-[3px] border-uupm-line rounded-xs shadow-uupm-1 p-6 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-150">
        {/* Biểu tượng cảnh báo tam giác */}
        <div className="mb-4">
          <div className="w-16 h-16 rounded-full border-4 border-uupm-line bg-uupm-danger/10 text-uupm-danger flex items-center justify-center shadow-uupm-2">
            <AlertTriangle className="w-8 h-8" />
          </div>
        </div>

        {/* Tiêu đề lỗi cuộc gọi */}
        <h3
          id="call-error-title"
          className="font-black text-lg text-uupm-ink leading-snug mb-2"
        >
          Không thể kết nối
        </h3>

        {/* Nội dung thông điệp lỗi chi tiết */}
        <p
          id="call-error-desc"
          className="text-sm font-bold text-uupm-ink-muted mb-6 px-2"
        >
          {message}
        </p>

        {/* Cụm nút bấm hành động */}
        <div
          className={cn(
            "flex items-center gap-3 w-full",
            canRetry ? "justify-end" : "justify-center"
          )}
        >
          {/* Nút Đóng (Esc) */}
          <button
            type="button"
            ref={!canRetry ? primaryButtonRef : undefined}
            onClick={onClose}
            aria-label="Đóng thông báo lỗi"
            title="Đóng (Esc)"
            className={cn(
              "min-h-[44px] px-4 py-2 rounded-xs border-2 border-uupm-line font-black text-sm transition-[background-color,box-shadow,transform] cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-uupm-accent focus-visible:outline-none",
              canRetry
                ? "flex-1 bg-uupm-surface hover:bg-uupm-hover text-uupm-ink shadow-uupm-active"
                : "w-full bg-uupm-surface hover:bg-uupm-hover text-uupm-ink shadow-uupm-active"
            )}
          >
            Đóng
          </button>

          {/* Nút Thử lại (Enter) - chỉ hiển thị khi có thể retry */}
          {canRetry && (
            <button
              ref={primaryButtonRef}
              type="button"
              onClick={onRetry}
              aria-label="Thử kết nối lại"
              title="Thử lại (Enter)"
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xs bg-uupm-accent hover:bg-uupm-accent-hover text-uupm-accent-text border-2 border-uupm-line shadow-uupm-active font-black text-sm transition-[background-color,box-shadow,transform] cursor-pointer active:translate-x-[1px] active:translate-y-[1px] focus-visible:ring-2 focus-visible:ring-uupm-line focus-visible:outline-none"
            >
              Thử lại
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
};
