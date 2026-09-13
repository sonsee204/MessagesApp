import { Schema, model, Document, Types, Model } from "mongoose";

export interface IAttachment {
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content?: string;
  type: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
  attachments: IAttachment[];
  replyToMessageId?: Types.ObjectId | null;
  readBy: Types.ObjectId[];
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    mimeType: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 5000,
      required: [
        function (this: IMessage) {
          const hasAttachments = Array.isArray(this.attachments) && this.attachments.length > 0;
          return !hasAttachments;
        },
        "Nội dung tin nhắn không được để trống khi không có tệp đính kèm",
      ],
    },
    type: {
      type: String,
      enum: ["TEXT", "IMAGE", "FILE", "SYSTEM"],
      default: "TEXT",
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },
    replyToMessageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        // Tách thông tin người gửi khi trường `senderId` đã được populate:
        // - `senderId` luôn trả về dạng CHUỖI ID (đúng hợp đồng Frontend để so sánh `senderId === currentUserId`)
        // - toàn bộ document User được chuyển sang trường `sender` (phục vụ hiển thị tên/avatar)
        // Nếu không tách, `senderId` sẽ là một object và mọi so sánh phía client đều sai âm thầm.
        const populatedSender = ret.senderId as Record<string, unknown> | null | undefined;
        // ObjectId thô cũng là "object", nên phải loại trừ tường minh — nếu không
        // trường `sender` sẽ bị gán nhầm bằng chính ObjectId rác.
        if (populatedSender && typeof populatedSender === "object" && !(populatedSender instanceof Types.ObjectId)) {
          ret.senderId = (populatedSender._id ?? populatedSender.id)?.toString();
          ret.sender = populatedSender;
        }

        ret.id = (ret._id as { toString(): string }).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for cursor-based pagination per conversation
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, readBy: 1 });

export const MessageModel: Model<IMessage> = model<IMessage>("Message", MessageSchema);
