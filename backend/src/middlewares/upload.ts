import multer from "multer";
import { ALLOWED_MIME, MAX_FILE_SIZE } from "../config/upload";
import { ValidationError } from "../core/errors";

/**
 * Middleware tải tệp lên dùng chung cho cả ảnh đại diện và ảnh bìa.
 *
 * Dùng memoryStorage: giữ tệp trong RAM để chuyển thẳng cho sharp xử lý.
 * Nhờ trần 5MB nên không có rủi ro tràn bộ nhớ, đổi lại tránh được việc ghi
 * tệp rác xuống đĩa rồi phải dọn khi ảnh không giải mã được.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Lớp 1 (rẻ, phản hồi nhanh): từ chối sớm theo mimetype do client khai báo.
    // Giá trị này KHÔNG đáng tin — lớp xác thực thật là sharp, sẽ ném lỗi
    // khi tệp không giải mã được thành ảnh.
    if (!ALLOWED_MIME.includes(file.mimetype as (typeof ALLOWED_MIME)[number])) {
      return cb(new ValidationError("Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP"));
    }
    cb(null, true);
  },
});
