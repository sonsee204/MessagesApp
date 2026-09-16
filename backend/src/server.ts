import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { initSocketServer } from "./socket";
import { logger } from "./core/logger";

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  // Kết nối CSDL TRƯỚC khi khởi tạo Socket.IO:
  // initSocketServer bắn cleanupOrphanCalls() (update các call "ringing" → "missed")
  // ngay lúc boot — nếu DB chưa sẵn sàng thì lệnh phụ thuộc buffer của mongoose,
  // có thể trượt nếu connection timeout. Đổi thứ tự để cleanup chạy trên kết nối thật.
  await connectDatabase();

  // Initialize Socket.IO Server
  initSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info(`AppMessaging Backend server is running on http://localhost:${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      logger.info("HTTP and Database connections closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});
