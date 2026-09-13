import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../stores/auth.store";

/**
 * Biến lưu trữ thực thể Socket.IO Client singleton
 */
let socket: Socket | null = null;

/**
 * Khởi tạo hoặc lấy kết nối Socket.IO hiện tại
 * Tự động gắn Access Token vào payload xác thực (Handshake Auth)
 * @returns Thực thể Socket.IO Client
 */
export function getSocket(): Socket {
  const token = useAuthStore.getState().accessToken;

  if (!socket) {
    socket = io("/", {
      autoConnect: false,
      withCredentials: true,
      auth: {
        token: token ? `Bearer ${token}` : undefined,
      },
      // Bắt đầu bằng polling để bắt tay HTTP ổn định qua proxy rồi nâng cấp lên websocket
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  } else if (token) {
    // Cập nhật lại token mới cho socket khi token được làm mới
    socket.auth = {
      token: `Bearer ${token}`,
    };
  }

  return socket;
}

/**
 * Thiết lập kết nối Socket.IO tới máy chủ
 */
export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

/**
 * Ngắt kết nối Socket.IO khi người dùng đăng xuất
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
