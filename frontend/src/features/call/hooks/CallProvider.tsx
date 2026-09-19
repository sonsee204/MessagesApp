import React, { createContext, useContext } from "react";
import { useCall } from "./useCall";
import { useRingtone } from "./useRingtone";
import { UseCallReturn } from "../types/call.types";
import { IncomingCallModal } from "../components/molecules/IncomingCallModal";
import { CallErrorModal } from "../components/molecules/CallErrorModal";
import { CallScreen } from "../components/organisms/CallScreen";

/**
 * React Context lưu trữ trạng thái và các hành động cuộc gọi toàn cục
 */
const CallContext = createContext<UseCallReturn | null>(null);

interface CallProviderProps {
  children: React.ReactNode;
}

/**
 * Provider quản lý vòng đời cuộc gọi toàn cục (CallProvider)
 * - Đảm bảo máy trạng thái cuộc gọi duy trì liên tục xuyên suốt quá trình điều hướng
 * - Tự động hiển thị IncomingCallModal khi có cuộc gọi đến (status: ringing)
 * - Tự động hiển thị CallScreen khi đang gọi, đang kết nối hoặc trong đàm thoại
 */
export const CallProvider: React.FC<CallProviderProps> = ({ children }) => {
  const call = useCall();

  // Phát nhạc chuông đổ máy (ringback tone) khi người gọi đang chờ đối phương nhấc máy
  // Dừng ngay khi trạng thái chuyển sang connecting/active hoặc bị huỷ
  useRingtone(call.state.status === "dialing");

  const handleDeclineIncoming = () => {
    call.declineCall();
    // Callee sau khi bấm từ chối sẽ đóng ngay modal và trở lại trạng thái idle
    call.resetCall();
  };

  return (
    <CallContext.Provider value={call}>
      {children}

      {/* 1. Modal Cuộc gọi đến khi đối phương đang đổ chuông (status === "ringing") */}
      {call.state.status === "ringing" && (
        <IncomingCallModal
          peerName={call.state.callerName || "Người dùng"}
          callType={call.state.type || "audio"}
          onAccept={call.acceptCall}
          onDecline={handleDeclineIncoming}
        />
      )}

      {/* 2. Màn hình cuộc gọi toàn cục khi không ở trạng thái idle và ringing */}
      {call.state.status !== "idle" && call.state.status !== "ringing" && (
        <CallScreen
          state={call.state}
          onEnd={call.endCall}
          onToggleAudio={call.toggleAudio}
          onToggleVideo={call.toggleVideo}
          onCancel={call.endCall}
          onClose={call.resetCall}
        />
      )}

      {/* 3. Modal lỗi kỹ thuật cuộc gọi (watchdog timeout / ICE failed / lỗi thiết bị) — chỉ hiện khi
           có error và phiên chưa idle. busy/offline/rejected có error === null nên KHÔNG hiện modal
           (chỉ hiện statusMessage + nút Đóng ở CallScreen).
           canRetry: caller giữ calleeId+type → thử lại bằng initiateCall; callee giữ callId
           của phiên tới → thử lại bằng acceptCall (tiếp tục phiên đang ring thay vì tạo mới). */}
      {call.state.error && call.state.status !== "idle" && (
        <CallErrorModal
          message={call.state.error}
          canRetry={
            (call.state.calleeId !== null && call.state.type !== null) ||
            call.state.callId !== null
          }
          onRetry={() => {
            const { calleeId, type, callId } = call.state;
            call.resetCall();
            if (calleeId && type) {
              void call.initiateCall(calleeId, type);
            } else if (callId) {
              // Callee: chấp nhận lại chính phiên đang đổ chuông (callIdRef phải khớp callId).
              call.acceptCall();
            }
          }}
          onClose={call.resetCall}
        />
      )}
    </CallContext.Provider>
  );
};

/**
 * Hook truy xuất phiên cuộc gọi toàn cục từ CallContext
 */
export function useCallContext(): UseCallReturn {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCallContext phải được sử dụng bên trong CallProvider");
  }
  return context;
}

/**
 * Bí danh (Alias) cho useCallContext nhằm đồng bộ theo quy ước đặt tên
 */
export const useCallInstance = useCallContext;
