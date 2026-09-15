import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Hộp thoại xác nhận hành động nhạy cảm (hủy kết bạn, chặn người dùng...).
 * Tách thành molecule dùng chung để triệt tiêu duplicate JSX giữa các modal confirm.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  description,
  confirmLabel,
  cancelLabel = "Hủy bỏ",
  onConfirm,
  onCancel,
}) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={title}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
  >
    <div className="w-full max-w-sm bg-uupm-surface border-3 border-uupm-line rounded-xs shadow-uupm-2 p-5 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center gap-3 text-uupm-danger-text mb-3">
        <AlertTriangle className="w-6 h-6 shrink-0" />
        <h3 className="font-black text-base text-uupm-ink">{title}</h3>
      </div>
      <p className="text-xs text-uupm-ink-soft font-medium leading-relaxed mb-5">{description}</p>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" variant="danger" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  </div>
);
