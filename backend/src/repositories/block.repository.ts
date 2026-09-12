import { ClientSession, Types } from "mongoose";
import { BlockModel, IBlock } from "../models/block.model";
import { PaginationOptions } from "./friend-request.repository";

/**
 * Interface định nghĩa các phương thức quản lý thao tác Chặn người dùng (Block)
 */
export interface IBlockRepository {
  /** Tạo bản ghi chặn người dùng mới (hỗ trợ session transaction) */
  createBlock(blockerId: string, blockedId: string, session?: ClientSession): Promise<IBlock>;
  /** Xóa bản ghi chặn (bỏ chặn) */
  removeBlock(blockerId: string, blockedId: string): Promise<boolean>;
  /** Kiểm tra quan hệ chặn hai chiều giữa 2 người dùng (bất kỳ ai chặn ai) */
  isBlocked(user1: string, user2: string): Promise<boolean>;
  /** Kiểm tra xem blockerId có đang trực tiếp chặn blockedId hay không */
  isBlockedBy(blockerId: string, blockedId: string): Promise<boolean>;
  /** Lấy danh sách những người dùng bị người này chặn (kèm thông tin user và phân trang) */
  findBlockedUsers(
    blockerId: string,
    options: PaginationOptions
  ): Promise<{ items: IBlock[]; total: number }>;
}

export class BlockRepository implements IBlockRepository {
  /**
   * Tạo bản ghi chặn người dùng trong MongoDB
   */
  async createBlock(blockerId: string, blockedId: string, session?: ClientSession): Promise<IBlock> {
    const doc = new BlockModel({
      blockerId: new Types.ObjectId(blockerId),
      blockedId: new Types.ObjectId(blockedId),
    });
    return doc.save({ session });
  }

  /**
   * Hủy chặn: Xóa bản ghi chặn giữa blockerId và blockedId
   */
  async removeBlock(blockerId: string, blockedId: string): Promise<boolean> {
    const result = await BlockModel.deleteOne({
      blockerId: new Types.ObjectId(blockerId),
      blockedId: new Types.ObjectId(blockedId),
    });
    return result.deletedCount > 0;
  }

  /**
   * Kiểm tra quan hệ chặn 2 chiều: Trả về true nếu user1 chặn user2 HOẶC user2 chặn user1
   */
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

  /**
   * Kiểm tra xem blockerId có đang chủ động chặn blockedId không
   */
  async isBlockedBy(blockerId: string, blockedId: string): Promise<boolean> {
    const count = await BlockModel.countDocuments({
      blockerId: new Types.ObjectId(blockerId),
      blockedId: new Types.ObjectId(blockedId),
    });
    return count > 0;
  }

  /**
   * Lấy danh sách người dùng bị chặn bởi blockerId kèm thông tin cơ bản có phân trang
   */
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
