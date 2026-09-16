import {
  ICallRepository,
  callRepository,
  IPaginationOptions,
} from "../repositories/call.repository";
import {
  IFriendRepository,
  friendRepository,
} from "../repositories/friend.repository";
import {
  IBlockRepository,
  blockRepository,
} from "../repositories/block.repository";
import {
  IConversationRepository,
  conversationRepository,
} from "../repositories/conversation.repository";
import {
  ActiveCallRegistry,
  activeCallRegistry,
} from "../socket/active-call.registry";
import { ICall, CallType } from "../models/call.model";
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../core/errors";

/**
 * Service xử lý toàn bộ logic nghiệp vụ về Cuộc gọi (Video & Voice Call)
 * Quản lý vòng đời cuộc gọi: khởi tạo, chấp nhận, từ chối, hủy bỏ, kết thúc và truy vấn lịch sử.
 */
export class CallService {
  constructor(
    private callRepo: ICallRepository = callRepository,
    private friendRepo: IFriendRepository = friendRepository,
    private blockRepo: IBlockRepository = blockRepository,
    private convRepo: IConversationRepository = conversationRepository,
    private callRegistry: ActiveCallRegistry = activeCallRegistry
  ) {}

  /**
   * Khởi tạo một cuộc gọi mới giữa 2 người dùng (1-1)
   *
   * Quy trình kiểm tra:
   * 1. Không cho phép tự gọi chính mình
   * 2. Kiểm tra quan hệ chặn (2 chiều)
   * 3. Kiểm tra quan hệ bạn bè (chỉ bạn bè mới được gọi)
   * 4. Kiểm tra trạng thái bận (in-memory ActiveCallRegistry)
   * 5. Xác định hoặc tạo cuộc trò chuyện DIRECT giữa 2 người
   * 6. Tạo bản ghi cuộc gọi mới với trạng thái mặc định "ringing"
   * 7. Đánh dấu cả người gọi và người nhận vào danh sách bận
   *
   * @param callerId ID người thực hiện cuộc gọi
   * @param calleeId ID người nhận cuộc gọi
   * @param type Loại cuộc gọi: "audio" hoặc "video"
   * @returns Bản ghi cuộc gọi vừa khởi tạo
   */
  async initiateCall(
    callerId: string,
    calleeId: string,
    type: CallType
  ): Promise<ICall> {
    // Bước 1: Ngăn chặn tự gọi cho chính mình
    if (callerId === calleeId) {
      throw new ForbiddenError("Không thể gọi chính mình");
    }

    // Bước 2: Kiểm tra quan hệ chặn 2 chiều (blocker hoặc blocked)
    const isBlocked = await this.blockRepo.isBlocked(callerId, calleeId);
    if (isBlocked) {
      throw new ForbiddenError("Bạn bị chặn hoặc đã chặn người này");
    }

    // Bước 3: Kiểm tra quan hệ bạn bè (chỉ bạn bè mới được thực hiện cuộc gọi)
    const isFriend = await this.friendRepo.isFriend(callerId, calleeId);
    if (!isFriend) {
      throw new ForbiddenError("Chỉ bạn bè mới được gọi nhau");
    }

    // Bước 4: Kiểm tra trạng thái bận của cả 2 người dùng qua in-memory registry
    if (
      this.callRegistry.isBusy(callerId) ||
      this.callRegistry.isBusy(calleeId)
    ) {
      throw new ConflictError("Một trong hai người đang bận một cuộc gọi khác");
    }

    // Bước 5: Tìm kiếm cuộc hội thoại DIRECT sẵn có hoặc tạo mới nếu chưa tồn tại
    let conversation = await this.convRepo.findDirectBetween(callerId, calleeId);
    if (!conversation) {
      conversation = await this.convRepo.create({
        type: "DIRECT",
        participants: [callerId, calleeId],
        createdBy: callerId,
      });
    }

    // Bước 6: Lưu bản ghi cuộc gọi mới vào cơ sở dữ liệu với trạng thái 'ringing'
    const conversationId = String(conversation._id);
    const call = await this.callRepo.create({
      conversationId,
      callerId,
      calleeId,
      type,
    });

    // Bước 7: Đánh dấu cả người gọi và người nhận vào registry bận
    const callId = String(call._id);
    this.callRegistry.setBusy(callerId, callId);
    this.callRegistry.setBusy(calleeId, callId);

    return call;
  }

  /**
   * Người nhận nhấc máy chấp nhận cuộc gọi
   *
   * Quy trình kiểm tra:
   * 1. Tìm bản ghi cuộc gọi theo ID
   * 2. Xác thực người thực hiện thao tác phải là người nhận (calleeId)
   * 3. Cuộc gọi phải đang ở trạng thái 'ringing'
   * 4. Cập nhật trạng thái sang 'answered' và ghi nhận thời điểm answeredAt
   *
   * @param callId ID cuộc gọi
   * @param userId ID người nhận chấp nhận cuộc gọi
   * @returns Bản ghi cuộc gọi sau khi cập nhật
   */
  async acceptCall(callId: string, userId: string): Promise<ICall> {
    // Bước 1: Tìm thông tin cuộc gọi trong CSDL
    const call = await this.callRepo.findById(callId);
    if (!call) {
      throw new NotFoundError("Không tìm thấy cuộc gọi");
    }

    // Bước 2: Xác thực quyền hạn - chỉ người nhận (callee) mới được nghe máy
    if (String(call.calleeId) !== String(userId)) {
      throw new ForbiddenError("Bạn không phải người nhận cuộc gọi");
    }

    // Bước 3: Kiểm tra trạng thái hợp lệ - chỉ chấp nhận khi đang đổ chuông
    if (call.status !== "ringing") {
      throw new ConflictError("Cuộc gọi không ở trạng thái chờ nghe máy");
    }

    // Bước 4: Cập nhật trạng thái answered trong CSDL (giữ nguyên trạng thái bận trong registry)
    const updatedCall = await this.callRepo.updateStatus(callId, "answered", {
      answeredAt: new Date(),
    });

    if (!updatedCall) {
      throw new NotFoundError("Không thể cập nhật trạng thái cuộc gọi");
    }

    return updatedCall;
  }

  /**
   * Người nhận chủ động từ chối cuộc gọi
   *
   * Quy trình kiểm tra:
   * 1. Tìm bản ghi cuộc gọi theo ID
   * 2. Xác thực người thực hiện thao tác phải là người nhận (calleeId)
   * 3. Cuộc gọi phải đang ở trạng thái 'ringing'
   * 4. Cập nhật trạng thái sang 'declined' và ghi nhận thời điểm endedAt
   * 5. Giải phóng trạng thái bận cho cả 2 người dùng trong registry
   *
   * @param callId ID cuộc gọi
   * @param userId ID người nhận từ chối cuộc gọi
   * @returns Bản ghi cuộc gọi sau khi cập nhật
   */
  async declineCall(callId: string, userId: string): Promise<ICall> {
    // Bước 1: Tìm thông tin cuộc gọi trong CSDL
    const call = await this.callRepo.findById(callId);
    if (!call) {
      throw new NotFoundError("Không tìm thấy cuộc gọi");
    }

    // Bước 2: Xác thực quyền hạn - chỉ người nhận mới được từ chối
    if (String(call.calleeId) !== String(userId)) {
      throw new ForbiddenError("Bạn không phải người nhận cuộc gọi");
    }

    // Bước 3: Kiểm tra trạng thái hợp lệ - chỉ từ chối khi đang đổ chuông
    if (call.status !== "ringing") {
      throw new ConflictError("Cuộc gọi không ở trạng thái chờ nghe máy");
    }

    // Bước 4: Cập nhật trạng thái sang declined và giải phóng cả 2 người khỏi registry bận
    const updatedCall = await this.callRepo.updateStatus(callId, "declined", {
      endedAt: new Date(),
    });
    this.callRegistry.clearCall(callId);

    if (!updatedCall) {
      throw new NotFoundError("Không thể cập nhật trạng thái cuộc gọi");
    }

    return updatedCall;
  }

  /**
   * Người gọi chủ động hủy cuộc gọi trước khi đối phương nhấc máy (hoặc timeout)
   *
   * Quy trình kiểm tra:
   * 1. Tìm bản ghi cuộc gọi theo ID
   * 2. Xác thực người thực hiện thao tác phải là người gọi (callerId)
   * 3. Cuộc gọi phải đang ở trạng thái 'ringing'
   * 4. Cập nhật trạng thái sang 'missed' và ghi nhận thời điểm endedAt
   * 5. Giải phóng trạng thái bận cho cả 2 người dùng trong registry
   *
   * @param callId ID cuộc gọi
   * @param userId ID người gọi thực hiện hủy cuộc gọi
   * @returns Bản ghi cuộc gọi sau khi cập nhật
   */
  async cancelCall(callId: string, userId: string): Promise<ICall> {
    // Bước 1: Tìm thông tin cuộc gọi trong CSDL
    const call = await this.callRepo.findById(callId);
    if (!call) {
      throw new NotFoundError("Không tìm thấy cuộc gọi");
    }

    // Bước 2: Xác thực quyền hạn - chỉ người gọi mới có quyền hủy cuộc gọi
    if (String(call.callerId) !== String(userId)) {
      throw new ForbiddenError("Bạn không phải người khởi tạo cuộc gọi");
    }

    // Bước 3: Kiểm tra trạng thái hợp lệ - chỉ hủy khi đang đổ chuông
    if (call.status !== "ringing") {
      throw new ConflictError(
        "Không thể hủy cuộc gọi đã được kết nối hoặc đã kết thúc"
      );
    }

    // Bước 4: Cập nhật trạng thái sang missed và dọn dẹp registry
    const updatedCall = await this.callRepo.updateStatus(callId, "missed", {
      endedAt: new Date(),
    });
    this.callRegistry.clearCall(callId);

    if (!updatedCall) {
      throw new NotFoundError("Không thể cập nhật trạng thái cuộc gọi");
    }

    return updatedCall;
  }

  /**
   * Kết thúc cuộc gọi đang diễn ra (bất kỳ người tham gia nào cũng có thể bấm kết thúc)
   *
   * Quy trình kiểm tra:
   * 1. Tìm bản ghi cuộc gọi theo ID
   * 2. Xác thực người thực hiện thao tác phải là callerId hoặc calleeId
   * 3. Cuộc gọi không được ở trạng thái đã kết thúc trước đó
   * 4. Tính toán thời lượng cuộc gọi tính bằng giây nếu đã kết nối (answeredAt)
   * 5. Cập nhật trạng thái sang 'ended' kèm endedAt và durationSec
   * 6. Giải phóng trạng thái bận cho cả 2 người dùng trong registry
   *
   * @param callId ID cuộc gọi
   * @param userId ID người thực hiện kết thúc cuộc gọi (caller hoặc callee)
   * @returns Bản ghi cuộc gọi sau khi kết thúc
   */
  async endCall(callId: string, userId: string): Promise<ICall> {
    // Bước 1: Tìm thông tin cuộc gọi trong CSDL
    const call = await this.callRepo.findById(callId);
    if (!call) {
      throw new NotFoundError("Không tìm thấy cuộc gọi");
    }

    // Bước 2: Xác thực người kết thúc phải là một trong hai thành viên tham gia
    const callerIdStr = String(call.callerId);
    const calleeIdStr = String(call.calleeId);
    if (callerIdStr !== String(userId) && calleeIdStr !== String(userId)) {
      throw new ForbiddenError("Bạn không phải thành viên của cuộc gọi này");
    }

    // Bước 3: Kiểm tra cuộc gọi chưa bị đóng trước đó
    if (
      call.status === "ended" ||
      call.status === "declined" ||
      call.status === "missed"
    ) {
      throw new ConflictError("Cuộc gọi đã kết thúc trước đó");
    }

    // Bước 4: Tính toán thời lượng cuộc gọi (durationSec) nếu người nhận đã nhấc máy
    const endedAt = new Date();
    let durationSec: number | undefined = undefined;
    if (call.answeredAt) {
      const startTime = new Date(call.answeredAt).getTime();
      durationSec = Math.max(0, Math.floor((endedAt.getTime() - startTime) / 1000));
    }

    // Bước 5: Cập nhật trạng thái cuộc gọi sang 'ended' trong cơ sở dữ liệu
    const updatedCall = await this.callRepo.updateStatus(callId, "ended", {
      endedAt,
      durationSec,
    });

    // Bước 6: Giải phóng trạng thái bận cho cả 2 phía người dùng
    this.callRegistry.clearCall(callId);

    if (!updatedCall) {
      throw new NotFoundError("Không thể cập nhật trạng thái cuộc gọi");
    }

    return updatedCall;
  }

  /**
   * Lấy danh sách lịch sử cuộc gọi của người dùng (kèm phân trang bắt buộc)
   *
   * @param userId ID người dùng cần lấy lịch sử cuộc gọi
   * @param options Tùy chọn phân trang (page, limit)
   * @returns Danh sách các cuộc gọi sắp xếp giảm dần theo thời gian
   */
  async getCallHistory(
    userId: string,
    options?: IPaginationOptions
  ): Promise<ICall[]> {
    return this.callRepo.findRecentByUser(userId, options);
  }

  /**
   * Đếm tổng số cuộc gọi nhỡ của người dùng
   *
   * @param userId ID người dùng
   * @returns Số lượng cuộc gọi nhỡ
   */
  async countMissed(userId: string): Promise<number> {
    return this.callRepo.countMissed(userId);
  }
}

/**
 * Thể hiện duy nhất (Singleton) của CallService
 */
export const callService = new CallService();
