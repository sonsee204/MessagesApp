import { Schema, model, Document, Types, Model } from "mongoose";

/**
 * Trạng thái của lời mời kết bạn:
 * - PENDING: Đang chờ đối phương phản hồi
 * - ACCEPTED: Đã được chấp nhận thành bạn bè
 * - REJECTED: Bị từ chối bởi người nhận
 * - CANCELED: Bị hủy bởi người gửi
 */
export type FriendRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED";

/**
 * Interface biểu diễn tài liệu Lời mời kết bạn trong MongoDB
 */
export interface IFriendRequest extends Document {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  status: FriendRequestStatus;
  note?: string;
  respondedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const FriendRequestSchema = new Schema<IFriendRequest>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELED"],
      default: "PENDING",
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    respondedAt: {
      type: Date,
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

// Ngăn chặn tạo trùng lặp lời mời kết bạn đang ở trạng thái PENDING giữa cùng 1 người gửi và người nhận
FriendRequestSchema.index(
  { senderId: 1, receiverId: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" } }
);

// Tối ưu hóa truy vấn danh sách lời mời nhận được / đã gửi theo thời gian tạo mới nhất
FriendRequestSchema.index({ receiverId: 1, status: 1, createdAt: -1 });
FriendRequestSchema.index({ senderId: 1, status: 1, createdAt: -1 });

export const FriendRequestModel: Model<IFriendRequest> = model<IFriendRequest>(
  "FriendRequest",
  FriendRequestSchema
);
