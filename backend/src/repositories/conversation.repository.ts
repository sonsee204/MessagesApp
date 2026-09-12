import { Types, ClientSession } from "mongoose";
import { ConversationModel, IConversation } from "../models/conversation.model";

/**
 * Giao diện Repository quản lý dữ liệu cuộc trò chuyện (Conversation Repository Interface)
 */
export interface IConversationRepository {
  /**
   * Tìm cuộc trò chuyện theo ID kèm thông tin thành viên và tin nhắn cuối
   */
  findById(id: string): Promise<IConversation | null>;

  /**
   * Lấy danh sách các cuộc trò chuyện của một người dùng
   */
  findByUserId(userId: string): Promise<IConversation[]>;

  /**
   * Tìm cuộc hội thoại trực tiếp (1-1) giữa 2 người dùng
   */
  findDirectBetween(user1Id: string, user2Id: string): Promise<IConversation | null>;

  /**
   * Tạo cuộc trò chuyện mới (DIRECT hoặc GROUP)
   */
  create(data: {
    title?: string;
    type: "DIRECT" | "GROUP";
    participants: string[];
    createdBy: string;
  }): Promise<IConversation>;

  /**
   * Cập nhật tin nhắn cuối cùng và mốc thời gian của cuộc trò chuyện (hỗ trợ Transaction Session)
   */
  updateLastMessage(
    conversationId: string,
    messageId: string,
    timestamp?: Date,
    session?: ClientSession
  ): Promise<void>;
}

/**
 * Hiện thực IConversationRepository sử dụng Mongoose ODM
 */
export class MongooseConversationRepository implements IConversationRepository {
  /**
   * Tìm cuộc trò chuyện theo ID kèm thông tin chi tiết người tham gia và tin nhắn cuối
   */
  async findById(id: string): Promise<IConversation | null> {
    return ConversationModel.findById(id)
      .populate("participants", "username displayName avatarUrl isOnline lastSeenAt")
      .populate("lastMessage")
      .exec();
  }

  /**
   * Tìm tất cả cuộc trò chuyện mà người dùng tham gia, sắp xếp theo thời gian tin nhắn mới nhất
   */
  async findByUserId(userId: string): Promise<IConversation[]> {
    const objectId = new Types.ObjectId(userId);
    return ConversationModel.find({ participants: objectId })
      .populate("participants", "username displayName avatarUrl isOnline lastSeenAt")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 })
      .exec();
  }

  /**
   * Tìm cuộc trò chuyện trực tiếp (DIRECT) giữa đúng 2 người dùng
   */
  async findDirectBetween(user1Id: string, user2Id: string): Promise<IConversation | null> {
    const o1 = new Types.ObjectId(user1Id);
    const o2 = new Types.ObjectId(user2Id);
    return ConversationModel.findOne({
      type: "DIRECT",
      participants: { $all: [o1, o2], $size: 2 },
    })
      .populate("participants", "username displayName avatarUrl isOnline lastSeenAt")
      .exec();
  }

  /**
   * Tạo mới cuộc trò chuyện
   */
  async create(data: {
    title?: string;
    type: "DIRECT" | "GROUP";
    participants: string[];
    createdBy: string;
  }): Promise<IConversation> {
    const conversation = await ConversationModel.create({
      title: data.title,
      type: data.type,
      participants: data.participants.map((id) => new Types.ObjectId(id)),
      createdBy: new Types.ObjectId(data.createdBy),
      lastMessageAt: new Date(),
    });

    return conversation.populate(
      "participants",
      "username displayName avatarUrl isOnline lastSeenAt"
    );
  }

  /**
   * Cập nhật tin nhắn mới nhất và thời gian cho cuộc trò chuyện (hỗ trợ Transaction Session)
   */
  async updateLastMessage(
    conversationId: string,
    messageId: string,
    timestamp: Date = new Date(),
    session?: ClientSession
  ): Promise<void> {
    await ConversationModel.findByIdAndUpdate(
      conversationId,
      {
        lastMessage: new Types.ObjectId(messageId),
        lastMessageAt: timestamp,
      },
      { session }
    ).exec();
  }
}

/** Thể hiện mặc định (Singleton) của MongooseConversationRepository */
export const conversationRepository = new MongooseConversationRepository();
