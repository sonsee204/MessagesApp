import { useState, useRef, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import { RTC_PEER_CONFIG } from "../lib/webrtc-config";
import { toast } from "../../../stores/toast.store";
import type {
  CallState,
  CallStatus,
  CallType,
  UseCallReturn,
  IncomingCallPayload,
  CallInitiatedPayload,
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
  hasLocalVideo: false,
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
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const makingOfferRef = useRef(false); // cờ chống double-offer khi renegotiation
  const acquiringCameraRef = useRef(false); // cờ đang lấy camera giữa phiên (chống bấm đôi)

  /**
   * Giải phóng và dọn dẹp toàn bộ tài nguyên WebRTC, media tracks và timers
   */
  const cleanupMediaAndPeer = useCallback((): void => {
    acquiringCameraRef.current = false;
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (iceDisconnectTimeoutRef.current) {
      clearTimeout(iceDisconnectTimeoutRef.current);
      iceDisconnectTimeoutRef.current = null;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onnegotiationneeded = null;
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
   * Chấm dứt phiên cuộc gọi tại chỗ, dọn dẹp kết nối và đặt lại toàn bộ trạng thái phiên
   */
  const terminateSession = useCallback(
    (targetStatus: CallStatus, error: string | null = null): void => {
      cleanupMediaAndPeer();
      callIdRef.current = null;
      // ponytail:KHÔNG xóa calleeId/type — CallErrorModal cần 2 giá trị này để kích hoạt nút
      // "Thử lại" (call.state.calleeId !== null). callIdRef đã cắt đứt nên không rò rỉ sang
      // phiên mới; resetCall() sẽ xoá nốt khi người dùng đóng modal.
      setState((prev) => ({
        ...prev,
        status: targetStatus,
        error,
        callId: null,
        callerId: null,
        callerName: null,
        calleeId: prev.calleeId,
        type: prev.type,
        localStream: null,
        remoteStream: null,
        hasLocalVideo: false,
        isVideoMuted: false,
        isAudioMuted: false,
      }));
    },
    [cleanupMediaAndPeer]
  );

  /**
   * Hủy bộ hẹn giờ giám sát trạng thái connecting
   */
  const clearConnectionWatchdog = useCallback((): void => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);

  /**
   * Khởi động watchdog 10s: nếu sau 10s vẫn connecting (ICE không kết nối được) -> đóng phiên kèm thông báo lỗi
   */
  const startConnectionWatchdog = useCallback((): void => {
    clearConnectionWatchdog();
    connectionTimeoutRef.current = setTimeout(() => {
      // Chỉ đóng phiên khi vẫn đang ở trạng thái connecting
      if (stateRef.current.status === "connecting") {
        const socket = getSocket();
        const activeCallId = callIdRef.current;
        if (activeCallId) {
          socket.emit("call:end", { callId: activeCallId });
        }
        terminateSession("ended", "Không thể thiết lập kết nối. Vui lòng thử lại.");
      }
    }, 10_000);
  }, [clearConnectionWatchdog, terminateSession]);

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

      // Renegotiation: tạo SDP Offer mới khi add/remove track GIỮA phiên call (vd: bật cam giữa
      // phiên) và gửi qua signaling đã có. CHỈ dùng cho trường hợp mid-call toggle camera.
      // Lúc bắt tay initial, caller mới là người tạo offer (handleAccepted), callee chỉ trả lời
      // bằng answer -> callee (và caller) TUYỆT ĐỐI KHÔNG được tự tạo offer thêm, nếu không sẽ
      // glare với offer ban đầu (setRemoteDescription lỗi -> terminateSession -> màn hình call
      // biến mất ngay khi ấn nghe). pc.addTrack() LẦN ĐẦU lúc accept cũng fire sự kiện này, nên
      // phải chặn bằng status: chỉ cho renegotiate khi đã vào phiên active (bắt tay xong).
      // ponytail: va chạm offer đồng thời 2 chiều cùng bật cam 1 sát giờ rất hiếm — ngoài scope,
      // upgrade path là perfect negotiation đầy đủ.
      const negotiate = async (): Promise<void> => {
        // Chỉ renegotiate khi đã active: bật cam giữa phiên. Lúc connecting/initial, caller tự
        // drive offer, callee chỉ answer -> cấm tự tạo offer tránh glare crash màn hình gọi.
        if (stateRef.current.status !== "active") return;
        if (makingOfferRef.current || pc.signalingState !== "stable") return;
        if (!pc.remoteDescription) return; // chưa bắt tay xong -> chưa được renegotiate
        try {
          makingOfferRef.current = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("call:offer", { callId: callIdRef.current ?? currentCallId, sdp: offer });
        } catch {
          // Bỏ qua lỗi tạo offer tạm thời (sẽ retry qua renegotiationQueued ở answer kế tiếp)
        } finally {
          makingOfferRef.current = false;
        }
      };
      pc.onnegotiationneeded = () => {
        void negotiate();
      };

      // Theo dõi trạng thái kết nối ICE
      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        if (iceState === "connected" || iceState === "completed") {
          clearConnectionWatchdog();
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
          clearConnectionWatchdog();
          const activeCallId = callIdRef.current ?? currentCallId;
          if (activeCallId) {
            socket.emit("call:end", { callId: activeCallId });
          }
          terminateSession("ended", "Kết nối bị gián đoạn.");
        }
      };

      return pc;
    },
    [clearConnectionWatchdog, terminateSession]
  );

  /**
   * Phân loại lỗi getUserMedia thành thông điệp thân thiện cho người dùng Việt.
   * DOMException.name quyết định nguyên nhân: từ chối quyền, không có thiết bị, thiết bị bận...
   */
  const describeMediaError = (err: unknown, type: CallType): string => {
    const needCamera = type === "video";
    const device = needCamera ? "camera/micro" : "micro";
    const name = err instanceof DOMException ? err.name : "";
    switch (name) {
      case "NotAllowedError":
      case "SecurityError":
        return `Bạn đã chặn quyền truy cập ${device}. Hãy cấp quyền ${device} cho trình duyệt rồi thử lại.`;
      case "NotFoundError":
      case "OverconstrainedError":
        return `Không tìm thấy ${device} trên thiết bị này.`;
      case "NotReadableError":
        return `${needCamera ? "Camera hoặc micro" : "Micro"} đang bị ứng dụng khác sử dụng.`;
      default:
        return err instanceof Error && err.message
          ? err.message
          : `Không thể truy cập ${device}.`;
    }
  };

  /**
   * Phía Người gọi (Caller): Khởi tạo cuộc gọi và bật đếm ngược chuông 30 giây
   */
  const initiateCall = useCallback(
    async (calleeId: string, type: CallType): Promise<void> => {
      cleanupMediaAndPeer();
      callIdRef.current = null;

      // Đặt trạng thái "dialing" NGAY TRƯỚC khi gọi getUserMedia để CallScreen mount tức thì.
      // Nếu để sau await: lúc trình duyệt đang hiện hộp thoại xin quyền camera (hoặc treo ở
      // bước này) người dùng bấm nút mà không thấy màn hình nào -> tưởng app bị lỗi.
      setState({
        status: "dialing",
        callId: null,
        callerId: null,
        callerName: null,
        calleeId,
        type,
        localStream: null,
        remoteStream: null,
        isAudioMuted: false,
        isVideoMuted: false,
        // Khi bắt đầu gọi video, tạm thời coi hasLocalVideo = true để mount CallScreenActiveVideo; với gọi thoại là false
        hasLocalVideo: type === "video",
        error: null,
      });

      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === "video",
        });
      } catch (err) {
        // Thiết bị không có camera hoặc camera đang bận: fallback sang audio-only nhưng giữ nguyên video call
        const isCameraUnavailable =
          type === "video" &&
          err instanceof DOMException &&
          ["NotReadableError", "NotFoundError", "OverconstrainedError"].includes(err.name);

        if (isCameraUnavailable) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (err.name === "NotReadableError") {
              toast.info(
                "Camera đang bị ứng dụng khác chiếm — bạn vẫn vào cuộc gọi video bằng giọng nói và nhìn thấy đối phương.",
                "Camera đang bận"
              );
            } else {
              toast.info(
                "Không tìm thấy camera — bạn sẽ tham gia bằng giọng nói, vẫn nhìn thấy đối phương.",
                "Không tìm thấy camera"
              );
            }
          } catch {
            // Micro cũng không truy cập được → thất bại hoàn toàn
            stream = null;
          }
        }
        // Các lỗi khác (NotAllowed/Security) hoặc audio fallback cũng fail → báo lỗi
        if (!stream) {
          cleanupMediaAndPeer();
          const message = describeMediaError(err, type);
          setState((prev) => ({ ...prev, status: "idle", error: message }));
          toast.error(message, "Không thể bắt đầu cuộc gọi");
          return;
        }
      }

      // Xác định hasLocalVideo chuẩn xác dựa trên số lượng video tracks thực tế trong stream
      // (Đúng cho cả gọi thoại lẫn video, kể cả khi gọi video bị fallback sang audio)
      const hasLocalVideo = (stream?.getVideoTracks().length ?? 0) > 0;

      localStreamRef.current = stream;
      const socket = getSocket();
      socket.emit("call:initiate", { calleeId, type });

      // Cập nhật trạng thái cuộc gọi và luồng media cục bộ
      setState((prev) => ({
        ...prev,
        type,
        hasLocalVideo,
        localStream: stream,
      }));

      // Hẹn giờ 30s đổ chuông: nếu đối phương không nhấc máy, caller tự hủy và set missed
      ringTimeoutRef.current = setTimeout(() => {
        const currentCallId = callIdRef.current;
        socket.emit("call:cancel", { callId: currentCallId ?? "" });
        terminateSession("missed");
      }, 30000);
    },
    [cleanupMediaAndPeer, terminateSession]
  );

  /**
   * Phía Người nhận (Callee): Chấp nhận cuộc gọi đến và gửi tín hiệu accept
   */
  const acceptCall = useCallback(async (): Promise<void> => {
    const currentCallId = callIdRef.current;
    if (!currentCallId) return;

    const callType = stateRef.current.type ?? "audio";
    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
    } catch (err) {
      // Thiết bị nhận không có camera hoặc camera bận: fallback sang audio-only nhưng giữ nguyên video call
      const isCameraUnavailable =
        callType === "video" &&
        err instanceof DOMException &&
        ["NotReadableError", "NotFoundError", "OverconstrainedError"].includes(err.name);

      if (isCameraUnavailable) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (err.name === "NotReadableError") {
            toast.info(
              "Camera đang bị ứng dụng khác chiếm — bạn vẫn vào cuộc gọi video bằng giọng nói và nhìn thấy đối phương.",
              "Camera đang bận"
            );
          } else {
            toast.info(
              "Không tìm thấy camera — bạn sẽ tham gia bằng giọng nói, vẫn nhìn thấy đối phương.",
              "Không tìm thấy camera"
            );
          }
        } catch {
          stream = null;
        }
      }

      if (!stream) {
        const message = describeMediaError(err, callType);
        // KHÔNG dừng cuộc gọi: giữ nguyên callIdRef để modal còn hiển thị và người dùng thử lại.
        // Trước đây cleanupMediaAndPeer + về idle làm mất luôn state -> không hiện màn hình.
        setState((prev) => ({ ...prev, error: message }));
        toast.error(message, "Không thể truy cập thiết bị");
        return;
      }
    }

    // Xác định hasLocalVideo chuẩn xác dựa trên số lượng video tracks thực tế trong stream
    // (Đúng cho cả gọi thoại lẫn video, kể cả khi gọi video bị fallback sang audio)
    const hasLocalVideo = (stream?.getVideoTracks().length ?? 0) > 0;

    localStreamRef.current = stream;
    const pc = createPeerConnection(currentCallId);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const socket = getSocket();
    socket.emit("call:accept", { callId: currentCallId });

    setState((prev) => ({
      ...prev,
      status: "connecting",
      hasLocalVideo,
      localStream: stream,
    }));
  }, [createPeerConnection]);

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
    // Guard idempotent: đã terminal thì không emit nữa (chặn gửi call:end lên call đã kết thúc).
    // Bao gồm cả "offline": BE coi offline chưa terminal nên endCall sẽ ghi đè ended/endedAt
    // sai sự thật lên một cuộc gọi thực chất không diễn ra.
    if (
      stateRef.current.status === "ended" ||
      stateRef.current.status === "rejected" ||
      stateRef.current.status === "missed" ||
      stateRef.current.status === "busy" ||
      stateRef.current.status === "offline"
    ) {
      return;
    }

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
   * Bật/tắt camera cục bộ:
   * - Nếu đã có video track: chỉ bật/tắt enabled (gửi khung hình đen khi tắt, không cần renegotiation)
   * - Nếu chưa có video track (vào call không camera): xin cấp camera giữa phiên và addTrack, WebRTC renegotiation tự kích hoạt
   */
  const toggleVideo = useCallback((): void => {
    if (!localStreamRef.current || !pcRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length > 0) {
      // Đã có track: chỉ bật/tắt enabled (gửi khung hình đen khi tắt - không cần renegotiation)
      const nextMuted = !stateRef.current.isVideoMuted;
      videoTracks.forEach((track) => {
        track.enabled = !nextMuted;
      });
      setState((prev) => ({ ...prev, isVideoMuted: nextMuted }));
      return;
    }
    // Chưa có video track (vào call không cam): xin camera giữa phiên + addTrack -> negotiationneeded tự fire
    if (acquiringCameraRef.current) return;
    acquiringCameraRef.current = true;
    void navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((camStream) => {
        const stream = localStreamRef.current;
        const pc = pcRef.current;
        if (!stream || !pc) {
          camStream.getTracks().forEach((t) => t.stop()); // phiên đã kết thúc
          return;
        }
        camStream.getVideoTracks().forEach((track) => {
          stream.addTrack(track);
          pc.addTrack(track, stream);
        });
        // BẮT BUỘC truyền lại localStream: dù cùng reference, cần setState để trigger effect
        // gán srcObject vào videoEl (deps [state.localStream] — React giữ nguyên reference nên
        // nếu không setState, video mới add sẽ không hiển thị trên PiP → camera "bật ra xong ẩn").
        // BẮT BUỘC tạo MediaStream mới: React state dùng Object.is để so sánh, nếu truyền
        // cùng reference thì CallScreen effect [state.localStream] sẽ KHÔNG re-fire → video
        // mới add vào stream không gắn được vào videoEl (camera bật ra xong rồi ẩn).
        setState((prev) => ({ ...prev, localStream: new MediaStream(stream.getTracks()), hasLocalVideo: true, isVideoMuted: false }));
      })
      .catch(() => {
        toast.error(
          "Không thể bật camera. Hãy kiểm tra lại thiết bị và quyền truy cập.",
          "Không tìm thấy camera"
        );
      })
      .finally(() => {
        acquiringCameraRef.current = false;
      });
  }, []);

  /**
   * Đặt lại phiên cuộc gọi về trạng thái ban đầu (idle) và dọn dẹp tài nguyên
   */
  const resetCall = useCallback((): void => {
    cleanupMediaAndPeer();
    callIdRef.current = null;
    setState(INITIAL_CALL_STATE);
  }, [cleanupMediaAndPeer]);

  // Đăng ký các bộ lắng nghe sự kiện Socket.IO Signaling
  useEffect(() => {
    const socket = getSocket();

    // 1. Nhận cuộc gọi đến (Callee)
    const handleIncoming = (data: IncomingCallPayload): void => {
      // Đang trong cuộc gọi khác → bỏ qua incoming mới (server-side đã chặn ConflictError,
      // đây là lớp phòng thứ 2 cho race condition khi 2 client emit gần như đồng thời —
      // nếu cho qua, cuộc gọi active sẽ bị state incoming ghi đè và crash màn hình).
      if (stateRef.current.status !== "idle") return;

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

    // 1b. Nhận callId trả về từ server sau khi initiate (Caller).
    // Quan trọng: caller dùng callId này để phát call:cancel / timeout, nếu thiếu thì
    // server từ chối cancel -> callee không nhận được call:canceled -> modal reo mãi.
    const handleInitiated = (data: CallInitiatedPayload): void => {
      if (data?.callId) {
        callIdRef.current = data.callId;
        setState((prev) => ({ ...prev, callId: data.callId }));
      }
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
        startConnectionWatchdog();
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
    socket.on("call:initiated", handleInitiated);
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
      socket.off("call:initiated", handleInitiated);
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
  }, [createPeerConnection, cleanupMediaAndPeer, terminateSession, startConnectionWatchdog]);

  return {
    state,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    resetCall,
  };
}
