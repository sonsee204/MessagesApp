import React from "react";
import { Phone, Video } from "lucide-react";
import { useCallContext } from "../../hooks/CallProvider";
import { toast } from "../../../../stores/toast.store";
import { cn } from "../../../../lib/utils";

export interface CallButtonsProps {
  /** Mã định danh của đối tác nhận cuộc gọi (Peer ID) */
  peerId?: string;
  /** Loại cuộc hội thoại (DIRECT hoặc GROUP) */
  conversationType: "DIRECT" | "GROUP" | string;
  /** Lớp CSS tuỳ biến cho từng nút bấm */
  className?: string;
}

/**
 * Cụm nút bấm khởi tạo cuộc gọi Thoại / Video (CallButtons - Molecule)
 * - Tách độc lập khỏi ChatHeader nhằm tuân thủ quy chuẩn Size-Gate
 * - Tự động ẩn nếu cuộc hội thoại là GROUP hoặc thiếu ID đối phương
 * - Sử dụng useCallContext để phát tín hiệu WebRTC khởi tạo phiên đàm thoại
 */
export const CallButtons: React.FC<CallButtonsProps> = ({
  peerId,
  conversationType,
  className,
}) => {
  const { initiateCall } = useCallContext();

  // Chỉ hiển thị cụm nút gọi cho các cuộc hội thoại trực tiếp 1-1 có đối tác hợp lệ
  if (conversationType !== "DIRECT" || !peerId) {
    return null;
  }

  // Khởi động cuộc gọi thoại hoặc video đến đối tác
  const handleStartCall = (type: "audio" | "video") => {
    if (!peerId) {
      toast.error("Không tìm thấy thông tin đối phương để bắt đầu cuộc gọi.", "Lỗi cuộc gọi");
      return;
    }
    initiateCall(peerId, type);
  };

  const buttonStyle = cn(
    "w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]",
    className
  );

  return (
    <>
      {/* Nút bấm khởi tạo cuộc gọi thoại */}
      <button
        type="button"
        onClick={() => handleStartCall("audio")}
        className={buttonStyle}
        title="Bắt đầu cuộc gọi thoại"
        aria-label="Bắt đầu cuộc gọi thoại"
      >
        <Phone className="w-4 h-4 text-uupm-ink-soft" />
      </button>

      {/* Nút bấm khởi tạo cuộc gọi video */}
      <button
        type="button"
        onClick={() => handleStartCall("video")}
        className={buttonStyle}
        title="Bắt đầu cuộc gọi video"
        aria-label="Bắt đầu cuộc gọi video"
      >
        <Video className="w-4 h-4 text-uupm-ink-soft" />
      </button>
    </>
  );
};
