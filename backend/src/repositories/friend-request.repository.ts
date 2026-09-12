import { ClientSession, Types } from "mongoose";
import {
  FriendRequestModel,
  IFriendRequest,
  FriendRequestStatus,
} from "../models/friend-request.model";

/**
 * Tùy chọn phân trang cơ bản
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Interface định nghĩa các phương thức thao tác dữ liệu Lời mời kết bạn
 */
export interface IFriendRequestRepository {
  /** Tạo mới một lời mời kết bạn */
  create(
    data: { senderId: string; receiverId: string; note?: string },
    session?: ClientSession
  ): Promise<IFriendRequest>;
  /** Tìm lời mời kết bạn theo ID */
  findById(id: string): Promise<IFriendRequest | null>;
  /** Tìm lời mời đang ở trạng thái PENDING giữa người gửi và người nhận */
  findPending(senderId: string, receiverId: string): Promise<IFriendRequest | null>;
  /** Cập nhật trạng thái của lời mời (ACCEPTED, REJECTED, CANCELED) */
  updateStatus(
    id: string,
    status: FriendRequestStatus,
    respondedAt?: Date,
    session?: ClientSession
  ): Promise<IFriendRequest | null>;
  /** Lấy danh sách lời mời nhận được (PENDING) kèm thông tin người gửi có phân trang */
  findReceived(
    receiverId: string,
    options: PaginationOptions
  ): Promise<{ items: IFriendRequest[]; total: number }>;
  /** Lấy danh sách lời mời đã gửi (PENDING) kèm thông tin người nhận có phân trang */
  findSent(
    senderId: string,
    options: PaginationOptions
  ): Promise<{ items: IFriendRequest[]; total: number }>;
  /** Hủy toàn bộ lời mời đang chờ giữa hai người dùng (khi chấp nhận hoặc chặn) */
  cancelPendingBetween(user1: string, user2: string, session?: ClientSession): Promise<number>;
}

export class FriendRequestRepository implements IFriendRequestRepository {
  /**
   * Tạo tài liệu lời mời kết bạn mới trong MongoDB
   */
  async create(
    data: { senderId: string; receiverId: string; note?: string },
    session?: ClientSession
  ): Promise<IFriendRequest> {
    const doc = new FriendRequestModel({
      senderId: new Types.ObjectId(data.senderId),
      receiverId: new Types.ObjectId(data.receiverId),
      note: data.note ?? "",
      status: "PENDING",
    });
    return doc.save({ session });
  }

  /**
   * Tìm lời mời kết bạn theo ObjectId
   */
  async findById(id: string): Promise<IFriendRequest | null> {
    return FriendRequestModel.findById(id);
  }

  /**
   * Tìm lời mời đang chờ phản hồi giữa người gửi và người nhận cụ thể
   */
  async findPending(senderId: string, receiverId: string): Promise<IFriendRequest | null> {
    return FriendRequestModel.findOne({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(receiverId),
      status: "PENDING",
    });
  }

  /**
   * Cập nhật trạng thái và thời gian phản hồi của lời mời kết bạn
   */
  async updateStatus(
    id: string,
    status: FriendRequestStatus,
    respondedAt?: Date,
    session?: ClientSession
  ): Promise<IFriendRequest | null> {
    return FriendRequestModel.findByIdAndUpdate(
      id,
      {
        status,
        ...(respondedAt ? { respondedAt } : {}),
      },
      { new: true, session }
    );
  }

  /**
   * Lấy danh sách lời mời kết bạn nhận được đang chờ duyệt (phân trang và populate thông tin người gửi)
   */
  async findReceived(
    receiverId: string,
    { page, limit }: PaginationOptions
  ): Promise<{ items: IFriendRequest[]; total: number }> {
    const query = {
      receiverId: new Types.ObjectId(receiverId),
      status: "PENDING",
    };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      FriendRequestModel.find(query)
        .populate("senderId", "username displayName avatarUrl isOnline")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      FriendRequestModel.countDocuments(query),
    ]);

    return { items, total };
  }

  /**
   * Lấy danh sách lời mời kết bạn đã gửi đi đang chờ đối phương duyệt (phân trang và populate người nhận)
   */
  async findSent(
    senderId: string,
    { page, limit }: PaginationOptions
  ): Promise<{ items: IFriendRequest[]; total: number }> {
    const query = {
      senderId: new Types.ObjectId(senderId),
      status: "PENDING",
    };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      FriendRequestModel.find(query)
        .populate("receiverId", "username displayName avatarUrl isOnline")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      FriendRequestModel.countDocuments(query),
    ]);

    return { items, total };
  }

  /**
   * Hủy các lời mời kết bạn đang chờ giữa 2 người dùng (hỗ trợ session trong transaction)
   */
  async cancelPendingBetween(user1: string, user2: string, session?: ClientSession): Promise<number> {
    const u1 = new Types.ObjectId(user1);
    const u2 = new Types.ObjectId(user2);

    const res = await FriendRequestModel.updateMany(
      {
        $or: [
          { senderId: u1, receiverId: u2, status: "PENDING" },
          { senderId: u2, receiverId: u1, status: "PENDING" },
        ],
      },
      { status: "CANCELED" },
      { session }
    );

    return res.modifiedCount;
  }
}

export const friendRequestRepository = new FriendRequestRepository();
