import { Router } from "express";
import { friendController } from "../controllers/friend.controller";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import {
  SendFriendRequestSchema,
  FriendQuerySchema,
  PaginationQuerySchema,
  RequestIdParamSchema,
  TargetUserParamSchema,
} from "../schemas/friend.schema";

const router = Router();

// Yêu cầu xác thực JWT trên tất cả routes
router.use(requireAuth);

// 1. Quản lý Lời mời kết bạn
router.post("/requests", validate(SendFriendRequestSchema), friendController.sendRequest);
router.get("/requests/received", validate(PaginationQuerySchema), friendController.getReceivedRequests);
router.get("/requests/sent", validate(PaginationQuerySchema), friendController.getSentRequests);
router.post("/requests/:requestId/accept", validate(RequestIdParamSchema), friendController.acceptRequest);
router.post("/requests/:requestId/reject", validate(RequestIdParamSchema), friendController.rejectRequest);
router.delete("/requests/:requestId/cancel", validate(RequestIdParamSchema), friendController.cancelRequest);

// 2. Quản lý Chặn người dùng (đặt trước /:targetUserId để tránh xung đột params)
router.get("/blocks", validate(PaginationQuerySchema), friendController.getBlockedUsers);
router.post("/blocks/:targetUserId", validate(TargetUserParamSchema), friendController.blockUser);
router.delete("/blocks/:targetUserId", validate(TargetUserParamSchema), friendController.unblockUser);

// 3. Quản lý Bạn bè & Trạng thái
router.get("/status/:targetUserId", validate(TargetUserParamSchema), friendController.getRelationshipStatus);
router.get("/", validate(FriendQuerySchema), friendController.getFriends);
router.delete("/:targetUserId", validate(TargetUserParamSchema), friendController.removeFriend);

export const friendRoutes = router;
