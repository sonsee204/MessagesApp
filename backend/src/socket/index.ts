import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken, TokenPayload } from "../utils/auth";
import { userRepository } from "../repositories/user.repository";
import { messageService } from "../services/message.service";
import { logger } from "../core/logger";
import { env } from "../config/env";

/**
 * Mở rộng giao diện Socket để lưu trữ dữ liệu xác thực người dùng
 */
export interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
}

/** Biến toàn cục lưu trữ thể hiện (instance) của Socket.IO Server */
let ioInstance: Server | null = null;

/**
 * Lấy thể hiện hiện tại của Socket.IO Server
 * @returns Thể hiện Server của Socket.IO hoặc null nếu chưa khởi tạo
 */
export function getIO(): Server | null {
  return ioInstance;
}

/**
 * Phát sự kiện Socket.IO an toàn tới toàn bộ thành viên đang ở trong phòng cuộc hội thoại
 * @param conversationId ID của cuộc hội thoại
 * @param event Tên sự kiện (ví dụ: 'new_message', 'message_recalled', 'messages_read')
 * @param payload Dữ liệu đính kèm sự kiện
 */
export function emitToConversation(conversationId: string, event: string, payload: unknown): void {
  try {
    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit(event, payload);
    }
  } catch (error) {
    logger.error(`Lỗi khi phát sự kiện socket ${event} tới conversation:${conversationId}`, error);
  }
}

/**
 * Khởi tạo Socket.IO Server và thiết lập các sự kiện Real-Time
 */
export function initSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  ioInstance = io;

  // Middleware xác thực JWT trong quá trình bắt tay kết nối (Handshake Authentication)
  io.use((socket: AuthenticatedSocket, next) => {
    // Trích xuất cookie nếu có trong handshake headers
    const cookieHeader = socket.handshake.headers?.cookie;
    const cookieToken = cookieHeader
      ?.split("; ")
      .find((row) => row.startsWith("token="))
      ?.split("=")[1];

    // Trích xuất token từ handshake auth, header hoặc cookie
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
      cookieToken;

    if (!token) {
      return next(new Error("Xác thực thất bại: Thiếu token"));
    }

    try {
      // Xác thực và giải mã token bằng jsonwebtoken
      const payload = verifyToken(token);
      socket.user = payload;
      next();
    } catch (_error) {
      next(new Error("Xác thực thất bại: Token không hợp lệ"));
    }
  });

  // Lắng nghe sự kiện khi có client kết nối thành công
  io.on("connection", async (socket: AuthenticatedSocket) => {
    const user = socket.user!;
    logger.info(`User connected: ${user.username} (${socket.id})`);

    // Bước 1: Cập nhật trạng thái trực tuyến (Online) của người dùng vào CSDL
    await userRepository.updateOnlineStatus(user.userId, true);
    // Phát thông báo trạng thái Online tới tất cả người dùng khác
    socket.broadcast.emit("user_status_changed", {
      userId: user.userId,
      isOnline: true,
    });

    // Bước 2: Tự động gia nhập phòng cá nhân để nhận các thông báo trực tiếp
    socket.join(`user:${user.userId}`);

    // Bước 3: Xử lý sự kiện tham gia phòng cuộc trò chuyện cụ thể
    socket.on("join_conversation", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logger.info(`User ${user.username} joined conversation:${conversationId}`);
    });

    // Bước 4: Xử lý sự kiện rời phòng cuộc trò chuyện
    socket.on("leave_conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.info(`User ${user.username} left conversation:${conversationId}`);
    });

    // Bước 5: Xử lý sự kiện gửi tin nhắn thời gian thực
    socket.on(
      "send_message",
      async (
        data: { conversationId: string; content: string; type?: "TEXT" | "IMAGE" | "FILE" },
        callback?: (response: unknown) => void
      ) => {
        try {
          // Lưu tin nhắn vào CSDL qua Service Layer
          const message = await messageService.sendMessage({
            conversationId: data.conversationId,
            senderId: user.userId,
            content: data.content,
            type: data.type,
          });

          // Phát sự kiện tin nhắn mới tới toàn bộ thành viên đang ở trong phòng cuộc hội thoại
          io.to(`conversation:${data.conversationId}`).emit("new_message", message);

          // Phản hồi xác nhận thành công tới client gửi tin nhắn (Ack callback)
          if (callback) {
            callback({ success: true, data: message });
          }
        } catch (error: unknown) {
          const err = error as Error;
          logger.error("Error sending message via socket", err);
          if (callback) {
            callback({ success: false, error: err.message });
          }
        }
      }
    );

    // Bước 6: Xử lý sự kiện bắt đầu gõ phím (Typing Indicator Start)
    socket.on("typing_start", (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit("user_typing", {
        conversationId,
        userId: user.userId,
        username: user.username,
        isTyping: true,
      });
    });

    // Bước 7: Xử lý sự kiện dừng gõ phím (Typing Indicator Stop)
    socket.on("typing_stop", (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit("user_typing", {
        conversationId,
        userId: user.userId,
        username: user.username,
        isTyping: false,
      });
    });

    // Bước 8: Xử lý khi client ngắt kết nối (Disconnect)
    socket.on("disconnect", async () => {
      logger.info(`User disconnected: ${user.username} (${socket.id})`);
      // Cập nhật trạng thái ngoại tuyến (Offline) vào CSDL
      await userRepository.updateOnlineStatus(user.userId, false);
      // Phát thông báo trạng thái Offline tới tất cả người dùng khác
      socket.broadcast.emit("user_status_changed", {
        userId: user.userId,
        isOnline: false,
      });
    });
  });

  return io;
}
