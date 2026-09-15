import React, { useEffect, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  /** Trạng thái hiển thị — dùng native <dialog>.showModal() thay vì mount/unmount */
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Cờ đang thực thi hành động — khóa nút và hiện spinner (tùy chọn) */
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Hộp thoại xác nhận hành động nhạy cảm (hủy kết bạn, chặn người dùng...).
 * Dùng native <dialog> để có focus trap & Escape đóng sẵn (rule prefer-html-dialog).
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = "Hủy bỏ",
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Đồng bộ trạng thái mở/đóng với native dialog (showModal tự trap focus + Escape)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    // onClose đồng bộ state khi Esc / close() — bắt buộc để không bị kẹt Esc.
    // Dùng margin:auto (m-auto) của UA để căn giữa thay vì fixed inset-0.
    // Không có backdrop button: hộp xác nhận không đóng khi click ra ngoài (đúng chủ đích).
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      aria-label={title}
      className="m-auto w-full max-w-sm bg-transparent border-0 p-4 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="relative z-10 w-full bg-uupm-surface border-[3px] border-uupm-line rounded-xs shadow-uupm-2 p-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-uupm-danger-text mb-3">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <h3 className="font-black text-base text-uupm-ink">{title}</h3>
        </div>
        <p className="text-xs text-uupm-ink-soft font-medium leading-relaxed mb-5">{description}</p>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            leftIcon={isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>

  );
};
