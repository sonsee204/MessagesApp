/**
 * Schema validate request ký upload Cloudinary.
 * Shape { body: {...} } tuân thủ convention validate middleware
 * (wrap {body, query, params} rồi parseAsync).
 */
import { z } from "zod";

// Resource type Cloudinary: ảnh / video / file thô.
const resourceTypeEnum = z.enum(["image", "video", "raw"], {
  errorMap: () => ({ message: "resourceType phải là image, video hoặc raw" }),
});

// Folder upload: bắt buộc đúng định dạng `chat/<ObjectId 24 hex>` (spec §3).
// Regex whitelist chặn user tự ý gõ folder lạ → Cloudinary chỉ nhận file đúng conversation.
const folderRegex = /^chat\/[a-f0-9]{24}$/;

/**
 * Schema chính cho POST /api/uploads/sign.
 * Wrap `body` để khớp convention của validate middleware.
 * Dùng `.strict()` ở body để reject field lạ (Zero-Trust).
 */
export const SignUploadSchema = z.object({
  body: z.object({
    resourceType: resourceTypeEnum,
    folder: z
      .string()
      .regex(folderRegex, "Folder phải có dạng chat/<ObjectId>"),
  }).strict(),
});

// Kiểu dữ liệu trích từ body (controller dùng để truyền vào service).
export type SignUploadDTO = z.infer<typeof SignUploadSchema>["body"];
