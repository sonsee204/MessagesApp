import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import {
  UpdateProfileSchema,
  ChangePasswordSchema,
  SearchUsersQuerySchema,
  GetUserByIdParamsSchema,
} from "../schemas/user.schema";

const router = Router();

// Tất cả các tuyến đường quản lý người dùng đều yêu cầu xác thực JWT (Protected)
router.use(requireAuth);

// Tuyến đường lấy thông tin hồ sơ cá nhân của chính người dùng đang đăng nhập
// BẮT BUỘC đặt trước route động GET /:id bên dưới, nếu không "profile" sẽ bị hiểu là ID người dùng
router.get("/profile", userController.getProfile);

// Tuyến đường cập nhật thông tin cá nhân
router.patch("/profile", validate(UpdateProfileSchema), userController.updateProfile);

// Tuyến đường đổi mật khẩu người dùng
router.put("/change-password", validate(ChangePasswordSchema), userController.changePassword);

// Tuyến đường tìm kiếm người dùng theo từ khóa và phân trang
router.get("/search", validate(SearchUsersQuerySchema), userController.searchUsers);

// Tuyến đường xem thông tin chi tiết một người dùng theo ID
router.get("/:id", validate(GetUserByIdParamsSchema), userController.getUserById);

export const userRoutes = router;
