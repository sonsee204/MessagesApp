import { Schema, model, Document, Types } from "mongoose";

/**
 * Các nền tảng thiết bị hỗ trợ nhận thông báo đẩy (Push Notifications):
 * - web: Trình duyệt Web (Web Push API)
 * - android: Thiết bị Android (Firebase Cloud Messaging)
 * - ios: Thiết bị iOS (APNs / Firebase Cloud Messaging)
 */
export type DevicePlatform = "web" | "android" | "ios";

/**
 * Interface đại diện cho bản ghi mã định danh thiết bị (Device Token) trong MongoDB
 */
export interface IDeviceToken extends Document {
  /** ID người dùng sở hữu thiết bị */
  userId: Types.ObjectId;
  /** Nền tảng thiết bị (web, android, ios) */
  platform: DevicePlatform;
  /** Chuỗi token định danh thiết bị duy nhất do FCM hoặc APNs cấp */
  token: string;
  /** Thời điểm đăng ký token */
  createdAt: Date;
  /** Thời điểm cập nhật token gần nhất */
  updatedAt: Date;
}

/**
 * Mongoose Schema định nghĩa cấu trúc lưu trữ mã token thiết bị (device_tokens)
 */
const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["web", "android", "ios"],
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
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

/**
 * Mongoose Model cho DeviceToken
 */
export const DeviceTokenModel = model<IDeviceToken>("DeviceToken", DeviceTokenSchema);
