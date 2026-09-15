import { z } from "zod";

// Schema xác thực yêu cầu ký upload (Zero-Trust).
// Chỉ chấp nhận 3 loại resource Cloudinary: image / video / raw (file).
// folder bắt buộc khớp whitelist: chỉ được upload vào thư mục chat/<ObjectId>,
// ngăn chặn upload vào thư mục avatar/banner hay bất kỳ path nào khác.
// .strict() chặn Mass Assignment — từ chối mọi field không khai báo.
export const SignUploadSchema = z
  .object({
    resourceType: z.enum(["image", "video", "raw"]),
    folder: z.string().regex(/^chat\/[a-f0-9]{24}$/, "Folder phải có dạng chat/<ObjectId>"),
  })
  .strict();

export type SignUploadDTO = z.infer<typeof SignUploadSchema>;
