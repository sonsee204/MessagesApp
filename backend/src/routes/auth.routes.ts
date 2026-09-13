import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { validate } from "../middlewares/validate";
import { requireAuth, optionalAuth } from "../middlewares/auth";
import { loginLimiter } from "../middlewares/rate-limiter";
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from "../schemas/auth.schema";

const router = Router();

// Tuyến đường đăng ký tài khoản mới kèm xác thực schema đầu vào (Public)
router.post("/register", validate(RegisterSchema), authController.register);

// Tuyến đường đăng nhập tài khoản có Rate Limiter chống brute-force và xác thực schema (Public)
router.post("/login", loginLimiter, validate(LoginSchema), authController.login);

// Tuyến đường làm mới Access Token bằng Refresh Token (Public - xác thực qua Refresh Token trong Cookie hoặc Body)
router.post("/refresh", validate(RefreshTokenSchema), authController.refresh);

// Tuyến đường đăng xuất tài khoản, thu hồi Refresh Token và xóa HTTP-Only Cookie (Hỗ trợ Optional Auth)
router.post("/logout", optionalAuth, authController.logout);

// Tuyến đường truy xuất thông tin người dùng hiện tại (Protected: yêu cầu Access Token qua Header hoặc Cookie)
router.get("/me", requireAuth, authController.getMe);

export const authRoutes = router;
