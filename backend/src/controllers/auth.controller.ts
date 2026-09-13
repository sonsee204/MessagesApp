import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  clearAuthCookie,
  extractRefreshToken,
  extractRefreshTokenFromCookie,
} from "../utils/auth";
import { UnauthorizedError } from "../core/errors";
import { logger } from "../core/logger";

/**
 * Controller điều hướng các yêu cầu HTTP liên quan đến Xác thực (Auth)
 * Hỗ trợ đồng thời kỹ thuật Access Token (ngắn hạn) và Refresh Token (dài hạn)
 */
export class AuthController {
  /**
   * [POST /api/auth/register]
   * Tiếp nhận yêu cầu đăng ký người dùng mới
   * 1. Gọi AuthService để mã hóa mật khẩu, tạo tài khoản và sinh cặp token
   * 2. Thiết lập HTTP-Only Cookie chứa Refresh Token an toàn (chống XSS)
   * 3. Phản hồi HTTP 201 Created kèm dữ liệu hồ sơ và Access Token
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Bước 1: Gọi service xử lý nghiệp vụ đăng ký
      const result = await authService.register(req.body);

      // Bước 2: Thiết lập HTTP-Only Cookie chứa Refresh Token để client tự động gửi khi làm mới
      setRefreshTokenCookie(res, result.refreshToken);

      // Bước 3: Loại Refresh Token khỏi phần body trả về.
      // Token này đã nằm trong HTTP-Only Cookie (JavaScript không đọc được — chống XSS).
      // Trả kèm trong JSON sẽ vô hiệu hóa toàn bộ lợi ích đó.
      const { refreshToken: _refreshToken, ...safeResult } = result;

      // Bước 4: Ghi log thông tin đăng ký thành công
      logger.info(`Người dùng mới đăng ký thành công: ${result.user.username} (${result.user.email})`);

      // Bước 5: Trả về HTTP 201 kèm payload thông tin người dùng và Access Token
      res.status(201).json({
        success: true,
        data: safeResult,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST /api/auth/login]
   * Tiếp nhận yêu cầu đăng nhập hệ thống (Email hoặc Username)
   * 1. Xác thực thông tin qua AuthService và so khớp mật khẩu bằng bcrypt
   * 2. Thiết lập HTTP-Only Cookie chứa Refresh Token
   * 3. Phản hồi HTTP 200 OK kèm Access Token và Refresh Token
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Bước 1: Gọi service xác thực email/username và mật khẩu
      const result = await authService.login(req.body);

      // Bước 2: Đính kèm Refresh Token vào HTTP-Only Cookie an toàn
      setRefreshTokenCookie(res, result.refreshToken);

      // Bước 3: Loại Refresh Token khỏi body — chỉ lưu trong HTTP-Only Cookie để chống XSS
      const { refreshToken: _refreshToken, ...safeResult } = result;

      // Bước 4: Ghi log thông tin đăng nhập thành công
      logger.info(`Người dùng [${result.user.username}] đã đăng nhập thành công từ IP [${req.ip}]`);

      // Bước 5: Trả về HTTP 200 khi đăng nhập thành công (không kèm Refresh Token)
      res.status(200).json({
        success: true,
        data: safeResult,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST /api/auth/refresh]
   * Tiếp nhận yêu cầu cấp mới Access Token bằng Refresh Token
   * 1. Trích xuất Refresh Token từ HTTP-Only Cookie hoặc từ Request Body
   * 2. Gọi AuthService để xác thực, quay vòng token (Token Rotation) và cấp cặp token mới
   * 3. Cập nhật lại HTTP-Only Cookie với Refresh Token mới
   * 4. Phản hồi HTTP 200 OK kèm Access Token mới
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Bước 1: Trích xuất Refresh Token an toàn (tự động kiểm tra chữ ký số Signed Cookie trước)
      const token = extractRefreshToken(req);
      if (!token) {
        throw new UnauthorizedError("Vui lòng cung cấp refresh token");
      }

      // Bước 2: Gọi service thực hiện cơ chế Token Rotation
      const result = await authService.refreshToken(token);

      // Bước 3: Cập nhật lại Refresh Token mới vào HTTP-Only Cookie có ký số
      setRefreshTokenCookie(res, result.refreshToken);

      // Bước 4: Chỉ trả Access Token trong body; Refresh Token đã được quay vòng vào Cookie.
      // Frontend chỉ cần `data.accessToken` (xem lib/axios.ts interceptor), nên không mất gì.
      const {
        refreshToken: _refreshToken,
        user: refreshedUser,
        accessToken: newAccessToken,
        token: legacyToken,
      } = result;

      // Bước 5: Ghi log thành công
      logger.info(`Người dùng [${refreshedUser.username}] đã làm mới token thành công`);

      // Bước 6: Trả về kết quả cho client
      res.status(200).json({
        success: true,
        data: { user: refreshedUser, accessToken: newAccessToken, token: legacyToken },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST /api/auth/logout]
   * Xử lý đăng xuất tài khoản ở tầng HTTP
   * 1. Đọc Refresh Token từ Cookie bằng cookie-parser (hỗ trợ kiểm tra ký số HMAC-SHA256)
   * 2. Thu hồi bản ghi Refresh Token trong phiên/CSDL MongoDB (Session Revocation)
   * 3. Cập nhật trạng thái ngoại tuyến isOnline = false cho người dùng
   * 4. Xóa sạch HTTP-Only Cookie (refreshToken và token) trên trình duyệt
   * 5. Ghi log sự kiện an toàn và phản hồi HTTP 200 OK
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Bước 1: Đọc Refresh Token từ Cookie qua thư viện cookie-parser (ưu tiên Signed Cookie, fallback body)
      const token = extractRefreshTokenFromCookie(req) || extractRefreshToken(req);
      const userId = req.user?.userId;

      // Bước 2: Gọi AuthService để thu hồi session token trong CSDL và cập nhật trạng thái offline
      await authService.logout(userId, token);

      // Bước 3: Xóa sạch các HTTP-Only Cookie xác thực trên trình duyệt
      clearRefreshTokenCookie(res);
      clearAuthCookie(res);

      // Bước 4: Ghi log sự kiện đăng xuất thành công
      logger.info(`Tài khoản [${userId || "Phiên cookie"}] đã đăng xuất thành công từ IP [${req.ip}]`);

      // Bước 5: Trả về kết quả HTTP 200 OK
      res.status(200).json({
        success: true,
        data: {
          message: "Đăng xuất thành công",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET /api/auth/me]
   * Lấy thông tin hồ sơ của tài khoản đang đăng nhập
   * Ưu tiên sử dụng `req.currentUser` đã được requireAuth truy vấn sẵn từ CSDL
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.currentUser || (await authService.getProfile(req.user!.userId));

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
