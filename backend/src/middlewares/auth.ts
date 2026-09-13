import { Request, Response, NextFunction } from "express";
import { UnauthorizedError, TokenExpiredError } from "../core/errors";
import { verifyAccessToken, AccessTokenPayload, extractAccessToken } from "../utils/auth";
import { userRepository } from "../repositories/user.repository";
import { IUser } from "../models/user.model";

// Mở rộng kiểu dữ liệu Request của Express để chứa payload token và đối tượng người dùng từ CSDL
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
      currentUser?: IUser;
    }
  }
}

/**
 * Middleware bảo vệ các route yêu cầu người dùng phải đăng nhập (Authentication Guard)
 * 1. Trích xuất Access Token từ HTTP Header "Authorization: Bearer <token>" hoặc Signed Cookie
 * 2. Giải mã và kiểm tra chữ ký số JWT qua JWT_ACCESS_SECRET
 * 3. Bắt riêng lỗi jwt.TokenExpiredError để trả về mã lỗi chuyên biệt 'TOKEN_EXPIRED' (HTTP 401)
 * 4. Truy vấn CSDL MongoDB qua UserRepository để kiểm tra tài khoản còn tồn tại
 * 5. Gắn payload vào `req.user` và đối tượng người dùng vào `req.currentUser`
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // Bước 1: Trích xuất Access Token từ Header Authorization hoặc Cookie an toàn
    const token = extractAccessToken(req);
    if (!token) {
      throw new UnauthorizedError("Vui lòng đăng nhập để truy cập tài nguyên này");
    }

    // Bước 2: Xác thực chữ ký và thời hạn của Access Token
    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch (jwtError) {
      // Bắt chính xác lỗi hết hạn token từ thư viện jsonwebtoken
      if ((jwtError as Error)?.name === "TokenExpiredError") {
        throw new TokenExpiredError("Token đã hết hạn, vui lòng làm mới token");
      }
      // Các lỗi khác như sai chữ ký hoặc cấu trúc token bị giả mạo
      throw new UnauthorizedError("Token không hợp lệ hoặc đã bị chỉnh sửa");
    }

    // Bước 3: Truy vấn CSDL để đảm bảo tài khoản người dùng vẫn tồn tại trong hệ thống
    const user = await userRepository.findById(payload.userId);
    if (!user) {
      throw new UnauthorizedError("Tài khoản người dùng không tồn tại hoặc đã bị xóa");
    }

    // Bước 4: Gắn thông tin định danh và hồ sơ người dùng vào Express Request
    req.user = payload;
    req.currentUser = user;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware trích xuất thông tin người dùng tùy chọn (Optional Auth)
 * 1. Kiểm tra Access Token trong Header "Authorization" hoặc Cookie
 * 2. Nếu có token hợp lệ, giải mã và gắn vào `req.user` (và `req.currentUser` nếu tìm thấy trong CSDL)
 * 3. Nếu không có token hoặc token đã hết hạn, vẫn cho phép tiếp tục mà không ném lỗi 401
 * 4. Phù hợp cho tuyến đường đăng xuất (người dùng có thể đăng xuất khi token đã hết hạn)
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // Trích xuất Access Token an toàn nếu có
    const token = extractAccessToken(req);
    if (!token) {
      return next();
    }

    try {
      // Thử giải mã Access Token nếu token còn hạn
      const payload = verifyAccessToken(token);
      req.user = payload;

      // Tra cứu thông tin người dùng trong CSDL nếu có thể
      const user = await userRepository.findById(payload.userId);
      if (user) {
        req.currentUser = user;
      }
    } catch (_error) {
      // Bỏ qua lỗi token hết hạn hoặc không hợp lệ để đảm bảo client vẫn tiếp tục xử lý được
    }

    next();
  } catch (error) {
    next(error);
  }
}
