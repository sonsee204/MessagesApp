import { Request, Response, NextFunction } from "express";
import { signUpload } from "../services/upload.service";
import type { SignUploadDTO } from "../schemas/upload.schema";

/**
 * Controller tiếp nhận yêu cầu ký upload Cloudinary.
 * Tuân thủ Layered Architecture: trích xuất dữ liệu từ request, gọi Service,
 * trả JSON chuẩn. KHÔNG chứa logic ký hoặc kiểm tra membership.
 */
export const uploadController = {
  /**
   * [POST /api/uploads/sign]
   * Cấp chữ ký upload Cloudinary cho 1 file (image/video/raw).
   * Phản hồi HTTP 200 OK kèm tham số đã ký, FE dùng để upload thẳng lên Cloudinary.
   * @throws 400 VALIDATION_ERROR nếu body không hợp lệ (qua validate middleware).
   * @throws 403 FORBIDDEN nếu user không phải thành viên conversation.
   * @throws 404 NOT_FOUND nếu conversation không tồn tại.
   */
  async sign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // req.user.userId được gán bởi requireAuth middleware
      const userId = req.user!.userId;
      const dto = req.body as SignUploadDTO;

      // Ký tham số upload: kiểm tra membership + sinh SHA-1 signature
      const data = await signUpload(userId, dto);

      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
