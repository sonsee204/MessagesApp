import React, { useState, useEffect, useRef } from "react";
import { User as UserIcon, PhoneOff, Phone, Video as VideoIcon, RefreshCw } from "lucide-react";
import { CallState } from "../../types/call.types";
import { CallTimer } from "../atoms/CallTimer";
import { CallControls } from "../molecules/CallControls";
import { cn } from "../../../../lib/utils";

interface CallScreenActiveVideoProps {
  displayName: string;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  isSwapped: boolean;
  onSwap: () => void;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEnd: () => void;
}

/**
 * Giao diện cuộc gọi video đang hoạt động (Active Video Call View)
 */
function CallScreenActiveVideo({
  displayName,
  remoteVideoRef,
  localVideoRef,
  isSwapped,
  onSwap,
  isAudioMuted,
  isVideoMuted,
  onToggleAudio,
  onToggleVideo,
  onEnd,
}: CallScreenActiveVideoProps) {
  return (
    <div className="relative w-full h-full bg-black">
      {/* Thanh tiêu đề hiển thị tên đối tác và Timer */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30 p-3 bg-uupm-surface/80 backdrop-blur-md rounded-xs border-2 border-uupm-line shadow-uupm-active">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-uupm-accent animate-pulse" />
          <h2 className="text-sm font-black text-uupm-ink">{displayName}</h2>
        </div>
        <CallTimer active={true} className="text-uupm-ink font-mono" />
      </div>

      {/* Luồng Video chính (toàn màn hình) */}
      <video
        ref={isSwapped ? localVideoRef : remoteVideoRef}
        autoPlay
        playsInline
        muted={isSwapped}
        className="w-full h-full object-cover"
      >
        <track kind="captions" />
      </video>

      {/* Luồng Video phụ (PiP nhỏ góc phải) */}
      <button
        type="button"
        onClick={onSwap}
        aria-label="Hoán đổi góc nhìn camera"
        title="Chạm để hoán đổi video"
        className="absolute bottom-24 right-4 sm:right-6 w-28 h-40 sm:w-36 sm:h-52 rounded-xs border-2 border-uupm-line shadow-uupm-2 overflow-hidden bg-uupm-surface z-30 cursor-pointer group transition-[transform] active:scale-95"
      >
        <video
          ref={isSwapped ? remoteVideoRef : localVideoRef}
          autoPlay
          playsInline
          muted={!isSwapped}
          className="w-full h-full object-cover pointer-events-none"
        >
          <track kind="captions" />
        </video>
        <div className="absolute top-1.5 right-1.5 p-1 rounded-xs bg-uupm-surface/80 border border-uupm-line opacity-0 group-hover:opacity-100 transition-opacity">
          <RefreshCw className="w-3 h-3 text-uupm-ink" />
        </div>
      </button>

      {/* Thanh điều khiển cuộc gọi đặt ở cạnh dưới */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
        <CallControls
          type="video"
          micOn={!isAudioMuted}
          camOn={!isVideoMuted}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onEnd={onEnd}
        />
      </div>
    </div>
  );
}

interface CallScreenNonVideoProps {
  displayName: string;
  isVideoCall: boolean;
  status: CallState["status"];
  type: CallState["type"];
  statusMessage: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEnd: () => void;
  onCancel?: () => void;
}

/**
 * Giao diện gọi thoại thuần hoặc các trạng thái chờ/kết nối/kết thúc
 */
function CallScreenNonVideo({
  displayName,
  isVideoCall,
  status,
  type,
  statusMessage,
  isAudioMuted,
  isVideoMuted,
  onToggleAudio,
  onToggleVideo,
  onEnd,
  onCancel,
}: CallScreenNonVideoProps) {
  const isDialingOrConnecting = status === "dialing" || status === "connecting";

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-6">
      {/* Nửa trên: Header nhỏ góc trên */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-uupm-surface border-2 border-uupm-line rounded-xs shadow-uupm-active">
          {isVideoCall ? (
            <VideoIcon className="w-4 h-4 text-uupm-accent" />
          ) : (
            <Phone className="w-4 h-4 text-uupm-accent" />
          )}
          <span className="text-xs font-bold text-uupm-ink">
            {isVideoCall ? "Cuộc gọi video" : "Cuộc gọi thoại"}
          </span>
        </div>
        {status === "active" && (
          <div className="px-3 py-1.5 bg-uupm-surface border-2 border-uupm-line rounded-xs shadow-uupm-active">
            <CallTimer active={true} className="text-uupm-ink" />
          </div>
        )}
      </div>

      {/* Khối trung tâm: Avatar xúc giác Tactile và Trạng thái */}
      <div className="flex flex-col items-center gap-4 z-10">
        <div className="relative">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-xs border-4 border-uupm-line bg-uupm-accent-soft flex items-center justify-center text-uupm-ink shadow-uupm-1 overflow-hidden">
            <UserIcon className="w-16 h-16 text-uupm-ink" />
          </div>
          {isDialingOrConnecting && (
            <span className="absolute -bottom-2 -right-2 flex h-6 w-6">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-uupm-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-6 w-6 bg-uupm-accent border-2 border-uupm-line" />
            </span>
          )}
        </div>

        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black text-uupm-ink mb-1">
            {displayName}
          </h1>
          <p className="text-sm font-bold text-uupm-ink-muted animate-pulse">
            {statusMessage}
          </p>
        </div>
      </div>

      {/* Nửa dưới: Dàn nút điều khiển hoặc nút Hủy cuộc gọi */}
      <div className="w-full flex justify-center pb-4 z-10">
        {status === "active" ? (
          <CallControls
            type={type || "audio"}
            micOn={!isAudioMuted}
            camOn={!isVideoMuted}
            onToggleAudio={onToggleAudio}
            onToggleVideo={onToggleVideo}
            onEnd={onEnd}
          />
        ) : status === "dialing" ? (
          <button
            type="button"
            onClick={onCancel || onEnd}
            aria-label="Hủy cuộc gọi"
            className="px-6 py-3 min-h-[44px] rounded-xs bg-uupm-danger hover:bg-uupm-danger-hover text-uupm-danger-text border-2 border-uupm-line shadow-uupm-active font-black text-sm flex items-center gap-2 cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <PhoneOff className="w-5 h-5" />
            <span>Hủy cuộc gọi</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface CallScreenProps {
  /** Toàn bộ trạng thái phiên cuộc gọi từ useCall */
  state: CallState;
  /** Hàm callback chấp nhận cuộc gọi (nếu hiển thị trong màn hình) */
  onAccept?: () => void;
  /** Hàm callback từ chối cuộc gọi */
  onDecline?: () => void;
  /** Hàm callback kết thúc cuộc gọi */
  onEnd: () => void;
  /** Hàm callback bật/tắt micro */
  onToggleAudio: () => void;
  /** Hàm callback bật/tắt camera */
  onToggleVideo: () => void;
  /** Hàm callback hủy cuộc gọi đang gọi */
  onCancel?: () => void;
  /** Hàm callback đóng màn hình cuộc gọi khi hoàn tất (reset về idle) */
  onClose?: () => void;
  /** Tên đối tác cuộc gọi nếu có sẵn */
  peerName?: string;
  /** Lớp CSS bổ sung */
  className?: string;
}

/**
 * Màn hình cuộc gọi toàn màn hình (CallScreen - Organism)
 * - Tương thích Mobile-First (h-dvh tràn viền)
 * - Quản lý video P2P (Remote stream fullscreen + Local stream PiP góc phải)
 * - Hỗ trợ chạm để hoán đổi video PiP (Swap local & remote)
 * - Quản lý các trạng thái: dialing, connecting, active, và các trạng thái kết thúc (ended, missed, rejected, busy, offline)
 * - Tự động đóng màn hình sau 2 giây khi cuộc gọi rơi vào trạng thái kết thúc
 */
export const CallScreen: React.FC<CallScreenProps> = ({
  state,
  onEnd,
  onToggleAudio,
  onToggleVideo,
  onCancel,
  onClose,
  peerName,
  className,
}) => {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [isSwapped, setIsSwapped] = useState<boolean>(false);

  const displayName = state.callerName || peerName || "Người dùng";
  const isVideoCall = state.type === "video";
  const isTerminal = ["ended", "rejected", "missed", "busy", "offline"].includes(state.status);

  // Gán luồng Remote MediaStream vào thẻ <video> đối phương
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (videoEl) {
      videoEl.srcObject = state.remoteStream;
    }
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [state.remoteStream]);

  // Gán luồng Local MediaStream vào thẻ <video> cá nhân (PiP)
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (videoEl) {
      videoEl.srcObject = state.localStream;
    }
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [state.localStream]);

  // Lắng nghe phím Escape để hủy hoặc kết thúc nhanh cuộc gọi
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (onCancel) {
          onCancel();
        } else {
          onEnd();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, onEnd]);

  // Tự động đóng màn hình cuộc gọi sau 2 giây khi kết thúc hoặc bị từ chối/bận
  useEffect(() => {
    if (!isTerminal) return;

    const timer = setTimeout(() => {
      if (onClose) {
        onClose();
      } else {
        onEnd();
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [isTerminal, onClose, onEnd]);

  /**
   * Lấy thông điệp trạng thái cho người dùng
   */
  const getStatusMessage = (): string => {
    switch (state.status) {
      case "dialing":
        return "Đang đổ chuông...";
      case "connecting":
        return "Đang thiết lập kết nối WebRTC...";
      case "active":
        return "Đang trong cuộc gọi";
      case "rejected":
        return "Đối phương đã từ chối cuộc gọi";
      case "missed":
        return "Cuộc gọi nhỡ (Không trả lời)";
      case "busy":
        return "Đối phương hiện đang bận cuộc gọi khác";
      case "offline":
        return "Đối phương hiện không trực tuyến";
      case "ended":
        return "Cuộc gọi đã kết thúc";
      default:
        return "Đang xử lý...";
    }
  };

  return (
    <div
      role="region"
      aria-label="Màn hình cuộc gọi"
      className={cn(
        "fixed inset-0 z-50 h-dvh w-screen bg-uupm-page flex flex-col justify-between overflow-hidden select-none",
        className
      )}
    >
      {isVideoCall && state.status === "active" ? (
        <CallScreenActiveVideo
          displayName={displayName}
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
          isSwapped={isSwapped}
          onSwap={() => setIsSwapped((prev) => !prev)}
          isAudioMuted={state.isAudioMuted}
          isVideoMuted={state.isVideoMuted}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onEnd={onEnd}
        />
      ) : (
        <CallScreenNonVideo
          displayName={displayName}
          isVideoCall={isVideoCall}
          status={state.status}
          type={state.type}
          statusMessage={getStatusMessage()}
          isAudioMuted={state.isAudioMuted}
          isVideoMuted={state.isVideoMuted}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onEnd={onEnd}
          onCancel={onCancel}
        />
      )}
    </div>
  );
};
