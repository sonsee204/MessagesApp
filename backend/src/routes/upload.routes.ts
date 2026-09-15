import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { validate } from "../middlewares/validate";
import { requireAuth } from "../middlewares/auth";
import { SignUploadSchema } from "../schemas/upload.schema";

const router = Router();

// Chặn requireAuth trên đúng route cần bảo vệ (/sign) thay vì toàn bộ prefix /uploads
// để express.static (phục vụ ảnh local) không bị 401 khi GET /uploads/<file> không có token.

/**
 * [POST /api/uploads/sign]
 * Cấp chữ ký upload Cloudinary cho 1 file (image/video/raw).
 * Body: { resourceType: 'image'|'video'|'raw', folder: 'chat/<ObjectId>' }.
 * 200 OK: { success: true, data: SignedParams }
 */
router.post("/sign", requireAuth, validate(SignUploadSchema), uploadController.sign);

export const uploadRoutes = router;
