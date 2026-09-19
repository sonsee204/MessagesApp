/**
 * Cấu hình WebRTC ICE Servers phục vụ cơ chế NAT Traversal
 * Mặc định sử dụng máy chủ STUN công khai của Google; bổ sung máy chủ TURN khi có biến môi trường để hỗ trợ mạng đối xứng / firewall
 */
export const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
  // Bổ sung cấu hình TURN nếu được khai báo trong biến môi trường (vượt NAT đối xứng và firewall công ty)
  ...(import.meta.env.VITE_TURN_URL
    ? [
        {
          urls: import.meta.env.VITE_TURN_URL,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        },
      ]
    : []),
];

/**
 * Cấu hình tiêu chuẩn cho đối tượng RTCPeerConnection
 */
export const RTC_PEER_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
};
