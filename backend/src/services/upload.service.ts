import crypto from "node:crypto";
import { CLOUDINARY } from "../config/cloudinary";
import { conversationRepository } from "../repositories/conversation.repository";
import { ForbiddenError, NotFoundError } from "../core/errors";
import type { SignUploadDTO } from "../schemas/upload.schema";

// Giới hạn kích thước theo từng loại resource (bytes) — nhúng vào signature
// để Cloudinary từ chối file quá cỡ ở tầng storage (FE bypass cũng vô ích).
const MAX_SIZE: Record<SignUploadDTO["resourceType"], number> = {
  image: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024, // 50MB
  raw: 25 * 1024 * 1024, // 25MB
};

export interface SignedParams {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  resourceType: SignUploadDTO["resourceType"];
  maxFileSize: number;
  signature: string;
}

/**
 * Ký tham số upload cho Cloudinary (Signed Direct Upload).
 * @param userId - ID người gọi, dùng để check membership conversation.
 * @param dto - { resourceType, folder } đã qua validate (Zero-Trust).
 * @returns Tham số đã ký sẵn để FE upload thẳng lên Cloudinary.
 * @throws NotFoundError nếu conversation không tồn tại.
 * @throws ForbiddenError nếu user không nằm trong participants.
 */
export async function signUpload(userId: string, dto: SignUploadDTO): Promise<SignedParams> {
  // Bước 1: Lấy conversation từ folder (ObjectId nằm sau "chat/").
  const conversationId = dto.folder.split("/")[1];
  const conversation = await conversationRepository.findById(conversationId);
  if (!conversation) {
    throw new NotFoundError("Không tìm thấy cuộc trò chuyện");
  }

  // Bước 2: Chỉ thành viên mới được upload vào thư mục chat này (Zero-Trust).
  const isMember = conversation.participants.some(
    (p: unknown) => (p?.toString?.() ?? String(p)) === userId
  );
  if (!isMember) {
    throw new ForbiddenError("Bạn không phải thành viên của cuộc trò chuyện này");
  }

  // Bước 3: Sinh timestamp + max_file_size, ký SHA-1 theo thứ tự key tăng dần
  // (Cloudinary yêu cầu params được sort trước khi hash).
  const timestamp = Math.floor(Date.now() / 1000);
  const maxFileSize = MAX_SIZE[dto.resourceType];
  const paramsToSign = {
    folder: dto.folder,
    max_file_size: maxFileSize,
    resource_type: dto.resourceType,
    timestamp,
  };
  const sorted = Object.keys(paramsToSign)
    .sort()
    .map((k) => `${k}=${paramsToSign[k as keyof typeof paramsToSign]}`)
    .join("&");
  const signature = crypto.createHash("sha1").update(sorted + CLOUDINARY.apiSecret).digest("hex");

  return {
    cloudName: CLOUDINARY.cloudName,
    apiKey: CLOUDINARY.apiKey,
    timestamp,
    folder: dto.folder,
    resourceType: dto.resourceType,
    maxFileSize,
    signature,
  };
}
