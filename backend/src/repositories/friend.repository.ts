import { ClientSession, Types } from "mongoose";
import { FriendModel, IFriend, normalizeFriendIds } from "../models/friend.model";
import { PaginationOptions } from "./friend-request.repository";

/**
 * Tùy chọn tìm kiếm danh sách bạn bè
 */
export interface FriendQueryOptions extends PaginationOptions {
  search?: string;
  onlineOnly?: boolean;
}

/**
 * Cấu trúc dữ liệu chi tiết của từng người bạn trong danh sách trả về
 */
export interface FriendItemResult {
  friendshipId: string;
  friendSince: Date;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    bio?: string;
    isOnline: boolean;
    lastSeenAt: Date;
  };
}

/**
 * Interface định nghĩa các thao tác dữ liệu liên quan đến Quan hệ bạn bè
 */
export interface IFriendRepository {
  /** Tạo bản ghi quan hệ bạn bè 2 chiều với cặp userA < userB đã chuẩn hóa */
  createFriendship(
    user1: string,
    user2: string,
    friendRequestId?: string,
    session?: ClientSession
  ): Promise<IFriend>;
  /** Kiểm tra xem 2 người dùng có đang là bạn bè của nhau không */
  isFriend(user1: string, user2: string): Promise<boolean>;
  /** Xóa quan hệ bạn bè giữa 2 người dùng (hỗ trợ session transaction) */
  removeFriendship(user1: string, user2: string, session?: ClientSession): Promise<boolean>;
  /** Truy vấn danh sách bạn bè kết hợp aggregate thông tin user, lọc online và tìm kiếm */
  findFriends(
    userId: string,
    options: FriendQueryOptions
  ): Promise<{ items: FriendItemResult[]; total: number }>;
  /** Đếm tổng số lượng bạn bè của một người dùng */
  countFriends(userId: string): Promise<number>;
}

export class FriendRepository implements IFriendRepository {
  /**
   * Tạo bản ghi bạn bè mới, chuẩn hóa userA < userB và liên kết với requestId (nếu có)
   */
  async createFriendship(
    user1: string,
    user2: string,
    friendRequestId?: string,
    session?: ClientSession
  ): Promise<IFriend> {
    const [userA, userB] = normalizeFriendIds(user1, user2);
    const doc = new FriendModel({
      userA,
      userB,
      friendRequestId: friendRequestId ? new Types.ObjectId(friendRequestId) : null,
    });
    return doc.save({ session });
  }

  /**
   * Kiểm tra quan hệ bạn bè 2 chiều giữa 2 user
   */
  async isFriend(user1: string, user2: string): Promise<boolean> {
    if (user1 === user2) return false;
    const [userA, userB] = normalizeFriendIds(user1, user2);
    const count = await FriendModel.countDocuments({ userA, userB });
    return count > 0;
  }

  /**
   * Xóa bản ghi bạn bè giữa 2 người dùng
   */
  async removeFriendship(user1: string, user2: string, session?: ClientSession): Promise<boolean> {
    if (user1 === user2) return false;
    const [userA, userB] = normalizeFriendIds(user1, user2);
    const result = await FriendModel.deleteOne({ userA, userB }, { session });
    return result.deletedCount > 0;
  }

  /**
   * Lấy danh sách bạn bè của người dùng bằng MongoDB Aggregation Pipeline:
   * 1. $match tìm các quan hệ bạn bè chứa userId ở userA hoặc userB
   * 2. $project xác định friendId là người đối diện
   * 3. $lookup join bảng users để lấy hồ sơ người bạn
   * 4. Hỗ trợ lọc theo onlineOnly và tìm kiếm theo tên displayName/username
   * 5. Sắp xếp theo ngày kết bạn mới nhất và phân trang skip/limit
   */
  async findFriends(
    userId: string,
    options: FriendQueryOptions
  ): Promise<{ items: FriendItemResult[]; total: number }> {
    const userObjId = new Types.ObjectId(userId);
    const skip = (options.page - 1) * options.limit;

    const pipeline: any[] = [
      {
        $match: {
          $or: [{ userA: userObjId }, { userB: userObjId }],
        },
      },
      {
        $project: {
          friendId: {
            $cond: { if: { $eq: ["$userA", userObjId] }, then: "$userB", else: "$userA" },
          },
          createdAt: 1,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "friendId",
          foreignField: "_id",
          as: "friendUser",
        },
      },
      { $unwind: "$friendUser" },
    ];

    if (options.onlineOnly) {
      pipeline.push({ $match: { "friendUser.isOnline": true } });
    }

    if (options.search) {
      const regex = new RegExp(options.search, "i");
      pipeline.push({
        $match: {
          $or: [{ "friendUser.displayName": regex }, { "friendUser.username": regex }],
        },
      });
    }

    const countPipeline = [...pipeline, { $count: "total" }];
    const dataPipeline = [
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: options.limit },
      {
        $project: {
          friendshipId: "$_id",
          friendSince: "$createdAt",
          user: {
            id: "$friendUser._id",
            username: "$friendUser.username",
            displayName: "$friendUser.displayName",
            avatarUrl: "$friendUser.avatarUrl",
            bio: "$friendUser.bio",
            isOnline: "$friendUser.isOnline",
            lastSeenAt: "$friendUser.lastSeenAt",
          },
        },
      },
    ];

    const [dataResult, countResult] = await Promise.all([
      FriendModel.aggregate(dataPipeline),
      FriendModel.aggregate(countPipeline),
    ]);

    const items: FriendItemResult[] = dataResult.map((item) => ({
      friendshipId: item.friendshipId.toString(),
      friendSince: item.friendSince,
      user: {
        ...item.user,
        id: item.user.id.toString(),
      },
    }));

    const total = countResult[0]?.total ?? 0;
    return { items, total };
  }

  /**
   * Đếm tổng số lượng bạn bè mà một người dùng đang có
   */
  async countFriends(userId: string): Promise<number> {
    const userObjId = new Types.ObjectId(userId);
    return FriendModel.countDocuments({
      $or: [{ userA: userObjId }, { userB: userObjId }],
    });
  }
}

export const friendRepository = new FriendRepository();
