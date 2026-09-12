import { ClientSession, Types } from "mongoose";
import { BlockModel, IBlock } from "../models/block.model";
import { PaginationOptions } from "./friend-request.repository";

export interface IBlockRepository {
  createBlock(blockerId: string, blockedId: string, session?: ClientSession): Promise<IBlock>;
  removeBlock(blockerId: string, blockedId: string): Promise<boolean>;
  isBlocked(user1: string, user2: string): Promise<boolean>;
  isBlockedBy(blockerId: string, blockedId: string): Promise<boolean>;
  findBlockedUsers(
    blockerId: string,
    options: PaginationOptions
  ): Promise<{ items: IBlock[]; total: number }>;
}

export class BlockRepository implements IBlockRepository {
  async createBlock(blockerId: string, blockedId: string, session?: ClientSession): Promise<IBlock> {
    const doc = new BlockModel({
      blockerId: new Types.ObjectId(blockerId),
      blockedId: new Types.ObjectId(blockedId),
    });
    return doc.save({ session });
  }

  async removeBlock(blockerId: string, blockedId: string): Promise<boolean> {
    const result = await BlockModel.deleteOne({
      blockerId: new Types.ObjectId(blockerId),
      blockedId: new Types.ObjectId(blockedId),
    });
    return result.deletedCount > 0;
  }

  async isBlocked(user1: string, user2: string): Promise<boolean> {
    const u1 = new Types.ObjectId(user1);
    const u2 = new Types.ObjectId(user2);

    const count = await BlockModel.countDocuments({
      $or: [
        { blockerId: u1, blockedId: u2 },
        { blockerId: u2, blockedId: u1 },
      ],
    });
    return count > 0;
  }

  async isBlockedBy(blockerId: string, blockedId: string): Promise<boolean> {
    const count = await BlockModel.countDocuments({
      blockerId: new Types.ObjectId(blockerId),
      blockedId: new Types.ObjectId(blockedId),
    });
    return count > 0;
  }

  async findBlockedUsers(
    blockerId: string,
    { page, limit }: PaginationOptions
  ): Promise<{ items: IBlock[]; total: number }> {
    const query = { blockerId: new Types.ObjectId(blockerId) };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      BlockModel.find(query)
        .populate("blockedId", "username displayName avatarUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BlockModel.countDocuments(query),
    ]);

    return { items, total };
  }
}

export const blockRepository = new BlockRepository();
