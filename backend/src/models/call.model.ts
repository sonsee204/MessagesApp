import { Schema, model, Document, Types } from "mongoose";

/**
 * Các loại cuộc gọi được hỗ trợ:
 * - audio: Cuộc gọi thoại (thoại thuần túy qua WebRTC)
 * - video: Cuộc gọi video (thoại kèm luồng hình ảnh camera)
 */
export type CallType = "audio" | "video";

/**
 * Trạng thái vòng đời của một cuộc gọi:
 * - ringing: Đang đổ chuông, chờ người nhận nhấc máy
 * - answered: Người nhận đã nhấc máy và kết nối đàm thoại
 * - missed: Cuộc gọi nhỡ (người nhận không nhấc máy / hết thời gian chờ)
 * - declined: Người nhận chủ động từ chối cuộc gọi
 * - ended: Cuộc gọi đã kết thúc bình thường sau khi đàm thoại
 */
export type CallStatus = "ringing" | "answered" | "missed" | "declined" | "ended";

/**
 * Interface đại diện cho tài liệu Cuộc gọi (Call) trong CSDL MongoDB
 */
export interface ICall extends Document {
  /** ID cuộc hội thoại liên quan (DIRECT conversation) */
  conversationId: Types.ObjectId;
  /** ID người khởi tạo cuộc gọi */
  callerId: Types.ObjectId;
  /** ID người nhận cuộc gọi */
  calleeId: Types.ObjectId;
  /** Loại cuộc gọi: thoại (audio) hoặc hình ảnh (video) */
  type: CallType;
  /** Trạng thái hiện tại của cuộc gọi */
  status: CallStatus;
  /** Thời điểm người gọi bắt đầu bấm máy */
  startedAt: Date;
  /** Thời điểm người nhận bắt máy (null nếu chưa nghe máy hoặc từ chối) */
  answeredAt?: Date | null;
  /** Thời điểm cuộc gọi kết thúc (null nếu đang diễn ra hoặc chưa kết nối) */
  endedAt?: Date | null;
  /** Thời lượng đàm thoại tính bằng giây (null nếu không kết nối thành công) */
  durationSec?: number | null;
  /** Thời điểm tạo bản ghi */
  createdAt: Date;
  /** Thời điểm cập nhật bản ghi gần nhất */
  updatedAt: Date;
}

/**
 * Mongoose Schema định nghĩa cấu trúc bảng cuộc gọi (calls)
 */
const CallSchema = new Schema<ICall>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    callerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    calleeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    status: {
      type: String,
      enum: ["ringing", "answered", "missed", "declined", "ended"],
      default: "ringing",
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSec: {
      type: Number,
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

// Compound Index: Tối ưu hóa truy vấn lịch sử cuộc gọi theo người gọi giảm dần theo thời gian
CallSchema.index({ callerId: 1, startedAt: -1 });

// Compound Index: Tối ưu hóa truy vấn lịch sử cuộc gọi theo người nhận giảm dần theo thời gian
CallSchema.index({ calleeId: 1, startedAt: -1 });

// Partial Index: Chỉ lập chỉ mục cho các cuộc gọi đang ở trạng thái 'ringing' để lọc nhanh cuộc gọi đang chờ
CallSchema.index({ status: 1 }, { partialFilterExpression: { status: "ringing" } });

/**
 * Mongoose Model cho Call
 */
export const CallModel = model<ICall>("Call", CallSchema);
