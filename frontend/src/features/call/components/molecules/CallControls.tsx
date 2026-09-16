import React from "react";
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff } from "lucide-react";
import { CallType } from "../../types/call.types";
import { cn } from "../../../../lib/utils";

interface CallControlsProps {
  /** Loại cuộc gọi hiện tại (audio hoặc video) */
  type: CallType;
  /** Trạng thái micro đang bật hay tắt */
  micOn: boolean;
  /** Trạng thái camera đang bật hay tắt (chỉ áp dụng cho video call) */
  camOn: boolean;
  /** Hàm callback bật/tắt micro */
  onToggleAudio: () => void;
  /** Hàm callback bật/tắt camera */
  onToggleVideo: () => void;
  /** Hàm callback kết thúc cuộc gọi */
  onEnd: () => void;
  /** Lớp CSS bổ sung */
  className?: string;
}

/**
 * Thanh điều khiển cuộc gọi (CallControls - Molecule)
 * - Điều khiển Micro, Camera (đối với Video Call) và nút Kết thúc
 * - Đáp ứng chuẩn tiếp cận a11y với touch target >= 44px và aria-label rõ ràng
 * - Sử dụng hoàn toàn Semantic Design Tokens và phong cách xúc giác Tactile
 */
export const CallControls: React.FC<CallControlsProps> = ({
  type,
  micOn,
  camOn,
  onToggleAudio,
  onToggleVideo,
  onEnd,
  className,
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Bảng điều khiển cuộc gọi"
      className={cn(
        "flex items-center justify-center gap-4 p-3 bg-uupm-surface/90 backdrop-blur-md border-2 border-uupm-line rounded-sm shadow-uupm-1",
        className
      )}
    >
      {/* Nút bật/tắt Micro */}
      <button
        type="button"
        onClick={onToggleAudio}
        aria-label={micOn ? "Tắt micro" : "Bật micro"}
        title={micOn ? "Tắt micro" : "Bật micro"}
        className={cn(
          "w-12 h-12 min-w-[44px] min-h-[44px] rounded-xs border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]",
          micOn
            ? "bg-uupm-surface hover:bg-uupm-surface-hover text-uupm-ink"
            : "bg-uupm-danger/20 text-uupm-danger-text border-uupm-danger"
        )}
      >
        {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>

      {/* Nút bật/tắt Camera (chỉ hiển thị khi là cuộc gọi Video) */}
      {type === "video" && (
        <button
          type="button"
          onClick={onToggleVideo}
          aria-label={camOn ? "Tắt camera" : "Bật camera"}
          title={camOn ? "Tắt camera" : "Bật camera"}
          className={cn(
            "w-12 h-12 min-w-[44px] min-h-[44px] rounded-xs border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]",
            camOn
              ? "bg-uupm-surface hover:bg-uupm-surface-hover text-uupm-ink"
              : "bg-uupm-danger/20 text-uupm-danger-text border-uupm-danger"
          )}
        >
          {camOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>
      )}

      {/* Nút Kết thúc cuộc gọi */}
      <button
        type="button"
        onClick={onEnd}
        aria-label="Kết thúc cuộc gọi"
        title="Kết thúc cuộc gọi"
        className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-xs bg-uupm-danger hover:bg-uupm-danger-hover text-uupm-danger-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
};
