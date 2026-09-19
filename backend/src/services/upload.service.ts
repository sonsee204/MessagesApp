import crypto from "node:crypto";
import { getCloudinaryConfig } from "../config/cloudinary";
import { conversationRepository } from "../repositories/conversation.repository";
import { ForbiddenError, NotFoundError } from "../core/errors";
import { isParticipant } from "../utils/participant.util";
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
  // participants đã được populate thành User document (có _id), nên dùng isParticipant
  // chuẩn hoá về chuỗi ID trước khi so sánh — tránh lỗi so sánh ObjectId.toString() != userId.
  const isMember = isParticipant(conversation.participants as unknown[], userId);
  if (!isMember) {
    throw new ForbiddenError("Bạn không phải thành viên của cuộc trò chuyện này");
  }

  // Bước 3: Sinh timestamp + chữ ký SHA-1 theo Cloudinary.
  // QUAN TRỌNG: Cloudinary CHỈ ký trên tập tham số thuộc whitelist của nó.
  // `resource_type` nằm ở URL path (/v1_1/<cloud>/<type>/upload) và `max_file_size`
  // là tham số kỹ thuật — CẢ HAI đều KHÔNG được Cloudinary đưa vào chuỗi ký.
  // Nếu gộp chúng vào signature, chuỗi ký của BE sẽ lệch với chuỗi Cloudinary tự dựng
  // (chỉ gồm folder + timestamp) → lỗi "Invalid Signature".
  // Lấy config Cloudinary lazily — chỉ throw nếu env chưa set khi thực sự cần ký.
  const cloudinary = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const maxFileSize = MAX_SIZE[dto.resourceType];
  // Chuỗi ký chỉ gồm đúng 2 tham số được whitelist, sắp xếp theo key tăng dần.
  const paramsToSign = {
    folder: dto.folder,
    timestamp,
  };
  const sorted = Object.keys(paramsToSign)
    .sort()
    .map((k) => `${k}=${paramsToSign[k as keyof typeof paramsToSign]}`)
    .join("&");
  const signature = crypto.createHash("sha1").update(sorted + cloudinary.apiSecret).digest("hex");

  return {
    cloudName: cloudinary.cloudName,
    apiKey: cloudinary.apiKey,
    timestamp,
    folder: dto.folder,
    resourceType: dto.resourceType,
    maxFileSize,
    signature,
  };
}
