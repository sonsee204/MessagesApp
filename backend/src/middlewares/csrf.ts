import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { logger } from "../core/logger";

/**
 * Danh sách các phương thức HTTP có thể làm thay đổi trạng thái (State-changing methods)
 */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Middleware phòng chống tấn công Cross-Site Request Forgery (CSRF Origin Guard)
 * 1. Kiểm tra các request sử dụng phương thức thay đổi trạng thái (POST/PUT/DELETE)
 * 2. Đối chiếu header 'Origin' hoặc 'Referer' với CORS_ORIGIN được cấp phép
 * 3. Ngăn chặn kẻ tấn công từ trang web độc hại bí mật gửi request kèm theo Cookie nạn nhân
 */
export function csrfOriginGuard(req: Request, res: Response, next: NextFunction): void {
  // Chỉ kiểm tra các phương thức thay đổi trạng thái
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  // Lấy giá trị Origin từ request headers
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;

  // Trong môi trường test hoặc khi không có Origin/Referer (ví dụ cURL, Postman, Mobile App gọi API trực tiếp)
  if (!originHeader && !refererHeader) {
    return next();
  }

  // Chuẩn hóa danh sách các Origin được cho phép
  const allowedOrigins = [
    env.CORS_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
  ];

  // Trích xuất hostname từ Origin hoặc Referer
  let requestOrigin = originHeader;
  if (!requestOrigin && refererHeader) {
    try {
      const parsedUrl = new URL(refererHeader);
      requestOrigin = `${parsedUrl.protocol}//${parsedUrl.host}`;
    } catch (_err) {
      requestOrigin = undefined;
    }
  }

  // Kiểm tra xem Origin của request có nằm trong danh sách an toàn không
  if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
    const code = "CSRF_ORIGIN_FORBIDDEN";
    const message = "Yêu cầu bị từ chối do vi phạm chính sách bảo mật CSRF Origin";

    logger.logError({
      code,
      statusCode: 403,
      message,
      method: req.method,
      path: req.originalUrl || req.url,
      ip: req.ip,
      details: [{ field: "origin", value: requestOrigin }],
    });

    res.status(403).json({
      success: false,
      error: {
        code,
        message,
        details: [`Origin không hợp lệ: ${requestOrigin}`],
      },
    });
    return;
  }

  next();
}
