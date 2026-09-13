import path from "path";

/**
 * Cấu hình dùng chung cho toàn bộ luồng tải ảnh lên.
 * Gom về một chỗ để trần dung lượng và hình học từng loại ảnh không bị rải rác
 * giữa middleware, tiện ích xử lý ảnh và controller.
 */

// Thư mục lưu tệp trên đĩa. Cho phép ghi đè qua biến môi trường để test dùng thư mục tạm.
export const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");

// Tiền tố URL công khai. Nằm DƯỚI /api để hưởng proxy sẵn có của Vite (xem spec §2.1),
// nhờ đó ảnh cùng origin với trang và không cần nới CORS.
export const UPLOAD_URL_PREFIX = "/api/uploads";

// Trần dung lượng mỗi tệp: 5MB
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Các định dạng ảnh được chấp nhận. Đây chỉ là lớp LỌC SỚM theo mimetype do client
// khai báo (có thể giả mạo); lớp xác thực thật là sharp ở utils/image-storage.ts.
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Hình học xử lý của từng loại ảnh.
 * - avatar: cắt vuông (cover) để ảnh chân dung không bị méo.
 * - banner: chỉ thu nhỏ khi vượt ngưỡng (inside) để giữ nguyên bố cục ngang.
 */
export const IMAGE_PRESETS = {
  avatar: { width: 256, height: 256, fit: "cover" as const },
  banner: { width: 1200, height: 400, fit: "inside" as const },
} as const;

export type ImageKind = keyof typeof IMAGE_PRESETS;
