import { useState, useRef, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import { RTC_PEER_CONFIG } from "../lib/webrtc-config";
import type {
  CallState,
  CallStatus,
  CallType,
  UseCallReturn,
  IncomingCallPayload,
  CallAcceptedPayload,
  SignalingSdpPayload,
  SignalingIcePayload,
  CallOfflinePayload,
  CallErrorPayload,
} from "../types/call.types";

/**
 * Trạng thái khởi tạo mặc định cho phiên cuộc gọi
 */
const INITIAL_CALL_STATE: CallState = {
  status: "idle",
  callId: null,
  callerId: null,
  callerName: null,
  calleeId: null,
  type: null,
  localStream: null,
  remoteStream: null,
  isAudioMuted: false,
  isVideoMuted: false,
  error: null,
};

/**
 * Custom Hook Headless quản lý toàn bộ vòng đời cuộc gọi WebRTC và Socket.IO Signaling:
 * - Quản lý máy trạng thái (idle -> dialing/ringing -> connecting -> active -> ended/missed/rejected/busy/offline)
 * - Tự động thiết lập và dọn dẹp RTCPeerConnection cùng MediaStream tracks
 * - Hẹn giờ chuông 30 giây phía Caller (Ring Timeout): tự động hủy cuộc gọi nếu không nhấc máy
 *
 * @returns Đối tượng UseCallReturn chứa trạng thái và các phương thức điều khiển
 */
export function useCall(): UseCallReturn {
  const [state, setState] = useState<CallState>(INITIAL_CALL_STATE);

  // Tham chiếu đồng bộ trạng thái trong effect tránh mutate ref trong render
  const stateRef = useRef<CallState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const callIdRef = useRef<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceDisconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  /**
   * Giải phóng và dọn dẹp toàn bộ tài nguyên WebRTC, media tracks và timers
   */
  const cleanupMediaAndPeer = useCallback((): void => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (iceDisconnectTimeoutRef.current) {
      clearTimeout(iceDisconnectTimeoutRef.current);
      iceDisconnectTimeoutRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
  }, []);

  /**
   * Chấm dứt phiên cuộc gọi tại chỗ và cập nhật trạng thái mới
   */
  const terminateSession = useCallback(
    (targetStatus: CallStatus, error: string | null = null): void => {
      cleanupMediaAndPeer();
      setState((prev) => ({
        ...prev,
        status: targetStatus,
        error,
        localStream: null,
        remoteStream: null,
      }));
    },
    [cleanupMediaAndPeer]
  );

  /**
   * Khởi tạo đối tượng RTCPeerConnection và gắn các bộ lắng nghe sự kiện mạng P2P
   * @param currentCallId Mã cuộc gọi dùng cho signaling
   */
  const createPeerConnection = useCallback(
    (currentCallId: string): RTCPeerConnection => {
      if (pcRef.current) {
        pcRef.current.close();
      }

      const pc = new RTCPeerConnection(RTC_PEER_CONFIG);
      pcRef.current = pc;
      const socket = getSocket();

      // Lắng nghe ứng viên ICE cục bộ và chuyển tiếp qua Socket.IO
      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          socket.emit("call:ice", {
            callId: callIdRef.current ?? currentCallId,
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          });
        }
      };

      // Tiếp nhận luồng media âm thanh/hình ảnh từ phía đối phương
      pc.ontrack = (event: RTCTrackEvent) => {
        const incomingStream = event.streams?.[0];
        if (incomingStream) {
          remoteStreamRef.current = incomingStream;
          setState((prev) => ({ ...prev, remoteStream: incomingStream }));
        } else {
          const stream = remoteStreamRef.current ?? new MediaStream();
          stream.addTrack(event.track);
          remoteStreamRef.current = stream;
          setState((prev) => ({ ...prev, remoteStream: stream }));
        }
      };

      // Theo dõi trạng thái kết nối ICE
      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        if (iceState === "connected" || iceState === "completed") {
          if (iceDisconnectTimeoutRef.current) {
            clearTimeout(iceDisconnectTimeoutRef.current);
            iceDisconnectTimeoutRef.current = null;
          }
          setState((prev) => ({ ...prev, status: "active" }));
        } else if (iceState === "disconnected") {
          // Chờ 3 giây trước khi ngắt kết nối hoàn toàn nếu không thể hồi phục
          if (!iceDisconnectTimeoutRef.current) {
            iceDisconnectTimeoutRef.current = setTimeout(() => {
              const activeCallId = callIdRef.current ?? currentCallId;
              if (activeCallId) {
                socket.emit("call:end", { callId: activeCallId });
              }
              terminateSession("ended");
            }, 3000);
          }
        } else if (iceState === "failed") {
          const activeCallId = callIdRef.current ?? currentCallId;
          if (activeCallId) {
            socket.emit("call:end", { callId: activeCallId });
          }
          terminateSession("ended");
        }
      };

      return pc;
    },
    [terminateSession]
  );

  /**
   * Phía Người gọi (Caller): Khởi tạo cuộc gọi và bật đếm ngược chuông 30 giây
   */
  const initiateCall = useCallback(
    async (calleeId: string, type: CallType): Promise<void> => {
      cleanupMediaAndPeer();
      callIdRef.current = null;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === "video",
        });

        localStreamRef.current = stream;
        const socket = getSocket();
        socket.emit("call:initiate", { calleeId, type });

        setState({
          status: "dialing",
          callId: null,
          callerId: null,
          callerName: null,
          calleeId,
          type,
          localStream: stream,
          remoteStream: null,
          isAudioMuted: false,
          isVideoMuted: false,
          error: null,
        });

        // Hẹn giờ 30s đổ chuông: nếu đối phương không nhấc máy, caller tự hủy và set missed
        ringTimeoutRef.current = setTimeout(() => {
          const currentCallId = callIdRef.current;
          socket.emit("call:cancel", { callId: currentCallId ?? "" });
          terminateSession("missed");
        }, 30000);
      } catch (err) {
        cleanupMediaAndPeer();
        setState((prev) => ({
          ...prev,
          status: "idle",
          error: err instanceof Error ? err.message : "Không thể truy cập micro/camera",
        }));
      }
    },
    [cleanupMediaAndPeer, terminateSession]
  );

  /**
   * Phía Người nhận (Callee): Chấp nhận cuộc gọi đến và gửi tín hiệu accept
   */
  const acceptCall = useCallback(async (): Promise<void> => {
    const currentCallId = callIdRef.current;
    if (!currentCallId) return;

    try {
      const callType = stateRef.current.type ?? "audio";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      localStreamRef.current = stream;
      const pc = createPeerConnection(currentCallId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const socket = getSocket();
      socket.emit("call:accept", { callId: currentCallId });

      setState((prev) => ({
        ...prev,
        status: "connecting",
        localStream: stream,
      }));
    } catch (err) {
      cleanupMediaAndPeer();
      setState((prev) => ({
        ...prev,
        status: "idle",
        error: err instanceof Error ? err.message : "Không thể truy cập micro/camera",
      }));
    }
  }, [createPeerConnection, cleanupMediaAndPeer]);

  /**
   * Phía Người nhận (Callee): Từ chối cuộc gọi đến
   */
  const declineCall = useCallback((): void => {
    const currentCallId = callIdRef.current;
    if (currentCallId) {
      getSocket().emit("call:decline", { callId: currentCallId });
    }
    terminateSession("rejected");
  }, [terminateSession]);

  /**
   * Kết thúc cuộc gọi đang diễn ra hoặc hủy cuộc gọi đang gọi
   */
  const endCall = useCallback((): void => {
    const currentCallId = callIdRef.current;
    const socket = getSocket();

    if (stateRef.current.status === "dialing") {
      socket.emit("call:cancel", { callId: currentCallId ?? "" });
    } else if (currentCallId) {
      socket.emit("call:end", { callId: currentCallId });
    }

    terminateSession("ended");
  }, [terminateSession]);

  /**
   * Bật/tắt micro cục bộ
   */
  const toggleAudio = useCallback((): void => {
    if (!localStreamRef.current) return;
    const nextMuted = !stateRef.current.isAudioMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setState((prev) => ({ ...prev, isAudioMuted: nextMuted }));
  }, []);

  /**
   * Bật/tắt camera cục bộ
   */
  const toggleVideo = useCallback((): void => {
    if (!localStreamRef.current) return;
    const nextMuted = !stateRef.current.isVideoMuted;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setState((prev) => ({ ...prev, isVideoMuted: nextMuted }));
  }, []);

  // Đăng ký các bộ lắng nghe sự kiện Socket.IO Signaling
  useEffect(() => {
    const socket = getSocket();

    // 1. Nhận cuộc gọi đến (Callee)
    const handleIncoming = (data: IncomingCallPayload): void => {
      callIdRef.current = data.callId;
      setState((prev) => ({
        ...prev,
        status: "ringing",
        callId: data.callId,
        callerId: data.callerId,
        callerName: data.callerName,
        type: data.type,
        error: null,
      }));
    };

    // 2. Phía Caller nhận sự kiện đối phương đã chấp nhận cuộc gọi
    const handleAccepted = async (data: CallAcceptedPayload): Promise<void> => {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
      callIdRef.current = data.callId;
      setState((prev) => ({
        ...prev,
        status: "connecting",
        callId: data.callId,
      }));

      try {
        const pc = createPeerConnection(data.callId);
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!);
          });
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", { callId: data.callId, sdp: offer });
      } catch (err) {
        terminateSession("ended", err instanceof Error ? err.message : "Lỗi tạo SDP Offer");
      }
    };

    // 3. Phía Callee nhận SDP Offer từ Caller và phản hồi SDP Answer
    const handleOffer = async (data: SignalingSdpPayload): Promise<void> => {
      try {
        let pc = pcRef.current;
        if (!pc) {
          pc = createPeerConnection(data.callId);
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
              pc!.addTrack(track, localStreamRef.current!);
            });
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

        // Bổ sung các ứng viên ICE nhận trước khi thiết lập Remote Description
        while (pendingIceCandidatesRef.current.length > 0) {
          const candidate = pendingIceCandidatesRef.current.shift();
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call:answer", { callId: data.callId, sdp: answer });
      } catch (err) {
        terminateSession("ended", err instanceof Error ? err.message : "Lỗi xử lý SDP Offer");
      }
    };

    // 4. Phía Caller nhận SDP Answer từ Callee
    const handleAnswer = async (data: SignalingSdpPayload): Promise<void> => {
      try {
        const pc = pcRef.current;
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          while (pendingIceCandidatesRef.current.length > 0) {
            const candidate = pendingIceCandidatesRef.current.shift();
            if (candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
          }
        }
      } catch (err) {
        terminateSession("ended", err instanceof Error ? err.message : "Lỗi thiết lập SDP Answer");
      }
    };

    // 5. Tiếp nhận và thêm ICE Candidate từ signaling
    const handleIce = async (data: SignalingIcePayload): Promise<void> => {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          // Bỏ qua lỗi ứng viên ICE không tương thích
        }
      } else {
        pendingIceCandidatesRef.current.push(data.candidate);
      }
    };

    // 6. Đối phương ngoại tuyến (Caller nhận)
    const handleOffline = (data: CallOfflinePayload): void => {
      if (data?.callId) {
        callIdRef.current = data.callId;
      }
      setState((prev) => ({
        ...prev,
        status: "offline",
        callId: data?.callId ?? prev.callId,
      }));
    };

    // 7. Máy chủ trả về thông báo lỗi
    const handleError = (data: CallErrorPayload): void => {
      terminateSession("ended", data?.message || "Đã xảy ra lỗi cuộc gọi");
    };

    // 8. Các sự kiện kết thúc / từ chối / hủy / bận
    const handleDeclined = (): void => terminateSession("rejected");
    const handleCanceled = (): void => terminateSession("missed");
    const handleEnded = (): void => terminateSession("ended");
    const handleBusy = (): void => terminateSession("busy");
    const handlePeerDisconnected = (): void => terminateSession("ended");

    // Đăng ký toàn bộ sự kiện Socket.IO
    socket.on("call:incoming", handleIncoming);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice", handleIce);
    socket.on("call:offline", handleOffline);
    socket.on("call:error", handleError);
    socket.on("call:declined", handleDeclined);
    socket.on("call:canceled", handleCanceled);
    socket.on("call:ended", handleEnded);
    socket.on("call:busy", handleBusy);
    socket.on("call:peer_disconnected", handlePeerDisconnected);

    // Hủy đăng ký đối ứng toàn bộ sự kiện khi unmount
    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice", handleIce);
      socket.off("call:offline", handleOffline);
      socket.off("call:error", handleError);
      socket.off("call:declined", handleDeclined);
      socket.off("call:canceled", handleCanceled);
      socket.off("call:ended", handleEnded);
      socket.off("call:busy", handleBusy);
      socket.off("call:peer_disconnected", handlePeerDisconnected);
      cleanupMediaAndPeer();
    };
  }, [createPeerConnection, cleanupMediaAndPeer, terminateSession]);

  return {
    state,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
  };
}
