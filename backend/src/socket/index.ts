import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken, TokenPayload } from "../utils/auth";
import { userRepository } from "../repositories/user.repository";
import { conversationRepository } from "../repositories/conversation.repository";
import { messageService } from "../services/message.service";
import { logger } from "../core/logger";
import { env } from "../config/env";
import { registerCallHandlers, cleanupOrphanCalls } from "./call.handlers";

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
 * Phát sự kiện Socket.IO an toàn tới phòng cá nhân của một người dùng
 * @param userId ID người dùng nhận sự kiện
 * @param event Tên sự kiện (ví dụ: 'notification:new', 'notification:read')
 * @param payload Dữ liệu đính kèm sự kiện
 */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  try {
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit(event, payload);
    }
  } catch (error) {
    logger.error(`Lỗi khi phát sự kiện socket ${event} tới user:${userId}`, error);
  }
}

/**
 * Chuẩn hóa mã cuộc hội thoại nhận từ sự kiện gõ phím (Typing Indicator).
 * Chấp nhận cả hai dạng payload để tương thích ngược với các phiên bản client:
 * - Dạng chuỗi thô: "652f1a2b..."
 * - Dạng đối tượng: { conversationId: "652f1a2b..." }
 * @returns Mã cuộc hội thoại đã chuẩn hóa, hoặc chuỗi rỗng nếu payload không hợp lệ
 */
export function resolveConversationId(payload: string | { conversationId?: string }): string {
  if (typeof payload === "string") return payload;
  return payload?.conversationId ?? "";
}

/**
 * Chuẩn hóa token nhận được trong bước bắt tay (Handshake) của Socket.IO về đúng chuỗi JWT thô.
 * Một số client (như Frontend appmessaging) gửi kèm tiền tố "Bearer " giống HTTP header,
 * nếu đưa nguyên chuỗi này vào jwt.verify sẽ báo lỗi "jwt malformed" và chặn toàn bộ kết nối.
 * @param rawToken Giá trị token thô lấy từ socket.handshake.auth.token
 * @returns JWT thô đã bỏ tiền tố, hoặc undefined nếu không có token
 */
export function normalizeHandshakeToken(rawToken: unknown): string | undefined {
  if (typeof rawToken !== "string" || rawToken.length === 0) return undefined;
  return rawToken.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;
}

/**
 * Kiểm tra một người dùng có nằm trong danh sách thành viên của cuộc trò chuyện hay không.
 * Danh sách `participants` có thể chứa ObjectId thô hoặc document User đã populate,
 * nên phải chuẩn hóa về chuỗi ID trước khi so sánh.
 * @param participants Mảng thành viên lấy từ document Conversation
 * @param userId ID người dùng cần kiểm tra
 * @returns true nếu người dùng là thành viên hợp lệ
 */
export function isParticipant(participants: unknown[], userId: string): boolean {
  if (!Array.isArray(participants)) return false;

  return participants.some((participant) => {
    if (!participant) return false;
    const participantId =
      (participant as { _id?: unknown })._id?.toString() ||
      (participant as { id?: unknown }).id?.toString() ||
      participant.toString();
    return participantId === userId;
  });
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

  // Dọn dẹp các cuộc gọi mồ côi từ lần khởi động trước (orphan calls)
  cleanupOrphanCalls().catch((err) => logger.error("Lỗi dọn dẹp orphan calls", err));

  // Middleware xác thực JWT trong quá trình bắt tay kết nối (Handshake Authentication)
  io.use((socket: AuthenticatedSocket, next) => {
    // Trích xuất cookie nếu có trong handshake headers
    const cookieHeader = socket.handshake.headers?.cookie;
    const cookieToken = cookieHeader
      ?.split("; ")
      .find((row) => row.startsWith("token="))
      ?.split("=")[1];

    // Trích xuất token từ handshake auth, header hoặc cookie (đã chuẩn hóa bỏ tiền tố "Bearer ")
    const token =
      normalizeHandshakeToken(socket.handshake.auth?.token) ||
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

    /**
     * Xác thực quyền truy cập phòng của một cuộc trò chuyện.
     * Phòng Socket.IO là kênh nhận mọi tin nhắn của cuộc hội thoại, nên nếu cho join vô điều kiện
     * thì bất kỳ người dùng đã đăng nhập nào cũng đọc được tin nhắn riêng của người khác.
     * @param conversationId ID cuộc trò chuyện cần kiểm tra
     * @returns true nếu người dùng hiện tại là thành viên hợp lệ
     */
    const canAccessConversation = async (conversationId: string): Promise<boolean> => {
      const conversation = await conversationRepository.findById(conversationId);
      if (!conversation) return false;
      return isParticipant(conversation.participants, user.userId);
    };

    // Bước 1: Cập nhật trạng thái trực tuyến (Online) của người dùng vào CSDL
    await userRepository.updateOnlineStatus(user.userId, true);
    // Phát thông báo trạng thái Online tới tất cả người dùng khác
    socket.broadcast.emit("user_status_changed", {
      userId: user.userId,
      isOnline: true,
    });

    // Bước 2: Tự động gia nhập phòng cá nhân để nhận các thông báo trực tiếp
    socket.join(`user:${user.userId}`);

    // Bước 2b: Đăng ký các sự kiện WebRTC signaling cho cuộc gọi (call:*)
    registerCallHandlers(socket);

    // Bước 3: Xử lý sự kiện tham gia phòng cuộc trò chuyện cụ thể
    socket.on("join_conversation", async (payload: string | { conversationId?: string }) => {
      const conversationId = resolveConversationId(payload);
      if (!conversationId) return;

      // Zero-Trust: chỉ thành viên của cuộc trò chuyện mới được vào phòng
      if (!(await canAccessConversation(conversationId))) {
        logger.warn(
          `Từ chối join_conversation: ${user.username} không thuộc conversation:${conversationId}`
        );
        socket.emit("error", { code: "FORBIDDEN", message: "Bạn không thuộc cuộc trò chuyện này" });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      logger.info(`User ${user.username} joined conversation:${conversationId}`);
    });

    // Bước 4: Xử lý sự kiện rời phòng cuộc trò chuyện
    socket.on("leave_conversation", (payload: string | { conversationId?: string }) => {
      const conversationId = resolveConversationId(payload);
      if (!conversationId) return;
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
          // Lưu tin nhắn vào CSDL qua Service Layer.
          // KHÔNG phát lại 'new_message' ở đây: messageService.sendMessage đã phát sự kiện này
          // tới room conversation:${conversationId} (Bước 6). Phát thêm lần nữa khiến mọi client
          // nhận 2 bản cho cùng một tin nhắn.
          const message = await messageService.sendMessage({
            conversationId: data.conversationId,
            senderId: user.userId,
            content: data.content,
            type: data.type,
          });

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
    socket.on("typing_start", async (payload: string | { conversationId?: string }) => {
      const conversationId = resolveConversationId(payload);
      if (!conversationId) return;
      // Chỉ phát tín hiệu gõ phím nếu người dùng thực sự thuộc cuộc trò chuyện
      if (!(await canAccessConversation(conversationId))) return;
      socket.to(`conversation:${conversationId}`).emit("user_typing", {
        conversationId,
        userId: user.userId,
        username: user.username,
        isTyping: true,
      });
    });

    // Bước 7: Xử lý sự kiện dừng gõ phím (Typing Indicator Stop)
    socket.on("typing_stop", async (payload: string | { conversationId?: string }) => {
      const conversationId = resolveConversationId(payload);
      if (!conversationId) return;
      // Chỉ phát tín hiệu dừng gõ phím nếu người dùng thực sự thuộc cuộc trò chuyện
      if (!(await canAccessConversation(conversationId))) return;
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
