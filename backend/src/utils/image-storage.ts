import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { IMAGE_PRESETS, ImageKind, UPLOAD_DIR, UPLOAD_URL_PREFIX } from "../config/upload";
import { ValidationError } from "../core/errors";
import { logger } from "../core/logger";

/**
 * Xử lý ảnh tải lên và lưu xuống đĩa, trả về URL công khai để lưu vào CSDL.
 *
 * sharp vừa resize/nén vừa đóng vai trò lớp XÁC THỰC THẬT SỰ: mimetype do client
 * khai báo có thể giả mạo, nhưng một tệp không giải mã được thành ảnh sẽ khiến
 * sharp ném lỗi — đó mới là bằng chứng đáng tin.
 *
 * @param buffer Nội dung tệp gốc trong RAM (multer memoryStorage cung cấp)
 * @param kind Loại ảnh, quyết định hình học xử lý
 * @param userId ID người dùng, dùng để đặt tên tệp dễ truy vết
 * @returns URL công khai dạng "/api/uploads/<tên tệp>.webp"
 */
export async function saveImage(buffer: Buffer, kind: ImageKind, userId: string): Promise<string> {
  const preset = IMAGE_PRESETS[kind];

  let processed: Buffer;
  try {
    processed = await sharp(buffer)
      .resize(preset.width, preset.height, {
        fit: preset.fit,
        // Không phóng to ảnh nhỏ hơn ngưỡng — phóng to chỉ làm mờ mà không thêm chi tiết
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    // Không giải mã được thành ảnh => tệp không phải ảnh hợp lệ (dù đuôi/mimetype có thể đã giả)
    throw new ValidationError("Tệp tải lên không phải là ảnh hợp lệ hoặc đã bị hỏng");
  }

  // Phần ngẫu nhiên khiến URL ĐỔI mỗi lần thay ảnh. Nhờ đó có thể đặt cache
  // `immutable` ở tầng phục vụ tĩnh mà trình duyệt vẫn lấy được ảnh mới.
  const suffix = crypto.randomBytes(4).toString("hex");
  const fileName = `${kind}-${userId}-${suffix}.webp`;

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), processed);

  return `${UPLOAD_URL_PREFIX}/${fileName}`;
}

/**
 * Xoá tệp ứng với một URL công khai đã lưu trong CSDL.
 *
 * Hàm này KHÔNG BAO GIỜ ném lỗi ra ngoài: nó chạy sau khi thao tác ghi CSDL đã
 * thành công, nên làm hỏng request chỉ vì không dọn được tệp cũ là cái giá quá đắt.
 * Trường hợp xấu nhất là còn lại một tệp rác — chấp nhận được.
 *
 * @param url URL công khai của tệp cần xoá; bỏ qua nếu rỗng hoặc không thuộc thư mục uploads
 */
export async function deleteImageByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;

  // Chốt an toàn: chỉ xử lý URL do chính hệ thống sinh ra. Nếu URL không bắt đầu
  // bằng tiền tố công khai, đó không phải tệp của chúng ta -> không được chạm vào.
  if (!url.startsWith(`${UPLOAD_URL_PREFIX}/`)) return;

  // Lấy đúng tên tệp, loại bỏ mọi thành phần đường dẫn để không thể thoát khỏi UPLOAD_DIR
  const fileName = path.basename(url.slice(UPLOAD_URL_PREFIX.length + 1));
  if (!fileName) return;

  try {
    await fs.unlink(path.join(UPLOAD_DIR, fileName));
  } catch (error) {
    // Chỉ ghi log: tệp có thể đã bị xoá trước đó hoặc không tồn tại. Không làm hỏng request.
    logger.warn(`Không xoá được tệp ảnh cũ: ${fileName}`, error);
  }
}
