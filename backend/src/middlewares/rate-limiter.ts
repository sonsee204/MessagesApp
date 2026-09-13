import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { logger } from "../core/logger";
import { env } from "../config/env";

/**
 * Middleware giới hạn tần suất yêu cầu đăng nhập (Login Rate Limiter)
 * Ngăn chặn tấn công dò quét mật khẩu tự động (Brute-Force Attack)
 * - Cửa sổ thời gian: 15 phút (15 * 60 * 1000 ms)
 * - Số lượt thử tối đa: 10 lần trên một địa chỉ IP (hoặc 100 lần khi chạy unit test)
 * - Khi vượt ngưỡng: Trả về mã lỗi HTTP 429 TOO_MANY_REQUESTS và ghi log tường minh
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: env.NODE_ENV === "test" ? 100 : 10, // Giới hạn lượt thử
  standardHeaders: true, // Trả về thông tin rate limit trong headers `RateLimit-*`
  legacyHeaders: false, // Vô hiệu hóa headers cũ `X-RateLimit-*`
  handler: (req: Request, res: Response) => {
    const code = "TOO_MANY_REQUESTS";
    const message = "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút để bảo vệ tài khoản.";

    // Bắt và ghi log mã lỗi 429 tường minh
    logger.logError({
      code,
      statusCode: 429,
      message,
      method: req.method,
      path: req.originalUrl || req.url,
      ip: req.ip,
    });

    res.status(429).json({
      success: false,
      error: {
        code,
        message,
        details: [],
      },
    });
  },
});
