import type { AuthenticatedSocket } from "./index";
import { emitToUser, getIO } from "./index";
import { callService } from "../services/call.service";
import { callRepository } from "../repositories/call.repository";
import { activeCallRegistry } from "./active-call.registry";
import { CallModel, CallType, ICall } from "../models/call.model";
import { pushService } from "../services/push.service";
import { notificationService } from "../services/notification.service";
import { AppError, ConflictError } from "../core/errors";
import { logger } from "../core/logger";

/**
 * Payload của sự kiện khởi tạo cuộc gọi (call:initiate)
 */
interface IInitiatePayload {
  calleeId?: string;
  type?: CallType;
}

/** Payload chung của các sự kiện chỉ cần mã cuộc gọi */
interface ICallIdPayload {
  callId?: string;
}

/** Payload truyền tiếp SDP (call:offer / call:answer) */
interface ISdpPayload {
  callId?: string;
  sdp?: unknown;
}

/** Payload truyền tiếp ICE candidate (call:ice) */
interface IIcePayload {
  callId?: string;
  candidate?: unknown;
}

/**
 * Các phụ thuộc có thể tiêm (inject) khi đăng ký handler, phục vụ kiểm thử.
 * Mặc định luôn trỏ về các thể hiện thật (singleton) của hệ thống.
 */
export interface CallHandlerDeps {
  callSvc?: typeof callService;
  callRepo?: typeof callRepository;
  registry?: typeof activeCallRegistry;
  emitToUserFn?: typeof emitToUser;
  isUserOnlineFn?: (userId: string) => boolean;
  pushSvc?: typeof pushService;
  notifSvc?: typeof notificationService;
}

/**
 * Kiểm tra người dùng có ít nhất một kết nối Socket.IO đang hoạt động hay không.
 * Phòng cá nhân `user:<id>` được dùng làm nguồn sự thật: phòng rỗng nghĩa là ngoại tuyến.
 * @param userId ID người dùng cần kiểm tra
 * @returns true nếu người dùng đang có kết nối
 */
function isUserOnline(userId: string): boolean {
  const io = getIO();
  if (!io) return false;
  return (io.sockets.adapter.rooms.get(`user:${userId}`)?.size ?? 0) > 0;
}

/**
 * Chuẩn hóa mã cuộc gọi nhận từ client (chống payload rỗng hoặc sai kiểu dữ liệu)
 * @param data Payload thô từ sự kiện Socket
 * @returns Mã cuộc gọi hợp lệ, hoặc chuỗi rỗng nếu không hợp lệ
 */
function normalizeCallId(data?: ICallIdPayload): string {
  return typeof data?.callId === "string" ? data.callId.trim() : "";
}

/**
 * Đăng ký toàn bộ 8 sự kiện WebRTC signaling cho cuộc gọi (call:*) trên một kết nối Socket.
 * Handler chỉ đóng vai trò điều phối: gọi Service Layer xử lý nghiệp vụ và phát sự kiện
 * tới phòng cá nhân của phía đối diện; SDP/ICE được truyền tiếp (relay) và KHÔNG lưu CSDL.
 *
 * @param socket Socket đã xác thực (middleware JWT đã gán socket.user)
 * @param deps Phụ thuộc tùy chọn dùng cho kiểm thử (mặc định dùng singleton thật)
 */
export function registerCallHandlers(
  socket: AuthenticatedSocket,
  deps: CallHandlerDeps = {}
): void {
  const callSvc = deps.callSvc ?? callService;
  const callRepo = deps.callRepo ?? callRepository;
  const registry = deps.registry ?? activeCallRegistry;
  const emitToUserFn = deps.emitToUserFn ?? emitToUser;
  const isUserOnlineFn = deps.isUserOnlineFn ?? isUserOnline;
  const pushSvc = deps.pushSvc ?? pushService;
  const notifSvc = deps.notifSvc ?? notificationService;

  const userId = socket.user!.userId;
  const username = socket.user!.username;

  /**
   * Phát sự kiện lỗi về cho chính client đang thao tác
   */
  const emitCallError = (code: string, message: string): void => {
    emitToUserFn(userId, "call:error", { code, message });
  };

  /**
   * Lấy ID phía đối diện trong một cuộc gọi (dùng cho các sự kiện không cần nghiệp vụ)
   * @param call Bản ghi cuộc gọi
   * @returns ID người còn lại trong cuộc gọi
   */
  const getOtherUserId = (call: ICall): string => {
    const callerIdStr = String(call.callerId);
    return userId === callerIdStr ? String(call.calleeId) : callerIdStr;
  };

  /**
   * Chuyển ngoại lệ từ Service Layer thành sự kiện Socket tương ứng:
   * - ConflictError (đang bận / sai trạng thái cuộc gọi) -> "call:busy"
   * - Các lỗi còn lại (ForbiddenError, NotFoundError, ...) -> "call:error" kèm mã lỗi
   *
   * @param error Ngoại lệ bắt được
   * @param busyPayload Dữ liệu gửi kèm khi rơi vào nhánh bận
   */
  const emitCallFailure = (
    error: unknown,
    busyPayload: Record<string, unknown> = {}
  ): void => {
    if (error instanceof ConflictError) {
      emitToUserFn(userId, "call:busy", busyPayload);
      return;
    }
    emitCallError(
      error instanceof AppError ? error.code : "INTERNAL_SERVER_ERROR",
      error instanceof Error ? error.message : "Lỗi không xác định"
    );
  };

  /**
   * Truyền tiếp (relay) một gói tin signaling sang phía đối diện của cuộc gọi.
   * Dùng Repository trực tiếp vì thao tác này chỉ cần xác thực quyền tham gia cuộc gọi,
   * không chứa nghiệp vụ; nhờ đó chặn được người lạ bơm SDP/ICE vào phiên của người khác.
   *
   * @param event Tên sự kiện relay ("call:offer" | "call:answer" | "call:ice")
   * @param callId Mã cuộc gọi
   * @param payload Dữ liệu signaling cần chuyển tiếp
   */
  const relaySignaling = async (
    event: "call:offer" | "call:answer" | "call:ice",
    callId: string,
    payload: Record<string, unknown>
  ): Promise<void> => {
    const call = await callRepo.findById(callId);
    if (!call) {
      emitCallError("NOT_FOUND", "Không tìm thấy cuộc gọi");
      return;
    }

    const callerIdStr = String(call.callerId);
    const calleeIdStr = String(call.calleeId);
    if (userId !== callerIdStr && userId !== calleeIdStr) {
      logger.warn(`Từ chối ${event}: ${username} không thuộc cuộc gọi ${callId}`);
      emitCallError("FORBIDDEN", "Bạn không thuộc cuộc gọi này");
      return;
    }

    // Xác định phía đối diện: người gọi gửi offer thì chuyển tới người nhận và ngược lại
    const otherUserId = userId === callerIdStr ? calleeIdStr : callerIdStr;
    emitToUserFn(otherUserId, event, { callId, ...payload, from: userId });
  };

  // ============ 1. Khởi tạo cuộc gọi (Người gọi bấm gọi) ============
  socket.on("call:initiate", async (data: IInitiatePayload) => {
    const calleeId = typeof data?.calleeId === "string" ? data.calleeId : "";
    const type = data?.type;

    // Zero-Trust: chặn dữ liệu đầu vào sai định dạng trước khi chạm tới Service Layer
    if (!calleeId || (type !== "audio" && type !== "video")) {
      emitCallError("VALIDATION_ERROR", "Dữ liệu khởi tạo cuộc gọi không hợp lệ");
      return;
    }

    try {
      const call = await callSvc.initiateCall(userId, calleeId, type);
      const callId = String(call._id);

      // Phát chuông tới phòng cá nhân của người nhận
      emitToUserFn(calleeId, "call:incoming", {
        callId,
        callerId: userId,
        callerName: username,
        type,
      });

      // Trả callId về cho chính người gọi để máy trạng thái phía caller nắm được mã cuộc gọi.
      // Nếu không, khi caller bấm hủy (call:cancel) sẽ gửi callId rỗng -> server không thể
      // forward "call:canceled" sang callee -> modal cuộc gọi đến của callee reo mãi không tắt.
      emitToUserFn(userId, "call:initiated", { callId });

      // Người nhận ngoại tuyến: báo cho người gọi để hiển thị "Đối phương offline" + FCM push.
      // KHÔNG ghi nhận missed ngay: FE hết 30s sẽ tự phát call:cancel và cancelCall mới ghi missed.
      if (!isUserOnlineFn(calleeId)) {
        emitToUserFn(userId, "call:offline", { callId, calleeId });

        // Callee offline: tạo notification CALL_MISSED + gửi FCM push (best-effort)
        try {
          await notifSvc.createNotification({
            recipientId: calleeId,
            senderId: userId,
            type: "CALL_MISSED",
            title: "Cuộc gọi nhỡ",
            content: `${username} đã gọi ${type === "video" ? "video" : "thoại"} cho bạn`,
            data: { conversationId: String(call.conversationId), url: `/chat/${call.conversationId}` },
          });
          await pushSvc.sendToDeviceTokens(calleeId, {
            title: "Cuộc gọi nhỡ",
            body: `${username} gọi ${type === "video" ? "video" : "thoại"} cho bạn`,
            data: { type: "CALL_MISSED", callId, callerId: userId, conversationId: String(call.conversationId) },
          });
        } catch (err) {
          logger.error(`Lỗi gửi thông báo cuộc gọi nhỡ cho ${calleeId}`, err);
        }
      }
    } catch (error) {
      // Hai cuộc gọi chéo chiều gần đồng thời: request đến sau nhận ConflictError từ registry bận
      emitCallFailure(error, { calleeId });
      logger.warn(`Khởi tạo cuộc gọi thất bại (${username} -> ${calleeId})`);
    }
  });

  // ============ 2. Người nhận chấp nhận cuộc gọi ============
  socket.on("call:accept", async (data: ICallIdPayload) => {
    const callId = normalizeCallId(data);
    if (!callId) {
      emitCallError("VALIDATION_ERROR", "Thiếu mã cuộc gọi");
      return;
    }

    try {
      const call = await callSvc.acceptCall(callId, userId);
      emitToUserFn(String(call.callerId), "call:accepted", { callId });
    } catch (error) {
      emitCallFailure(error);
    }
  });

  // ============ 3. Người nhận từ chối cuộc gọi ============
  socket.on("call:decline", async (data: ICallIdPayload) => {
    const callId = normalizeCallId(data);
    if (!callId) {
      emitCallError("VALIDATION_ERROR", "Thiếu mã cuộc gọi");
      return;
    }

    try {
      const call = await callSvc.declineCall(callId, userId);
      emitToUserFn(String(call.callerId), "call:declined", { callId });
    } catch (error) {
      emitCallFailure(error);
    }
  });

  // ============ 4. Người gọi hủy cuộc gọi trước khi đối phương nhấc máy ============
  socket.on("call:cancel", async (data: ICallIdPayload) => {
    const callId = normalizeCallId(data);
    if (!callId) {
      emitCallError("VALIDATION_ERROR", "Thiếu mã cuộc gọi");
      return;
    }

    try {
      const call = await callSvc.cancelCall(callId, userId);
      emitToUserFn(String(call.calleeId), "call:canceled", { callId });
    } catch (error) {
      emitCallFailure(error);
    }
  });

  // ============ 5. Người gọi gửi SDP Offer (relay thuần, không lưu CSDL) ============
  socket.on("call:offer", async (data: ISdpPayload) => {
    const callId = normalizeCallId(data);
    if (!callId) {
      emitCallError("VALIDATION_ERROR", "Thiếu mã cuộc gọi");
      return;
    }

    try {
      await relaySignaling("call:offer", callId, { sdp: data?.sdp ?? null });
    } catch (error) {
      emitCallFailure(error);
    }
  });

  // ============ 6. Người nhận gửi SDP Answer (relay thuần, không lưu CSDL) ============
  socket.on("call:answer", async (data: ISdpPayload) => {
    const callId = normalizeCallId(data);
    if (!callId) {
      emitCallError("VALIDATION_ERROR", "Thiếu mã cuộc gọi");
      return;
    }

    try {
      await relaySignaling("call:answer", callId, { sdp: data?.sdp ?? null });
    } catch (error) {
      emitCallFailure(error);
    }
  });

  // ============ 7. Trao đổi ICE Candidate hai chiều ============
  socket.on("call:ice", async (data: IIcePayload) => {
    const callId = normalizeCallId(data);
    if (!callId) {
      emitCallError("VALIDATION_ERROR", "Thiếu mã cuộc gọi");
      return;
    }

    try {
      await relaySignaling("call:ice", callId, { candidate: data?.candidate ?? null });
    } catch (error) {
      emitCallFailure(error);
    }
  });

  // ============ 8. Kết thúc cuộc gọi (một trong hai phía bấm kết thúc) ============
  socket.on("call:end", async (data: ICallIdPayload) => {
    const callId = normalizeCallId(data);
    if (!callId) {
      emitCallError("VALIDATION_ERROR", "Thiếu mã cuộc gọi");
      return;
    }

    try {
      const call = await callSvc.endCall(callId, userId);
      // Thông báo cho phía đối diện để đóng phiên WebRTC còn lại
      emitToUserFn(getOtherUserId(call), "call:ended", { callId });
    } catch (error) {
      emitCallFailure(error);
    }
  });

  // ============ 9. Ngắt kết nối đột ngột giữa cuộc gọi ============
  // Nếu Socket mất kết nối (đóng tab, rớt mạng) mà chưa kịp phát call:end, KHÔNG được gọi endCall:
  // người dùng có thể còn phiên ở thiết bị khác. Chỉ báo cho đối phương biết để đóng phiên WebRTC,
  // và chỉ giải phóng registry khi đây là kết nối cuối cùng (tránh xóa bận của phiên còn lại).
  socket.on("disconnect", async () => {
    const activeCallId = registry.getCallId(userId);
    if (!activeCallId || isUserOnlineFn(userId)) return;

    // Lấy thông tin cuộc gọi TRƯỚC khi clear registry (cần biết status để xử lý)
    const call = await callRepo.findById(activeCallId);

    // clearCall giải phóng CẢ HAI phía caller + callee khỏi registry busy;
    // clearUser chỉ xóa 1 người -> peer vẫn treo bận -> lần gọi sau dính ConflictError "đang bận"
    registry.clearCall(activeCallId);
    logger.warn(`Người dùng ${username} mất kết nối giữa cuộc gọi ${activeCallId}`);

    if (!call) return;

    // Nếu cuộc gọi vẫn đang "ringing" (caller disconnect chưa kịp cancel → callee modal treo):
    // cập nhật DB sang "missed" + emit call:canceled để FE callee đóng modal ngay.
    if (call.status === "ringing") {
      try {
        await callSvc.cancelCall(activeCallId, userId);
        emitToUserFn(getOtherUserId(call), "call:canceled", { callId: activeCallId });
      } catch (err) {
        logger.warn(`Không thể cancel call ${activeCallId} khi disconnect:`, err);
      }
    } else {
      // Cuộc gọi đã answered/active: cập nhật trạng thái 'ended' và lưu thời lượng vào CSDL,
      // sau đó gửi tín hiệu call:peer_disconnected để đối phương dọn dẹp phiên WebRTC
      try {
        await callSvc.endCall(activeCallId, userId);
      } catch (err) {
        logger.warn(`Không thể end call ${activeCallId} khi disconnect:`, err);
      }
      emitToUserFn(getOtherUserId(call), "call:peer_disconnected", { callId: activeCallId });
    }
  });
}

/**
 * Dọn dẹp các cuộc gọi mồ côi (orphan calls) khi khởi động lại máy chủ.
 *
 * Khi tiến trình server restart, toàn bộ kết nối Socket.IO bị mất nhưng các bản ghi cuộc gọi
 * còn treo ở trạng thái "ringing" vẫn nằm lại trong CSDL (không còn ai phát call:cancel/call:end).
 * Đây là thao tác boot-time nằm ngoài luồng nghiệp vụ thông thường nên được phép truy vấn
 * trực tiếp Model thay vì đi qua Repository.
 *
 * @throws Ném lại lỗi CSDL để tầng gọi (initSocketServer) ghi log tập trung
 */
export async function cleanupOrphanCalls(): Promise<void> {
  // Registry là bộ nhớ trong: sau restart mọi kết nối đã mất, xóa sạch để tránh trạng thái "bận" ma
  activeCallRegistry.clearAll();

  // Chuyển toàn bộ cuộc gọi còn đổ chuông sang trạng thái nhỡ
  const ringingResult = await CallModel.updateMany(
    { status: "ringing" },
    { $set: { status: "missed", endedAt: new Date() } }
  ).exec();

  // Kết thúc các cuộc gọi đã được nhận máy nhưng treo sau restart (registry đã clearAll).
  // Nếu không xử lý, chúng sẽ tồn tại vĩnh viễn ở trạng thái "answered" trong CSDL
  // và ghost entry self-heal runtime sẽ block gọi lại (ConflictError).
  const answeredResult = await CallModel.updateMany(
    { status: "answered" },
    { $set: { status: "ended", endedAt: new Date() } }
  ).exec();

  const totalCleaned = ringingResult.modifiedCount + answeredResult.modifiedCount;
  logger.info(
    `Dọn dẹp cuộc gọi mồ côi: ${ringingResult.modifiedCount} "ringing" → "missed", ` +
    `${answeredResult.modifiedCount} "answered" → "ended" (tổng: ${totalCleaned})`
  );
}
