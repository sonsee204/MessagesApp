import { ClientSession, Types } from "mongoose";
import {
  FriendRequestModel,
  IFriendRequest,
  FriendRequestStatus,
} from "../models/friend-request.model";

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface IFriendRequestRepository {
  create(
    data: { senderId: string; receiverId: string; note?: string },
    session?: ClientSession
  ): Promise<IFriendRequest>;
  findById(id: string): Promise<IFriendRequest | null>;
  findPending(senderId: string, receiverId: string): Promise<IFriendRequest | null>;
  updateStatus(
    id: string,
    status: FriendRequestStatus,
    respondedAt?: Date,
    session?: ClientSession
  ): Promise<IFriendRequest | null>;
  findReceived(
    receiverId: string,
    options: PaginationOptions
  ): Promise<{ items: IFriendRequest[]; total: number }>;
  findSent(
    senderId: string,
    options: PaginationOptions
  ): Promise<{ items: IFriendRequest[]; total: number }>;
  cancelPendingBetween(user1: string, user2: string, session?: ClientSession): Promise<number>;
}

export class FriendRequestRepository implements IFriendRequestRepository {
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

  async findById(id: string): Promise<IFriendRequest | null> {
    return FriendRequestModel.findById(id);
  }

  async findPending(senderId: string, receiverId: string): Promise<IFriendRequest | null> {
    return FriendRequestModel.findOne({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(receiverId),
      status: "PENDING",
    });
  }

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
