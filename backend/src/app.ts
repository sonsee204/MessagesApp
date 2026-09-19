import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { notFoundHandler } from "./middlewares/not-found";
import { errorHandler } from "./middlewares/error-handler";
import { csrfOriginGuard, isDevTunnelOrigin } from "./middlewares/csrf";
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from "./config/upload";

/**
 * Khởi tạo và cấu hình ứng dụng Express với đầy đủ Middleware bảo mật, Cookie Parser và Routing
 */
export function createApp(): Express {
  const app = express();

  // Tin cậy 1 proxy đứng trước (vite dev server / cloudflared tunnel) để đọc đúng
  // X-Forwarded-For. Nếu không, express-rate-limit báo lỗi ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
  // và rate-limit tính theo IP proxy (127.0.0.1) thay vì IP người dùng thật.
  // CHỈ bật ngoài production: nếu app chạy trực tiếp mà tin X-Forwarded-For thì client
  // có thể gửi header giả để bypass rate-limit (IP spoofing).
  app.set("trust proxy", env.NODE_ENV === "production" ? false : 1);

  // Middleware bảo mật HTTP Headers với Helmet
  app.use(helmet());

  // Middleware cấu hình CORS cho phép gửi nhận cookie qua credentials
  // Callback origin: ngoài CORS_ORIGIN cấu hình, DEV còn chấp nhận origin tunnel
  // (cloudflared/ngrok/loca.lt) để test trên điện thoại; production giữ whitelist cứng.
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origin === env.CORS_ORIGIN || isDevTunnelOrigin(origin)) {
          return callback(null, true);
        }
        callback(null, false);
      },
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

  // Phục vụ ảnh đã tải lên. Nằm DƯỚI tiền tố /api nên đi qua proxy sẵn có của Vite
  // -> ảnh cùng origin với trang, không cần nới CORS (xem spec §2.1).
  // helmet() mặc định gắn Cross-Origin-Resource-Policy: same-origin; gỡ rào cho
  // RIÊNG mount này để ảnh vẫn xem được khi client gọi thẳng BE:5000 không qua proxy.
  app.use(
    UPLOAD_URL_PREFIX,
    express.static(UPLOAD_DIR, {
      setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
      // Tên tệp chứa phần ngẫu nhiên nên nội dung đổi là URL đổi -> cache vĩnh viễn an toàn
      maxAge: "1y",
      immutable: true,
    })
  );

  // Đăng ký toàn bộ tuyến đường API tại tiền tố /api
  app.use("/api", apiRouter);

  // Xử lý tuyến đường không tồn tại (404 Not Found)
  app.use(notFoundHandler);

  // Xử lý lỗi tập trung toàn hệ thống (Global Error Handler)
  app.use(errorHandler);

  return app;
}
