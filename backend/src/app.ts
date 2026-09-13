import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { notFoundHandler } from "./middlewares/not-found";
import { errorHandler } from "./middlewares/error-handler";
import { csrfOriginGuard } from "./middlewares/csrf";

/**
 * Khởi tạo và cấu hình ứng dụng Express với đầy đủ Middleware bảo mật, Cookie Parser và Routing
 */
export function createApp(): Express {
  const app = express();

  // Middleware bảo mật HTTP Headers với Helmet
  app.use(helmet());

  // Middleware cấu hình CORS cho phép gửi nhận cookie qua credentials
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // Middleware phân tích cú pháp Cookies với chữ ký bảo mật HMAC-SHA256 (phòng chống Cookie Tampering & Forgery)
  app.use(cookieParser(env.COOKIE_SECRET));

  // Middleware phòng chống tấn công Cross-Site Request Forgery (CSRF Origin Guard)
  app.use(csrfOriginGuard);

  // Middleware phân tích cú pháp JSON và URL-encoded body
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Đăng ký toàn bộ tuyến đường API tại tiền tố /api
  app.use("/api", apiRouter);

  // Xử lý tuyến đường không tồn tại (404 Not Found)
  app.use(notFoundHandler);

  // Xử lý lỗi tập trung toàn hệ thống (Global Error Handler)
  app.use(errorHandler);

  return app;
}
