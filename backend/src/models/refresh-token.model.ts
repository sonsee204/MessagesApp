import { Schema, model, Document, Types } from "mongoose";

/**
 * Interface biểu diễn cấu trúc bản ghi Refresh Token trong MongoDB
 */
export interface IRefreshToken extends Document {
  // Mã định danh người dùng sở hữu token
  userId: Types.ObjectId | string;
  // Chuỗi băm SHA-256 của Refresh Token (bảo mật, không lưu token thô trong CSDL)
  tokenHash: string;
  // Thời điểm token hết hạn sử dụng (dùng cho TTL index tự động dọn rác)
  expiresAt: Date;
  // Thời điểm tạo bản ghi
  createdAt: Date;
  // Thời điểm cập nhật gần nhất
  updatedAt: Date;
}

/**
 * Schema định nghĩa cấu trúc lưu trữ Refresh Token
 */
const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Thiết lập chỉ mục TTL (Time-To-Live Index) rõ ràng trên trường expiresAt
// MongoDB Background Thread sẽ tự động xóa document này khi thời gian hiện tại vượt quá expiresAt
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Tạo Model từ Schema
export const RefreshTokenModel = model<IRefreshToken>("RefreshToken", RefreshTokenSchema);
