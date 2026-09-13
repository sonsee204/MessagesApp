import { Schema, model, Document, Types } from "mongoose";

export interface IConversation extends Document {
  title?: string;
  type: "DIRECT" | "GROUP";
  participants: Types.ObjectId[];
  lastMessage?: Types.ObjectId;
  lastMessageAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    title: {
      type: String,
      trim: true,
      default: null,
    },
    type: {
      type: String,
      enum: ["DIRECT", "GROUP"],
      default: "DIRECT",
      required: true,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as { toString(): string }).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for listing user's conversations sorted by lastMessageAt
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const ConversationModel = model<IConversation>("Conversation", ConversationSchema);
