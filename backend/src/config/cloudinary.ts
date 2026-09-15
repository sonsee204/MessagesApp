// Cấu hình Cloudinary: đọc biến môi trường theo yêu cầu (lazy), không fail-fast ở import time.
// Cấm hardcode API_SECRET; thiếu bất kỳ env nào → throw tại thời điểm gọi getCloudinaryConfig().
import "dotenv/config";

// Đọc 1 lần duy nhất khi getCloudinaryConfig() được gọi lần đầu (lazy evaluation).
let cached: { cloudName: string; apiKey: string; apiSecret: string } | null = null;

/**
 * Trả về cấu hình Cloudinary đã xác thực.
 * Chỉ validate tại thời điểm sử dụng (signUpload) để không phá các test integration
 * không thiết lập biến môi trường Cloudinary — tránh fail-fast sai lúc boot app.
 * @throws Error nếu thiếu CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.
 */
export function getCloudinaryConfig(): { cloudName: string; apiKey: string; apiSecret: string } {
  if (cached) return cached;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "[Cloudinary] Thiếu biến môi trường CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET"
    );
  }
  cached = { cloudName, apiKey, apiSecret };
  return cached;
}
