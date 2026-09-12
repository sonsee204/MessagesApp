import { Schema, model, Document, Types, Model } from "mongoose";

export interface IFriend extends Document {
  userA: Types.ObjectId;
  userB: Types.ObjectId;
  friendRequestId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export function normalizeFriendIds(
  id1: Types.ObjectId | string,
  id2: Types.ObjectId | string
): [Types.ObjectId, Types.ObjectId] {
  const s1 = id1.toString();
  const s2 = id2.toString();

  if (s1 === s2) {
    throw new Error("Không thể tạo quan hệ bạn bè với chính mình");
  }

  const objId1 = typeof id1 === "string" ? new Types.ObjectId(id1) : id1;
  const objId2 = typeof id2 === "string" ? new Types.ObjectId(id2) : id2;

  return s1.localeCompare(s2) < 0 ? [objId1, objId2] : [objId2, objId1];
}

const FriendSchema = new Schema<IFriend>(
  {
    userA: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userB: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    friendRequestId: {
      type: Schema.Types.ObjectId,
      ref: "FriendRequest",
      default: null,
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

// Ensure unique bidirectional friendship pair
FriendSchema.index({ userA: 1, userB: 1 }, { unique: true });

// Query indexes for listing friends for a user
FriendSchema.index({ userA: 1, createdAt: -1 });
FriendSchema.index({ userB: 1, createdAt: -1 });

export const FriendModel: Model<IFriend> = model<IFriend>("Friend", FriendSchema);
