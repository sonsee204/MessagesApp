import { Types, ClientSession } from "mongoose";
import { MessageModel, IMessage, IAttachment } from "../models/message.model";

/**
 * Giao diện Repository quản lý dữ liệu tin nhắn (Message Repository Interface)
 */
export interface IMessageRepository {
  /**
   * Tìm tin nhắn theo ID kèm thông tin người gửi
   * @param id ID của tin nhắn
   * @returns Tin nhắn tìm thấy hoặc null
   */
  findById(id: string): Promise<IMessage | null>;

  /**
   * Tạo một tin nhắn mới trong cuộc trò chuyện (hỗ trợ Transaction Session)
   * @param data Dữ liệu tin nhắn mới
   * @param session ClientSession của Mongoose phục vụ giao dịch phân tán
   * @returns Bản ghi tin nhắn đã tạo
   */
  create(
    data: {
      conversationId: string;
      senderId: string;
      content?: string;
      type?: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
      attachments?: IAttachment[];
      replyToMessageId?: string | null;
    },
    session?: ClientSession
  ): Promise<IMessage>;

  /**
   * Lấy danh sách tin nhắn theo cuộc trò chuyện hỗ trợ phân trang dạng con trỏ (cursor)
   * @param conversationId ID cuộc trò chuyện
   * @param options Tham số phân trang (limit, before timestamp)
   * @returns Danh sách tin nhắn sắp xếp giảm dần theo thời gian tạo
   */
  findByConversationId(
    conversationId: string,
    options: { limit: number; before?: string }
  ): Promise<IMessage[]>;

  /**
   * Thu hồi / xóa mềm tin nhắn (đánh dấu cờ isDeleted và ghi nhận deletedAt)
   * @param messageId ID tin nhắn cần thu hồi
   * @param session ClientSession của Mongoose
   * @returns Tin nhắn đã cập nhật hoặc null
   */
  softDelete(messageId: string, session?: ClientSession): Promise<IMessage | null>;

  /**
   * Đánh dấu toàn bộ tin nhắn chưa đọc trong cuộc trò chuyện thành đã đọc cho người dùng
   * @param conversationId ID cuộc trò chuyện
   * @param userId ID người dùng đang đọc
   * @param session ClientSession của Mongoose
   */
  markAllAsRead(conversationId: string, userId: string, session?: ClientSession): Promise<void>;
}

/**
 * Hiện thực IMessageRepository sử dụng Mongoose ODM
 */
export class MongooseMessageRepository implements IMessageRepository {
  /**
   * Tìm tin nhắn theo ID
   */
  async findById(id: string): Promise<IMessage | null> {
    return MessageModel.findById(id)
      .populate("senderId", "username displayName avatarUrl")
      .populate("replyToMessageId", "content type senderId isDeleted")
      .exec();
  }

  /**
   * Tạo tin nhắn mới kèm đính kèm và tin nhắn trích dẫn (nếu có)
   */
  async create(
    data: {
      conversationId: string;
      senderId: string;
      content?: string;
      type?: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
      attachments?: IAttachment[];
      replyToMessageId?: string | null;
    },
    session?: ClientSession
  ): Promise<IMessage> {
    const payload = {
      conversationId: new Types.ObjectId(data.conversationId),
      senderId: new Types.ObjectId(data.senderId),
      content: data.content,
      type: data.type || "TEXT",
      attachments: data.attachments || [],
      replyToMessageId: data.replyToMessageId ? new Types.ObjectId(data.replyToMessageId) : null,
      readBy: [new Types.ObjectId(data.senderId)],
    };

    const docs = await MessageModel.create([payload], session ? { session } : undefined);
    const message = Array.isArray(docs) ? docs[0] : docs;

    return message.populate("senderId", "username displayName avatarUrl");
  }

  /**
   * Truy vấn danh sách tin nhắn theo conversationId kèm phân trang cursor
   */
  async findByConversationId(
    conversationId: string,
    options: { limit: number; before?: string }
  ): Promise<IMessage[]> {
    const query: Record<string, unknown> = {
      conversationId: new Types.ObjectId(conversationId),
    };

    if (options.before) {
      query.createdAt = { $lt: new Date(options.before) };
    }

    return MessageModel.find(query)
      .populate("senderId", "username displayName avatarUrl")
      .populate("replyToMessageId", "content type senderId isDeleted")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .exec();
  }

  /**
   * Thu hồi tin nhắn (Soft Delete)
   */
  async softDelete(messageId: string, session?: ClientSession): Promise<IMessage | null> {
    return MessageModel.findByIdAndUpdate(
      messageId,
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true, session }
    ).exec();
  }

  /**
   * Đánh dấu đã đọc tất cả tin nhắn trong cuộc trò chuyện bằng thao tác updateMany
   */
  async markAllAsRead(conversationId: string, userId: string, session?: ClientSession): Promise<void> {
    await MessageModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        readBy: { $ne: new Types.ObjectId(userId) },
      },
      {
        $addToSet: { readBy: new Types.ObjectId(userId) },
      },
      { session }
    ).exec();
  }
}

/** Thể hiện mặc định (Singleton) của MongooseMessageRepository */
export const messageRepository = new MongooseMessageRepository();
