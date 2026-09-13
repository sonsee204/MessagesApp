import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../core/logger";
import { RefreshTokenModel } from "../models/refresh-token.model";

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(env.MONGODB_URI);
    logger.info("Connected successfully to MongoDB");

    // Đảm bảo chỉ mục TTL Index trên RefreshTokenModel được khởi tạo thành công để tự động xóa document hết hạn
    await RefreshTokenModel.init();
    logger.info("MongoDB TTL Indexes initialized successfully for auto-deleting expired documents");
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    if (env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info("Disconnected from MongoDB");
}
