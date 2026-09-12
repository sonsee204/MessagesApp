import mongoose from "mongoose";
import {
  IFriendRequestRepository,
  friendRequestRepository,
  PaginationOptions,
} from "../repositories/friend-request.repository";
import {
  IFriendRepository,
  friendRepository,
  FriendQueryOptions,
} from "../repositories/friend.repository";
import {
  IBlockRepository,
  blockRepository,
} from "../repositories/block.repository";
import { IUserRepository, userRepository } from "../repositories/user.repository";
import { IFriendRequest } from "../models/friend-request.model";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../core/errors";

/**
 * Cấu trúc chuẩn cho phản hồi danh sách có phân trang
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Trạng thái quan hệ hai chiều giữa người dùng hiện tại và người dùng mục tiêu:
 * - NONE: Không có quan hệ gì
 * - PENDING_SENT: Đã gửi lời mời kết bạn và đang chờ đối phương phản hồi
 * - PENDING_RECEIVED: Đối phương đã gửi lời mời kết bạn cho mình
 * - FRIENDS: Đã là bạn bè
 * - BLOCKED: Đang có hành vi chặn giữa 2 người dùng (một trong hai người đã chặn người kia)
 */
export type RelationshipStatus =
  | "NONE"
  | "PENDING_SENT"
  | "PENDING_RECEIVED"
  | "FRIENDS"
  | "BLOCKED";

/**
 * Service xử lý toàn bộ logic nghiệp vụ về Bạn bè, Lời mời kết bạn và Chặn người dùng
 */
export class FriendService {
  constructor(
    private friendRequestRepo: IFriendRequestRepository = friendRequestRepository,
    private friendRepo: IFriendRepository = friendRepository,
    private blockRepo: IBlockRepository = blockRepository,
    private userRepo: IUserRepository = userRepository
  ) {}

  /**
   * Gửi lời mời kết bạn cho người dùng khác
   * @param senderId ID người gửi
   * @param receiverId ID người nhận
   * @param note Lời nhắn tùy chọn
   * @returns Bản ghi Lời mời kết bạn vừa tạo
   */
  async sendFriendRequest(
    senderId: string,
    receiverId: string,
    note?: string
  ): Promise<IFriendRequest> {
    // 1. Kiểm tra nghiệp vụ: Không thể tự gửi kết bạn cho chính mình
    if (senderId === receiverId) {
      throw new ValidationError("Không thể gửi lời mời kết bạn cho chính mình");
    }

    // 2. Kiểm tra người dùng nhận lời mời có tồn tại trong hệ thống không
    const receiver = await this.userRepo.findById(receiverId);
    if (!receiver) {
      throw new NotFoundError("Không tìm thấy người dùng nhận lời mời");
    }

    // 3. Kiểm tra quan hệ chặn: Nếu 1 trong 2 đã chặn nhau thì không cho gửi lời mời
    const isBlocked = await this.blockRepo.isBlocked(senderId, receiverId);
    if (isBlocked) {
      throw new ForbiddenError("Không thể gửi lời mời kết bạn cho người dùng này");
    }

    // 4. Kiểm tra xem cả hai đã là bạn bè của nhau chưa
    const isFriend = await this.friendRepo.isFriend(senderId, receiverId);
    if (isFriend) {
      throw new ConflictError("Hai người đã là bạn bè của nhau");
    }

    // 5. Kiểm tra lời mời gửi đi đang ở trạng thái chờ (PENDING)
    const sentPending = await this.friendRequestRepo.findPending(senderId, receiverId);
    if (sentPending) {
      throw new ConflictError("Bạn đã gửi lời mời kết bạn trước đó và đang chờ phản hồi");
    }

    // 6. Kiểm tra lời mời đối phương gửi cho mình (nếu có thì nhắc chấp nhận thay vì gửi mới)
    const receivedPending = await this.friendRequestRepo.findPending(receiverId, senderId);
    if (receivedPending) {
      throw new ConflictError(
        "Người dùng này đã gửi lời mời kết bạn cho bạn, vui lòng kiểm tra danh sách lời mời nhận được"
      );
    }

    // 7. Tạo mới lời mời kết bạn trong cơ sở dữ liệu
    return this.friendRequestRepo.create({
      senderId,
      receiverId,
      note,
    });
  }

  /**
   * Chấp nhận lời mời kết bạn (thực thi trong MongoDB Transaction)
   * @param userId ID của người nhận đang thao tác chấp nhận
   * @param requestId ID của lời mời kết bạn
   * @returns Thông tin tình bạn mới tạo kèm hồ sơ người gửi
   */
  async acceptFriendRequest(
    userId: string,
    requestId: string
  ): Promise<{ friendshipId: string; friend: any; acceptedAt: Date }> {
    // 1. Kiểm tra sự tồn tại của lời mời
    const request = await this.friendRequestRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError("Không tìm thấy lời mời kết bạn");
    }

    // 2. Kiểm tra quyền hạn: Chỉ người nhận mới có quyền chấp nhận
    if (request.receiverId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền chấp nhận lời mời kết bạn này");
    }

    // 3. Kiểm tra trạng thái lời mời: Bắt buộc phải là PENDING
    if (request.status !== "PENDING") {
      throw new ValidationError("Lời mời kết bạn này không còn ở trạng thái chờ chấp nhận");
    }

    const senderIdStr = request.senderId.toString();

    // 4. Thực thi Transaction nguyên tử: Cập nhật trạng thái lời mời ACCEPTED và tạo bản ghi bạn bè
    const session = await mongoose.startSession();
    let friendshipId = "";
    const acceptedAt = new Date();

    try {
      await session.withTransaction(async () => {
        await this.friendRequestRepo.updateStatus(requestId, "ACCEPTED", acceptedAt, session);
        const friendship = await this.friendRepo.createFriendship(
          senderIdStr,
          userId,
          requestId,
          session
        );
        friendshipId = (friendship as any)._id?.toString() || friendship.id;
      });
    } finally {
      await session.endSession();
    }

    // 5. Lấy thông tin hồ sơ của người bạn mới kết nối để trả về cho client
    const friendUser = await this.userRepo.findById(senderIdStr);
    return {
      friendshipId,
      friend: friendUser,
      acceptedAt,
    };
  }

  /**
   * Từ chối lời mời kết bạn
   * @param userId ID người nhận đang thao tác từ chối
   * @param requestId ID lời mời kết bạn
   */
  async rejectFriendRequest(userId: string, requestId: string): Promise<void> {
    const request = await this.friendRequestRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError("Không tìm thấy lời mời kết bạn");
    }

    // Chỉ người nhận mới có quyền từ chối
    if (request.receiverId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền từ chối lời mời kết bạn này");
    }

    if (request.status !== "PENDING") {
      throw new ValidationError("Lời mời kết bạn này không còn ở trạng thái chờ");
    }

    // Cập nhật trạng thái thành REJECTED
    await this.friendRequestRepo.updateStatus(requestId, "REJECTED", new Date());
  }

  /**
   * Hủy lời mời kết bạn đã gửi đi
   * @param userId ID người gửi đang thao tác hủy lời mời
   * @param requestId ID lời mời kết bạn
   */
  async cancelFriendRequest(userId: string, requestId: string): Promise<void> {
    const request = await this.friendRequestRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError("Không tìm thấy lời mời kết bạn");
    }

    // Chỉ người gửi mới có quyền hủy lời mời do mình tạo
    if (request.senderId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền hủy lời mời kết bạn này");
    }

    if (request.status !== "PENDING") {
      throw new ValidationError("Lời mời kết bạn này không còn ở trạng thái chờ");
    }

    // Cập nhật trạng thái thành CANCELED
    await this.friendRequestRepo.updateStatus(requestId, "CANCELED");
  }

  /**
   * Lấy danh sách lời mời kết bạn nhận được đang chờ phản hồi
   * @param userId ID của người dùng hiện tại
   * @param options Tùy chọn phân trang (page, limit)
   */
  async getReceivedRequests(
    userId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<any>> {
    const { items, total } = await this.friendRequestRepo.findReceived(userId, options);
    return {
      items,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit) || 1,
      },
    };
  }

  /**
   * Lấy danh sách lời mời kết bạn đã gửi đi đang chờ đối phương duyệt
   * @param userId ID của người dùng hiện tại
   * @param options Tùy chọn phân trang (page, limit)
   */
  async getSentRequests(
    userId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<any>> {
    const { items, total } = await this.friendRequestRepo.findSent(userId, options);
    return {
      items,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit) || 1,
      },
    };
  }

  /**
   * Lấy danh sách bạn bè kết hợp tìm kiếm tên, lọc trạng thái online và phân trang
   * @param userId ID của người dùng hiện tại
   * @param options Tùy chọn tìm kiếm và phân trang
   */
  async getFriends(
    userId: string,
    options: FriendQueryOptions
  ): Promise<PaginatedResult<any>> {
    const { items, total } = await this.friendRepo.findFriends(userId, options);
    return {
      items,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit) || 1,
      },
    };
  }

  /**
   * Hủy kết bạn (xóa quan hệ bạn bè 2 chiều)
   * @param userId ID người dùng hiện tại
   * @param targetUserId ID người bạn cần hủy kết bạn
   */
  async removeFriend(userId: string, targetUserId: string): Promise<void> {
    if (userId === targetUserId) {
      throw new ValidationError("Không thể hủy kết bạn với chính mình");
    }

    // Kiểm tra xem hai người có thực sự đang là bạn bè không
    const isFriend = await this.friendRepo.isFriend(userId, targetUserId);
    if (!isFriend) {
      throw new NotFoundError("Người dùng này không nằm trong danh sách bạn bè");
    }

    // Thực hiện xóa bản ghi bạn bè
    await this.friendRepo.removeFriendship(userId, targetUserId);
  }

  /**
   * Xác định trạng thái quan hệ 2 chiều giữa người dùng hiện tại và người dùng mục tiêu
   * Độ ưu tiên kiểm tra:
   * 1. Chính mình -> NONE
   * 2. Bị chặn (một trong hai người chặn người kia) -> BLOCKED
   * 3. Đã là bạn bè -> FRIENDS
   * 4. Mình đã gửi lời mời -> PENDING_SENT
   * 5. Người kia gửi lời mời cho mình -> PENDING_RECEIVED
   * 6. Không có quan hệ gì -> NONE
   */
  async getRelationshipStatus(
    userId: string,
    targetUserId: string
  ): Promise<{ targetUserId: string; status: RelationshipStatus }> {
    if (userId === targetUserId) {
      return { targetUserId, status: "NONE" };
    }

    // Kiểm tra quan hệ chặn
    const isBlocked = await this.blockRepo.isBlocked(userId, targetUserId);
    if (isBlocked) {
      return { targetUserId, status: "BLOCKED" };
    }

    // Kiểm tra quan hệ bạn bè
    const isFriend = await this.friendRepo.isFriend(userId, targetUserId);
    if (isFriend) {
      return { targetUserId, status: "FRIENDS" };
    }

    // Kiểm tra lời mời mình đã gửi
    const sentPending = await this.friendRequestRepo.findPending(userId, targetUserId);
    if (sentPending) {
      return { targetUserId, status: "PENDING_SENT" };
    }

    // Kiểm tra lời mời người kia gửi cho mình
    const receivedPending = await this.friendRequestRepo.findPending(targetUserId, userId);
    if (receivedPending) {
      return { targetUserId, status: "PENDING_RECEIVED" };
    }

    return { targetUserId, status: "NONE" };
  }

  /**
   * Chặn người dùng (thực thi trong MongoDB Transaction)
   * Các hành động nguyên tử:
   * 1. Tạo bản ghi chặn mới trong bảng blocks
   * 2. Xóa quan hệ bạn bè giữa 2 người (nếu có)
   * 3. Hủy toàn bộ lời mời kết bạn đang chờ (PENDING) giữa 2 người
   * @param blockerId ID người thực hiện hành vi chặn
   * @param blockedId ID người bị chặn
   */
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new ValidationError("Không thể tự chặn chính mình");
    }

    // Kiểm tra người dùng mục tiêu có tồn tại trong hệ thống không
    const targetUser = await this.userRepo.findById(blockedId);
    if (!targetUser) {
      throw new NotFoundError("Không tìm thấy người dùng cần chặn");
    }

    // Kiểm tra xem đã chặn người dùng này trước đó chưa
    const alreadyBlocked = await this.blockRepo.isBlockedBy(blockerId, blockedId);
    if (alreadyBlocked) {
      throw new ConflictError("Bạn đã chặn người dùng này rồi");
    }

    // Thực thi Transaction nguyên tử đảm bảo toàn vẹn dữ liệu
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // 1. Tạo bản ghi chặn
        await this.blockRepo.createBlock(blockerId, blockedId, session);
        // 2. Xóa quan hệ bạn bè nếu có
        await this.friendRepo.removeFriendship(blockerId, blockedId, session);
        // 3. Hủy các lời mời kết bạn 2 chiều đang pending
        await this.friendRequestRepo.cancelPendingBetween(blockerId, blockedId, session);
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Bỏ chặn người dùng
   * @param blockerId ID người đang thực hiện bỏ chặn
   * @param blockedId ID người được bỏ chặn
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const isBlocked = await this.blockRepo.isBlockedBy(blockerId, blockedId);
    if (!isBlocked) {
      throw new NotFoundError("Người dùng này không nằm trong danh sách chặn của bạn");
    }

    await this.blockRepo.removeBlock(blockerId, blockedId);
  }

  /**
   * Lấy danh sách những người dùng bị người này chặn (có phân trang)
   * @param blockerId ID người thực hiện chặn
   * @param options Tùy chọn phân trang (page, limit)
   */
  async getBlockedUsers(
    blockerId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<any>> {
    const { items, total } = await this.blockRepo.findBlockedUsers(blockerId, options);
    return {
      items,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit) || 1,
      },
    };
  }
}

export const friendService = new FriendService();
