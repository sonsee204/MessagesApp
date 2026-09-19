import React, { useState, useEffect, useRef } from "react";
import { User as UserIcon, PhoneOff, Phone, Video as VideoIcon, RefreshCw, X } from "lucide-react";
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
  /** Người dùng có video track cục bộ hay không (false khi thiết bị không có camera / chưa bật cam) */
  hasLocalVideo: boolean;
  /** Phía đối phương có đang gửi video track hay không */
  hasRemoteVideo: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEnd: () => void;
  /** Trạng thái phiên gọi — video screen hiển thị từ lúc dialing (giống Facebook) */
  status: CallState["status"];
  /** Thông điệp trạng thái ("Đang đổ chuông..." / "Đang thiết lập kết nối...") */
  statusMessage: string;
  /** Nút hủy khi đang gọi chưa kết nối */
  onCancel?: () => void;
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
  hasLocalVideo,
  hasRemoteVideo,
  onToggleAudio,
  onToggleVideo,
  onEnd,
  status,
  statusMessage,
  onCancel,
}: CallScreenActiveVideoProps) {
  const isPreActive = status === "dialing" || status === "connecting";

  // Xác định màn hình chính đang hiển thị video cục bộ hay video đối phương
  const mainShowsLocal = isPreActive || isSwapped;
  // Màn hình chính có video để hiển thị hay không
  const mainHasVideo = mainShowsLocal ? hasLocalVideo && !isVideoMuted : hasRemoteVideo;

  // Xác định khung nhìn phụ (PiP) có video hay không
  const pipShowsLocal = !isSwapped;
  const pipHasVideo = pipShowsLocal ? hasLocalVideo && !isVideoMuted : hasRemoteVideo;

  // CẢ HAI thẻ video luôn muted: qua chính sách autoplay của trình duyệt (video có tiếng bị chặn
  // tự phát). Âm thanh đối phương phát qua thẻ <audio> ẩn riêng trong CallScreen -> không echo,
  // không lỗi chồng tiếng khi hoán đổi PiP.
  return (
    <div className="relative w-full h-full bg-black">
      {/* Luồng Video chính (toàn màn hình) — LUÔN hiển thị kể từ lúc dialing (giống Facebook:
          bấm gọi là thấy camera của mình full-screen ngay lập tức).
          Khi chưa kết nối (preActive) chỉ có luồng cục bộ nên video chính gắn localVideoRef;
          tới lúc active mới chuyển sang remote (hoặc local nếu đã hoán đổi PiP). */}
      <video
        ref={isPreActive ? localVideoRef : isSwapped ? localVideoRef : remoteVideoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      >
        <track kind="captions" />
      </video>

      {/* Overlay avatar khi màn hình chính không có video để hiển thị (không có camera / tắt camera) */}
      {!mainHasVideo && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-uupm-page/95">
          <div className="w-28 h-28 rounded-xs border-4 border-uupm-line bg-uupm-accent-soft flex items-center justify-center text-uupm-ink shadow-uupm-1 overflow-hidden">
            <UserIcon className="w-16 h-16 text-uupm-ink" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-uupm-ink">
            {displayName}
          </h2>
          <p className="text-sm font-bold text-uupm-ink-muted">
            {isPreActive
              ? statusMessage
              : mainShowsLocal
              ? "Bạn đang không bật camera"
              : "Đối phương đang không bật camera"}
          </p>
        </div>
      )}

      {/* Overlay bán trong suốt khi chưa active: hiện tên đối phương + trạng thái + nút Hủy */}
      {isPreActive && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-between p-6 pointer-events-none">
          {hasLocalVideo ? (
            <div className="flex flex-col items-center gap-3 mt-[18vh]">
              <h1 className="text-2xl sm:text-3xl font-black text-white drop-shadow-lg">
                {displayName}
              </h1>
              <p className="text-sm font-bold text-white/80 animate-pulse drop-shadow">
                {statusMessage}
              </p>
            </div>
          ) : (
            <div />
          )}
          {/* Nút Hủy cuộc gọi khi đang đổ chuông (dialing) hoặc đang kết nối WebRTC (connecting) */}
          {(status === "dialing" || status === "connecting") && (
            <button
              type="button"
              onClick={status === "dialing" ? onCancel || onEnd : onEnd}
              aria-label="Hủy cuộc gọi"
              className="pointer-events-auto px-6 py-3 min-h-[44px] rounded-xs bg-uupm-danger hover:bg-uupm-danger-hover text-uupm-danger-text border-2 border-uupm-line shadow-uupm-active font-black text-sm flex items-center gap-2 cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px] mb-24"
            >
              <PhoneOff className="w-5 h-5" />
              <span>Hủy cuộc gọi</span>
            </button>
          )}
        </div>
      )}

      {/* Luồng Video phụ (PiP nhỏ góc phải) — chỉ hiện khi active */}
      {!isPreActive && (
        <button
          type="button"
          onClick={onSwap}
          aria-label="Hoán đổi góc nhìn camera"
          title="Chạm để hoán đổi video"
          className="absolute bottom-24 right-4 sm:right-6 w-28 h-40 sm:w-36 sm:h-52 rounded-xs border-2 border-uupm-line shadow-uupm-2 overflow-hidden bg-uupm-surface z-30 cursor-pointer group transition-[transform] active:scale-95"
        >
          {!pipHasVideo ? (
            <div className="w-full h-full flex items-center justify-center bg-uupm-surface">
              <UserIcon className="w-10 h-10 text-uupm-ink" aria-hidden="true" />
            </div>
          ) : (
            <video
              ref={isSwapped ? remoteVideoRef : localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover pointer-events-none"
            >
              <track kind="captions" />
            </video>
          )}
          <div className="absolute top-1.5 right-1.5 p-1 rounded-xs bg-uupm-surface/80 border border-uupm-line opacity-0 group-hover:opacity-100 transition-opacity">
            <RefreshCw className="w-3 h-3 text-uupm-ink" />
          </div>
        </button>
      )}

      {/* Thanh tiêu đề + Timer (chỉ hiện khi active — timer chỉ đếm khi status thực sự active) */}
      {!isPreActive && (
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30 p-3 bg-uupm-surface/80 backdrop-blur-md rounded-xs border-2 border-uupm-line shadow-uupm-active">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-uupm-accent animate-pulse" />
            <h2 className="text-sm font-black text-uupm-ink">{displayName}</h2>
          </div>
          <CallTimer active={status === "active"} className="text-uupm-ink font-mono" />
        </div>
      )}

      {/* Thanh điều khiển cuộc gọi đặt ở cạnh dưới (chỉ khi active — dialing đã có nút Hủy riêng) */}
      {!isPreActive && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
          <CallControls
            type="video"
            micOn={!isAudioMuted}
            camOn={!isVideoMuted && hasLocalVideo}
            onToggleAudio={onToggleAudio}
            onToggleVideo={onToggleVideo}
            onEnd={onEnd}
          />
        </div>
      )}
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
  /** Người dùng có video track cục bộ hay không */
  hasLocalVideo?: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEnd: () => void;
  onCancel?: () => void;
  /** Hàm callback đóng màn hình cuộc gọi khi hoàn tất (reset về idle) */
  onClose?: () => void;
  /** Trạng thái cuộc gọi đã kết thúc hay chưa (tận dụng từ CallScreen) */
  isTerminal?: boolean;
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
  hasLocalVideo,
  onToggleAudio,
  onToggleVideo,
  onEnd,
  onCancel,
  onClose,
  isTerminal,
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

      {/* Nửa dưới: Dàn nút điều khiển (khi active) hoặc nút Hủy / Đóng (khi chờ hoặc kết thúc) */}
      <div className="w-full flex justify-center pb-4 z-10">
        {status === "active" ? (
          <CallControls
            type={type || "audio"}
            micOn={!isAudioMuted}
            camOn={!!hasLocalVideo && !isVideoMuted}
            onToggleAudio={onToggleAudio}
            onToggleVideo={onToggleVideo}
            onEnd={onEnd}
          />
        ) : isDialingOrConnecting ? (
          <button
            type="button"
            onClick={status === "dialing" ? onCancel || onEnd : onEnd}
            aria-label="Hủy cuộc gọi"
            className="px-6 py-3 min-h-[44px] rounded-xs bg-uupm-danger hover:bg-uupm-danger-hover text-uupm-danger-text border-2 border-uupm-line shadow-uupm-active font-black text-sm flex items-center gap-2 cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <PhoneOff className="w-5 h-5" />
            <span>Hủy cuộc gọi</span>
          </button>
        ) : isTerminal ? (
          <button
            type="button"
            onClick={onClose || onEnd}
            aria-label="Đóng màn hình cuộc gọi"
            className="px-6 py-3 min-h-[44px] rounded-xs bg-uupm-surface hover:bg-uupm-surface/80 text-uupm-ink border-2 border-uupm-line shadow-uupm-active font-black text-sm flex items-center gap-2 cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <X className="w-5 h-5" />
            <span>Đóng</span>
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
  // Ref cho thẻ <audio> ẩn dùng khi cuộc gọi audio (không video) — remoteStream cần một element DOM
  // để phát audio từ đối phương, nếu không stream sẽ bị orphan và không nghe được gì.
  // (Mic cục bộ KHÔNG phát ra loa nên không cần thẻ audio cho local stream — tránh echo.)
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [isSwapped, setIsSwapped] = useState<boolean>(false);

  const displayName = state.callerName || peerName || "Người dùng";
  const isVideoCall = state.type === "video";
  const isTerminal = ["ended", "rejected", "missed", "busy", "offline"].includes(state.status);
  // Audio của đối phương LUÔN phát qua thẻ <audio> ẩn khi đang trong cuộc gọi (cả thoại lẫn video),
  // vì hai thẻ <video> trong CallScreenActiveVideo đều muted để lách chính sách autoplay.
  // Mount từ lúc status !== "idle" để bắt kịp remote stream đến sớm ở connecting.
  const isCallInProgress = state.status !== "idle";

  // Xác định phía đối phương có video track hay không (hỗ trợ renegotiation khi đối phương bật cam giữa phiên)
  // stream object giữ nguyên ref khi renegotiation thêm track, nhưng ontrack tạo state mới nên render lại — OK
  const hasRemoteVideo = !!state.remoteStream && state.remoteStream.getVideoTracks().length > 0;

  // Hiển thị giao diện video khi:
  // 1. Cuộc gọi khởi tạo là video (isVideoCall), HOẶC
  // 2. Người dùng cục bộ có video track thật (state.hasLocalVideo), HOẶC
  // 3. Phía đối phương gửi video track sang (hasRemoteVideo).
  // Nhờ đó, cuộc gọi thoại có thể tự động biến thành cuộc gọi video hai chiều ngay giữa phiên (giống Messenger).
  const showVideoLayout = isVideoCall || state.hasLocalVideo || hasRemoteVideo;

  // Gán luồng Remote MediaStream vào thẻ <video> đối phương (khi call video)
  // hoặc thẻ <audio> ẩn (khi call thoại) — nếu không audio sẽ không phát được.
  // Deps có state.status/state.type/showVideoLayout: khi chuyển sang active hoặc chuyển layout sang video,
  // CallScreenActiveVideo mới mount (ref lúc đó mới tồn tại) nên bắt buộc effect chạy lại để gán srcObject.
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (videoEl && state.remoteStream) {
      videoEl.srcObject = state.remoteStream;
      // Gọi play() tường minh để vượt chính sách autoplay (video remote có tiếng -> bị chặn autoplay)
      void videoEl.play().catch(() => {});
    }
    const audioEl = remoteAudioRef.current;
    if (audioEl && state.remoteStream) {
      audioEl.srcObject = state.remoteStream;
      void audioEl.play().catch(() => {});
    }
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
      if (audioEl) {
        audioEl.srcObject = null;
      }
    };
  }, [state.remoteStream, state.status, state.type, isSwapped, showVideoLayout, hasRemoteVideo]);

  // Gán luồng Local MediaStream vào thẻ <video> cá nhân (PiP).
  // Deps PHẢI có state.status/state.type/showVideoLayout: lúc dialing/connecting hoặc khi đang gọi thoại
  // chưa có video thì component video chưa mount. Khi layout chuyển sang video, ref mới tồn tại,
  // effect re-run nhờ các dep này mới gán được srcObject.
  // Micro cục bộ KHÔNG phát ra loa (tránh echo) nên không gắn vào localAudioRef.
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (videoEl && state.localStream) {
      videoEl.srcObject = state.localStream;
      void videoEl.play().catch(() => {});
    }
    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [state.localStream, state.status, state.type, showVideoLayout, state.hasLocalVideo]);

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
  // ponytail:BỎ QUA auto-close khi đang có error — CallErrorModal (top-layer) đang hiển thị
  // lỗi kỹ thuật (watchdog timeout / ICE failed), modal chủ động gọi resetCall khi người dùng
  // bấm Đóng. Auto-close ở đây sẽ tắt modal sau 2s -> người dùng chưa kịp đọc lỗi.
  useEffect(() => {
    if (!isTerminal || state.error) return;

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
  }, [isTerminal, state.error, onClose, onEnd]);

  /**
   * Lấy thông điệp trạng thái cho người dùng
   */
  const getStatusMessage = (): string => {
    // Lỗi kỹ thuật (watchdog timeout, ICE failed, lỗi thiết bị) được ưu tiên hiển thị
    // trước message mặc định — kết quả truyền từ terminateSession("...", message).
    if (state.error) return state.error;

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
      {showVideoLayout ? (
        <CallScreenActiveVideo
          displayName={displayName}
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
          isSwapped={isSwapped}
          onSwap={() => setIsSwapped((prev) => !prev)}
          isAudioMuted={state.isAudioMuted}
          isVideoMuted={state.isVideoMuted}
          hasLocalVideo={state.hasLocalVideo}
          hasRemoteVideo={hasRemoteVideo}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onEnd={onEnd}
          status={state.status}
          statusMessage={getStatusMessage()}
          onCancel={onCancel}
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
          hasLocalVideo={state.hasLocalVideo}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onEnd={onEnd}
          onCancel={onCancel}
          onClose={onClose}
          isTerminal={isTerminal}
        />
      )}

      {/* Thẻ <audio> ẩn LUÔN mount khi có activeCall (cả thoại lẫn video).
          Trong video call, hai thẻ <video> trong CallScreenActiveVideo đều muted để lách
          autoplay policy, nên âm thanh remote phải đi qua thẻ audio này.
          Đặt NGOÀI ternary ở trên để không bị kẹt trong nhánh non-video. */}
      {isCallInProgress && (
        <audio
          ref={remoteAudioRef}
          className="hidden"
          aria-hidden="true"
        >
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
};
