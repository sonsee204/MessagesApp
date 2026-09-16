import React, { createContext, useContext } from "react";
import { useCall } from "./useCall";
import { UseCallReturn } from "../types/call.types";
import { IncomingCallModal } from "../components/molecules/IncomingCallModal";
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
