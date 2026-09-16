import React, { useEffect, useRef } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { CallType } from "../../types/call.types";
import { cn } from "../../../../lib/utils";

interface IncomingCallModalProps {
  /** Tên hiển thị của người gọi đến */
  peerName: string;
  /** Loại cuộc gọi đến: thoại (audio) hoặc video */
  callType: CallType;
  /** Hàm callback khi người dùng chấp nhận nghe máy */
  onAccept: () => void;
  /** Hàm callback khi người dùng từ chối cuộc gọi */
  onDecline: () => void;
}

/**
 * Hộp thoại thông báo cuộc gọi đến (IncomingCallModal - Molecule)
 * - Hiển thị dạng Alert Dialog toàn cục đè lên toàn bộ ứng dụng
 * - Áp dụng native <dialog> kết hợp showModal() để có Focus-Trap và khóa tương tác nền
 * - Hỗ trợ phím tắt: Enter = Chấp nhận, Escape = Từ chối
 * - Đạt chuẩn tiếp cận a11y với role="alertdialog" và aria-live="assertive"
 */
export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  peerName,
  callType,
  onAccept,
  onDecline,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const acceptButtonRef = useRef<HTMLButtonElement>(null);

  // Mở modal và khóa focus ngay khi component được render
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }

    // Tự động focus vào nút Chấp nhận
    acceptButtonRef.current?.focus();

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  // Xử lý phím tắt Enter (chấp nhận)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onAccept();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      aria-labelledby="incoming-call-title"
      aria-describedby="incoming-call-desc"
      onCancel={(e) => {
        e.preventDefault();
        onDecline();
      }}
      onKeyDown={handleKeyDown}
      className="m-auto w-full max-w-sm bg-transparent border-0 p-4 backdrop:bg-black/60 backdrop:backdrop-blur-sm z-50"
    >
      <div className="relative w-full bg-uupm-surface border-[3px] border-uupm-line rounded-xs shadow-uupm-1 p-6 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-150">
        {/* Khung avatar nhấp nháy tạo hiệu ứng đang đổ chuông */}
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-full border-4 border-uupm-line bg-uupm-accent flex items-center justify-center text-uupm-accent-text shadow-uupm-2 animate-pulse">
            {callType === "video" ? (
              <Video className="w-10 h-10" />
            ) : (
              <Phone className="w-10 h-10" />
            )}
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-uupm-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-uupm-accent border-2 border-uupm-line" />
          </span>
        </div>

        {/* Tiêu đề và thông tin cuộc gọi */}
        <h3
          id="incoming-call-title"
          className="font-black text-lg text-uupm-ink leading-snug mb-1"
        >
          {peerName}
        </h3>
        <p
          id="incoming-call-desc"
          className="text-xs font-bold text-uupm-ink-muted mb-6"
        >
          {callType === "video"
            ? "Cuộc gọi video đến..."
            : "Cuộc gọi thoại đến..."}
        </p>

        {/* Dàn nút thao tác Chấp nhận / Từ chối */}
        <div className="flex items-center justify-center gap-6 w-full">
          {/* Nút Từ chối (Esc) */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onDecline}
              aria-label="Từ chối cuộc gọi"
              title="Từ chối (Esc)"
              className="w-14 h-14 min-w-[44px] min-h-[44px] rounded-xs bg-uupm-danger hover:bg-uupm-danger-hover text-uupm-danger-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[11px] font-bold text-uupm-ink-muted">Từ chối</span>
          </div>

          {/* Nút Chấp nhận (Enter) */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              ref={acceptButtonRef}
              type="button"
              onClick={onAccept}
              aria-label="Chấp nhận cuộc gọi"
              title="Chấp nhận (Enter)"
              className={cn(
                "w-14 h-14 min-w-[44px] min-h-[44px] rounded-xs bg-uupm-accent hover:bg-uupm-accent-hover text-uupm-accent-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
              )}
            >
              {callType === "video" ? (
                <Video className="w-6 h-6" />
              ) : (
                <Phone className="w-6 h-6" />
              )}
            </button>
            <span className="text-[11px] font-bold text-uupm-ink">Trả lời</span>
          </div>
        </div>
      </div>
    </dialog>
  );
};
