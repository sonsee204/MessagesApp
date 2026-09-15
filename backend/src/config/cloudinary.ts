// Cấu hình Cloudinary: đọc biến môi trường một lần duy nhất lúc boot.
// Cấm hardcode API_SECRET; thiếu bất kỳ env nào → throw để app fail-fast,
// tránh tình trạng server chạy được nhưng mọi request ký upload đều lỗi ngầm.
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    "[Cloudinary] Thiếu biến môi trường CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET"
  );
}

// Đối tượng cấu hình dùng chung cho toàn bộ tầng Service khi ký signature.
// KHÔNG chứa logic upload — chỉ metadata + secret cần thiết để tạo SHA-1 signature.
export const CLOUDINARY = {
  cloudName,
  apiKey,
  apiSecret,
} as const;
