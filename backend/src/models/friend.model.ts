import { Schema, model, Document, Types, Model } from "mongoose";

/**
 * Interface biểu diễn tài liệu Quan hệ bạn bè trong MongoDB
 * Lưu ý kiến trúc: Để tránh lưu 2 bản ghi trùng lặp cho quan hệ 2 chiều,
 * luôn quy ước userA < userB theo thứ tự chuỗi hex ObjectId.
 */
export interface IFriend extends Document {
  userA: Types.ObjectId;
  userB: Types.ObjectId;
  friendRequestId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chuẩn hóa cặp ID người dùng để luôn đảm bảo userA < userB theo thứ tự từ điển,
 * giúp truy vấn quan hệ hai chiều chỉ cần 1 bản ghi duy nhất trong cơ sở dữ liệu.
 */
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

// Đảm bảo tính duy nhất của cặp bạn bè hai chiều (userA, userB)
FriendSchema.index({ userA: 1, userB: 1 }, { unique: true });

// Đánh index tối ưu hóa truy vấn danh sách bạn bè theo từng người dùng sắp xếp theo thời gian kết bạn
FriendSchema.index({ userA: 1, createdAt: -1 });
FriendSchema.index({ userB: 1, createdAt: -1 });

export const FriendModel: Model<IFriend> = model<IFriend>("Friend", FriendSchema);
