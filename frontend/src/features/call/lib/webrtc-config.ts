/**
 * Cấu hình WebRTC ICE Servers phục vụ cơ chế NAT Traversal
 * Giai đoạn MVP sử dụng máy chủ STUN công khai của Google để tìm kiếm địa chỉ công khai (reflexive candidate)
 */
export const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

/**
 * Cấu hình tiêu chuẩn cho đối tượng RTCPeerConnection
 */
export const RTC_PEER_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
};
