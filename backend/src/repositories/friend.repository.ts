import { ClientSession, Types } from "mongoose";
import { FriendModel, IFriend, normalizeFriendIds } from "../models/friend.model";
import { PaginationOptions } from "./friend-request.repository";

export interface FriendQueryOptions extends PaginationOptions {
  search?: string;
  onlineOnly?: boolean;
}

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

export interface IFriendRepository {
  createFriendship(
    user1: string,
    user2: string,
    friendRequestId?: string,
    session?: ClientSession
  ): Promise<IFriend>;
  isFriend(user1: string, user2: string): Promise<boolean>;
  removeFriendship(user1: string, user2: string, session?: ClientSession): Promise<boolean>;
  findFriends(
    userId: string,
    options: FriendQueryOptions
  ): Promise<{ items: FriendItemResult[]; total: number }>;
  countFriends(userId: string): Promise<number>;
}

export class FriendRepository implements IFriendRepository {
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

  async isFriend(user1: string, user2: string): Promise<boolean> {
    if (user1 === user2) return false;
    const [userA, userB] = normalizeFriendIds(user1, user2);
    const count = await FriendModel.countDocuments({ userA, userB });
    return count > 0;
  }

  async removeFriendship(user1: string, user2: string, session?: ClientSession): Promise<boolean> {
    if (user1 === user2) return false;
    const [userA, userB] = normalizeFriendIds(user1, user2);
    const result = await FriendModel.deleteOne({ userA, userB }, { session });
    return result.deletedCount > 0;
  }

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

  async countFriends(userId: string): Promise<number> {
    const userObjId = new Types.ObjectId(userId);
    return FriendModel.countDocuments({
      $or: [{ userA: userObjId }, { userB: userObjId }],
    });
  }
}

export const friendRepository = new FriendRepository();
