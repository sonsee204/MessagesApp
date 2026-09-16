/**
 * Định nghĩa loại cuộc gọi: chỉ thoại (audio) hoặc hình ảnh kèm thoại (video)
 */
export type CallType = "audio" | "video";

/**
 * Máy trạng thái (State Machine) quản lý vòng đời cuộc gọi:
 * - idle: Chưa có cuộc gọi nào
 * - dialing: Người gọi đã bấm gọi, đang chờ người nhận phản hồi (30s timeout)
 * - ringing: Người nhận đang đổ chuông
 * - connecting: Đã chấp nhận cuộc gọi, đang thiết lập bắt tay WebRTC P2P
 * - active: Kết nối WebRTC thành công (ICE connected), đàm thoại đang diễn ra
 * - ended: Cuộc gọi đã kết thúc bình thường
 * - rejected: Cuộc gọi bị người nhận từ chối
 * - missed: Cuộc gọi nhỡ do hết hạn thời gian chờ chuông 30s hoặc người gọi hủy
 * - busy: Đối phương đang trong cuộc gọi khác
 * - offline: Đối phương không trực tuyến
 */
export type CallStatus =
  | "idle"
  | "dialing"
  | "ringing"
  | "connecting"
  | "active"
  | "ended"
  | "rejected"
  | "missed"
  | "busy"
  | "offline";

/**
 * Trạng thái toàn diện của một phiên cuộc gọi
 */
export interface CallState {
  /** Trạng thái hiện tại của máy trạng thái cuộc gọi */
  status: CallStatus;
  /** Mã định danh cuộc gọi từ máy chủ */
  callId: string | null;
  /** Mã ID của người khởi tạo cuộc gọi */
  callerId: string | null;
  /** Tên hiển thị của người khởi tạo cuộc gọi */
  callerName: string | null;
  /** Mã ID của người nhận cuộc gọi */
  calleeId: string | null;
  /** Loại cuộc gọi: thoại hoặc video */
  type: CallType | null;
  /** Luồng media cục bộ (micro/camera của người dùng hiện tại) */
  localStream: MediaStream | null;
  /** Luồng media từ phía đối phương nhận qua kết nối WebRTC */
  remoteStream: MediaStream | null;
  /** Trạng thái tắt tiếng micro */
  isAudioMuted: boolean;
  /** Trạng thái tắt camera/hình ảnh */
  isVideoMuted: boolean;
  /** Thông điệp lỗi nếu phiên cuộc gọi gặp sự cố */
  error: string | null;
}

/**
 * Kết quả trả về từ Custom Hook useCall (Headless Pattern)
 */
export interface UseCallReturn {
  /** Trạng thái phiên cuộc gọi hiện thời */
  state: CallState;
  /** Khởi tạo cuộc gọi đi tới một người dùng khác */
  initiateCall: (calleeId: string, type: CallType) => Promise<void>;
  /** Người nhận chấp nhận cuộc gọi đến */
  acceptCall: () => Promise<void>;
  /** Người nhận từ chối cuộc gọi đến */
  declineCall: () => void;
  /** Kết thúc cuộc gọi đang diễn ra hoặc hủy cuộc gọi đang gọi */
  endCall: () => void;
  /** Bật/tắt micro cục bộ */
  toggleAudio: () => void;
  /** Bật/tắt camera cục bộ */
  toggleVideo: () => void;
}

/**
 * Payload sự kiện cuộc gọi đến từ Socket.IO máy chủ (call:incoming)
 */
export interface IncomingCallPayload {
  callId: string;
  callerId: string;
  callerName: string;
  type: CallType;
}

/**
 * Payload sự kiện cuộc gọi được chấp nhận (call:accepted)
 */
export interface CallAcceptedPayload {
  callId: string;
}

/**
 * Payload gói tin WebRTC SDP Offer / Answer
 */
export interface SignalingSdpPayload {
  callId: string;
  sdp: RTCSessionDescriptionInit;
  from?: string;
}

/**
 * Payload trao đổi ICE Candidate qua signaling
 */
export interface SignalingIcePayload {
  callId: string;
  candidate: RTCIceCandidateInit;
  from?: string;
}

/**
 * Payload thông báo người nhận đang ngoại tuyến (call:offline)
 */
export interface CallOfflinePayload {
  callId?: string;
  calleeId?: string;
}

/**
 * Payload thông báo lỗi cuộc gọi từ máy chủ (call:error)
 */
export interface CallErrorPayload {
  code: string;
  message: string;
}
