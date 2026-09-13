import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  statusMessage?: string;
  role: "USER" | "ADMIN";
  isOnline: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    // Ảnh bìa trang hồ sơ; null = dùng nền mặc định
    bannerUrl: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    statusMessage: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "Hey there! I am using AppMessaging.",
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
    },
    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as { toString(): string }).toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Text index to support fast user searching by username or display name
UserSchema.index({ username: "text", displayName: "text" });

export const UserModel = model<IUser>("User", UserSchema);
