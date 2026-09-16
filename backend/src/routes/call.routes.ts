import { Router } from "express";
import { callController } from "../controllers/call.controller";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import {
  CallHistoryQuerySchema,
  DeviceTokenBodySchema,
  DeleteDeviceTokenSchema,
} from "../schemas/call.schema";

const router = Router();

// Toàn bộ các tuyến đường liên quan đến cuộc gọi đều yêu cầu người dùng đăng nhập (Protected Routes)
router.use(requireAuth);

/**
 * [GET /api/calls]
 * Lấy danh sách lịch sử cuộc gọi của người dùng (kèm phân trang page, limit)
 */
router.get("/", validate(CallHistoryQuerySchema), callController.getCallHistory);

/**
 * [GET /api/calls/missed-count]
 * Lấy tổng số lượng cuộc gọi nhỡ của người dùng
 */
router.get("/missed-count", callController.getMissedCount);

/**
 * [POST /api/calls/device-tokens]
 * Đăng ký hoặc làm mới mã token thiết bị phục vụ đẩy thông báo FCM
 */
router.post(
  "/device-tokens",
  validate(DeviceTokenBodySchema),
  callController.registerDeviceToken
);

/**
 * [DELETE /api/calls/device-tokens]
 * Hủy đăng ký hoặc xóa mã token thiết bị khi người dùng đăng xuất
 */
router.delete(
  "/device-tokens",
  validate(DeleteDeviceTokenSchema),
  callController.removeDeviceToken
);

export const callRoutes = router;
