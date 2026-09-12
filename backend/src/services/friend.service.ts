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

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type RelationshipStatus =
  | "NONE"
  | "PENDING_SENT"
  | "PENDING_RECEIVED"
  | "FRIENDS"
  | "BLOCKED";

export class FriendService {
  constructor(
    private friendRequestRepo: IFriendRequestRepository = friendRequestRepository,
    private friendRepo: IFriendRepository = friendRepository,
    private blockRepo: IBlockRepository = blockRepository,
    private userRepo: IUserRepository = userRepository
  ) {}

  async sendFriendRequest(
    senderId: string,
    receiverId: string,
    note?: string
  ): Promise<IFriendRequest> {
    if (senderId === receiverId) {
      throw new ValidationError("Không thể gửi lời mời kết bạn cho chính mình");
    }

    const receiver = await this.userRepo.findById(receiverId);
    if (!receiver) {
      throw new NotFoundError("Không tìm thấy người dùng nhận lời mời");
    }

    const isBlocked = await this.blockRepo.isBlocked(senderId, receiverId);
    if (isBlocked) {
      throw new ForbiddenError("Không thể gửi lời mời kết bạn cho người dùng này");
    }

    const isFriend = await this.friendRepo.isFriend(senderId, receiverId);
    if (isFriend) {
      throw new ConflictError("Hai người đã là bạn bè của nhau");
    }

    // Kiểm tra đã có lời mời gửi đi đang pending chưa
    const sentPending = await this.friendRequestRepo.findPending(senderId, receiverId);
    if (sentPending) {
      throw new ConflictError("Bạn đã gửi lời mời kết bạn trước đó và đang chờ phản hồi");
    }

    // Kiểm tra đối phương đã gửi lời mời cho mình chưa
    const receivedPending = await this.friendRequestRepo.findPending(receiverId, senderId);
    if (receivedPending) {
      throw new ConflictError(
        "Người dùng này đã gửi lời mời kết bạn cho bạn, vui lòng kiểm tra danh sách lời mời nhận được"
      );
    }

    return this.friendRequestRepo.create({
      senderId,
      receiverId,
      note,
    });
  }

  async acceptFriendRequest(
    userId: string,
    requestId: string
  ): Promise<{ friendshipId: string; friend: any; acceptedAt: Date }> {
    const request = await this.friendRequestRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError("Không tìm thấy lời mời kết bạn");
    }

    if (request.receiverId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền chấp nhận lời mời kết bạn này");
    }

    if (request.status !== "PENDING") {
      throw new ValidationError("Lời mời kết bạn này không còn ở trạng thái chờ chấp nhận");
    }

    const senderIdStr = request.senderId.toString();

    // Thực hiện trong Session Transaction
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

    const friendUser = await this.userRepo.findById(senderIdStr);
    return {
      friendshipId,
      friend: friendUser,
      acceptedAt,
    };
  }

  async rejectFriendRequest(userId: string, requestId: string): Promise<void> {
    const request = await this.friendRequestRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError("Không tìm thấy lời mời kết bạn");
    }

    if (request.receiverId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền từ chối lời mời kết bạn này");
    }

    if (request.status !== "PENDING") {
      throw new ValidationError("Lời mời kết bạn này không còn ở trạng thái chờ");
    }

    await this.friendRequestRepo.updateStatus(requestId, "REJECTED", new Date());
  }

  async cancelFriendRequest(userId: string, requestId: string): Promise<void> {
    const request = await this.friendRequestRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError("Không tìm thấy lời mời kết bạn");
    }

    if (request.senderId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền hủy lời mời kết bạn này");
    }

    if (request.status !== "PENDING") {
      throw new ValidationError("Lời mời kết bạn này không còn ở trạng thái chờ");
    }

    await this.friendRequestRepo.updateStatus(requestId, "CANCELED");
  }

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

  async removeFriend(userId: string, targetUserId: string): Promise<void> {
    if (userId === targetUserId) {
      throw new ValidationError("Không thể hủy kết bạn với chính mình");
    }

    const isFriend = await this.friendRepo.isFriend(userId, targetUserId);
    if (!isFriend) {
      throw new NotFoundError("Người dùng này không nằm trong danh sách bạn bè");
    }

    await this.friendRepo.removeFriendship(userId, targetUserId);
  }

  async getRelationshipStatus(
    userId: string,
    targetUserId: string
  ): Promise<{ targetUserId: string; status: RelationshipStatus }> {
    if (userId === targetUserId) {
      return { targetUserId, status: "NONE" };
    }

    const isBlocked = await this.blockRepo.isBlocked(userId, targetUserId);
    if (isBlocked) {
      return { targetUserId, status: "BLOCKED" };
    }

    const isFriend = await this.friendRepo.isFriend(userId, targetUserId);
    if (isFriend) {
      return { targetUserId, status: "FRIENDS" };
    }

    const sentPending = await this.friendRequestRepo.findPending(userId, targetUserId);
    if (sentPending) {
      return { targetUserId, status: "PENDING_SENT" };
    }

    const receivedPending = await this.friendRequestRepo.findPending(targetUserId, userId);
    if (receivedPending) {
      return { targetUserId, status: "PENDING_RECEIVED" };
    }

    return { targetUserId, status: "NONE" };
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new ValidationError("Không thể tự chặn chính mình");
    }

    const targetUser = await this.userRepo.findById(blockedId);
    if (!targetUser) {
      throw new NotFoundError("Không tìm thấy người dùng cần chặn");
    }

    const alreadyBlocked = await this.blockRepo.isBlockedBy(blockerId, blockedId);
    if (alreadyBlocked) {
      throw new ConflictError("Bạn đã chặn người dùng này rồi");
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await this.blockRepo.createBlock(blockerId, blockedId, session);
        await this.friendRepo.removeFriendship(blockerId, blockedId, session);
        await this.friendRequestRepo.cancelPendingBetween(blockerId, blockedId, session);
      });
    } finally {
      await session.endSession();
    }
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const isBlocked = await this.blockRepo.isBlockedBy(blockerId, blockedId);
    if (!isBlocked) {
      throw new NotFoundError("Người dùng này không nằm trong danh sách chặn của bạn");
    }

    await this.blockRepo.removeBlock(blockerId, blockedId);
  }

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
