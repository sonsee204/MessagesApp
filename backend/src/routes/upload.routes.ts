import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { validate } from "../middlewares/validate";
import { requireAuth } from "../middlewares/auth";
import { SignUploadSchema } from "../schemas/upload.schema";

const router = Router();

// Mọi tuyến upload đều yêu cầu JWT hợp lệ (Zero-Trust: không ai gọi thẳng API ký mà chưa đăng nhập).
router.use(requireAuth);

/**
 * [POST /api/uploads/sign]
 * Cấp chữ ký upload Cloudinary cho 1 file (image/video/raw).
 * Body: { resourceType: 'image'|'video'|'raw', folder: 'chat/<ObjectId>' }.
 * 200 OK: { success: true, data: SignedParams }
 */
router.post("/sign", validate(SignUploadSchema), uploadController.sign);

export const uploadRoutes = router;
