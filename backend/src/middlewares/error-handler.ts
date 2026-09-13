import { Request, Response, NextFunction } from "express";
import { AppError } from "../core/errors";
import { logger } from "../core/logger";
import { env } from "../config/env";
import { MAX_FILE_SIZE } from "../config/upload";

/**
 * Middleware xử lý lỗi tập trung toàn hệ thống (Global Error Handler)
 * Bắt tất cả các loại ngoại lệ, trích xuất mã lỗi, ghi log tường minh ra console và trả JSON chuẩn hóa
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const method = req.method;
  const path = req.originalUrl || req.url;
  const ip = req.ip;

  // 1. Xử lý các lỗi nghiệp vụ chủ động ném ra từ hệ thống (AppError)
  if (err instanceof AppError) {
    // Bắt và in chi tiết mã lỗi, mã trạng thái và thông điệp tường minh ra log
    logger.logError({
      code: err.code,
      statusCode: err.statusCode,
      message: err.message,
      method,
      path,
      details: err.details,
      ip,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // 2. Xử lý lỗi cú pháp JSON do client gửi body không đúng định dạng JSON
  if (err instanceof SyntaxError && "status" in err && (err as { status: number }).status === 400 && "body" in err) {
    const code = "INVALID_JSON_SYNTAX";
    const message = "Định dạng chuỗi JSON trong request body không hợp lệ";

    logger.logError({
      code,
      statusCode: 400,
      message,
      method,
      path,
      details: [err.message],
      ip,
    });

    res.status(400).json({
      success: false,
      error: {
        code,
        message,
        details: [err.message],
      },
    });
    return;
  }

  // 3. Xử lý lỗi Mongoose CastError (ví dụ ID MongoDB không đúng định dạng ObjectId 24 ký tự)
  if (err.name === "CastError") {
    const code = "INVALID_IDENTIFIER";
    const castErr = err as unknown as { path: string; value: unknown };
    const message = `Mã định danh không hợp lệ cho trường [${castErr.path}]: '${castErr.value}'`;

    logger.logError({
      code,
      statusCode: 400,
      message,
      method,
      path,
      ip,
    });

    res.status(400).json({
      success: false,
      error: {
        code,
        message,
        details: [],
      },
    });
    return;
  }

  // 4b. Xử lý lỗi tải tệp do multer ném ra.
  // LƯU Ý: MulterError dùng `code` dạng CHUỖI (ví dụ "LIMIT_FILE_SIZE"), không phải
  // mã số 11000 của MongoDB, nên không khớp nhánh nào phía trên. Nếu thiếu nhánh này,
  // tệp quá lớn sẽ bị báo thành lỗi 500 "sự cố nội bộ" thay vì thông báo đúng nguyên nhân.
  // Dùng err.name thay vì instanceof để không phải import multer vào tầng xử lý lỗi.
  if (err.name === "MulterError") {
    const multerErr = err as unknown as { code: string };

    // Ánh xạ mã lỗi multer sang thông điệp tiếng Việt dễ hiểu cho người dùng cuối
    const MULTER_MESSAGES: Record<string, string> = {
      LIMIT_FILE_SIZE: `Tệp vượt quá dung lượng cho phép (tối đa ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
      LIMIT_UNEXPECTED_FILE: "Tên trường tệp không hợp lệ, chỉ chấp nhận trường 'file'",
      LIMIT_FILE_COUNT: "Chỉ được tải lên một tệp mỗi lần",
    };
    const message = MULTER_MESSAGES[multerErr.code] ?? "Tệp tải lên không hợp lệ";

    logger.logError({
      code: multerErr.code,
      statusCode: 400,
      message,
      method,
      path,
      ip,
    });

    res.status(400).json({
      success: false,
      error: {
        code: multerErr.code,
        message,
        details: [],
      },
    });
    return;
  }

  // 4. Xử lý lỗi trùng lặp khóa duy nhất trong MongoDB (E11000 duplicate key error)
  if ("code" in err && (err as { code: number }).code === 11000) {
    const code = "DUPLICATE_KEY_CONFLICT";
    const mongoErr = err as unknown as { keyPattern?: Record<string, number> };
    const fields = mongoErr.keyPattern ? Object.keys(mongoErr.keyPattern).join(", ") : "trường dữ liệu";
    const message = `Dữ liệu bị trùng lặp ở trường: [${fields}]`;

    logger.logError({
      code,
      statusCode: 409,
      message,
      method,
      path,
      ip,
    });

    res.status(409).json({
      success: false,
      error: {
        code,
        message,
        details: [],
      },
    });
    return;
  }

  // 5. Xử lý các lỗi hệ thống không xác định (Unhandled Internal Errors)
  const fallbackCode = "INTERNAL_SERVER_ERROR";
  const fallbackMessage = "Đã xảy ra sự cố nội bộ hệ thống. Vui lòng thử lại sau.";

  // Bắt và ghi log mã lỗi 500 kèm dấu vết ngăn xếp (Stack trace) đầy đủ
  logger.logError({
    code: fallbackCode,
    statusCode: 500,
    message: `${fallbackMessage} - Nguyên nhân gốc: ${err.message}`,
    method,
    path,
    stack: err.stack,
    ip,
  });

  res.status(500).json({
    success: false,
    error: {
      code: fallbackCode,
      message: fallbackMessage,
      details: env.NODE_ENV === "development" ? [err.message] : [],
    },
  });
}
