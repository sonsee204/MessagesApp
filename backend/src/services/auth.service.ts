import { IUserRepository, userRepository } from "../repositories/user.repository";
import { IRefreshTokenRepository, refreshTokenRepository } from "../repositories/refresh-token.repository";
import { RegisterDTO, LoginDTO } from "../schemas/auth.schema";
import { ConflictError, UnauthorizedError, NotFoundError } from "../core/errors";
import {
  hashPassword,
  comparePassword,
  generateAuthTokens,
  verifyRefreshToken,
  hashToken,
} from "../utils/auth";
import { IUser } from "../models/user.model";

/**
 * Cấu trúc dữ liệu phản hồi sau khi xác thực thành công (Đăng ký / Đăng nhập / Làm mới token)
 */
export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  };
  accessToken: string;
  refreshToken: string;
  token: string; // Tương thích ngược: alias trỏ đến accessToken
}

/**
 * Service xử lý nghiệp vụ xác thực người dùng và quản lý phiên (Access Token & Refresh Token)
 */
export class AuthService {
  constructor(
    private userRepo: IUserRepository = userRepository,
    private refreshTokenRepo: IRefreshTokenRepository = refreshTokenRepository
  ) {}

  /**
   * Tính toán thời điểm hết hạn của Refresh Token (mặc định 7 ngày kể từ hiện tại)
   */
  private calculateRefreshTokenExpiry(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  /**
   * Xử lý đăng ký tài khoản mới
   * 1. Kiểm tra tính duy nhất của email và username
   * 2. Băm mật khẩu bằng thuật toán bcrypt an toàn
   * 3. Lưu thông tin người dùng vào cơ sở dữ liệu
   * 4. Sinh cặp Access Token (15m) và Refresh Token (7d)
   * 5. Lưu chuỗi băm SHA-256 của Refresh Token vào CSDL để quản lý phiên
   */
  async register(data: RegisterDTO): Promise<AuthResponse> {
    // Bước 1: Kiểm tra xem email đã được tài khoản khác sử dụng hay chưa
    const existingEmail = await this.userRepo.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError("Email này đã được sử dụng");
    }

    // Bước 2: Kiểm tra xem username đã tồn tại trong hệ thống chưa
    const existingUsername = await this.userRepo.findByUsername(data.username);
    if (existingUsername) {
      throw new ConflictError("Tên người dùng này đã tồn tại");
    }

    // Bước 3: Mã hóa băm mật khẩu với bcrypt salt rounds = 10
    const passwordHash = await hashPassword(data.password);

    // Bước 4: Tạo bản ghi người dùng mới qua Repository layer
    const user = await this.userRepo.create({
      username: data.username,
      email: data.email,
      passwordHash,
      displayName: data.displayName || data.username,
      avatarUrl: data.avatarUrl || undefined,
    });

    // Bước 5: Sinh cặp Access Token (ngắn hạn) và Refresh Token (dài hạn)
    const { accessToken, refreshToken } = generateAuthTokens({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    // Bước 6: Lưu chuỗi băm SHA-256 của Refresh Token vào CSDL để hỗ trợ thu hồi token
    const tokenHash = hashToken(refreshToken);
    const expiresAt = this.calculateRefreshTokenExpiry();
    await this.refreshTokenRepo.createToken(user.id, tokenHash, expiresAt);

    // Bước 7: Trả về thông tin người dùng an toàn cùng cặp token
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
      token: accessToken,
    };
  }

  /**
   * Xử lý đăng nhập hệ thống
   * 1. Tìm người dùng theo Email hoặc Username (kèm trường passwordHash ẩn)
   * 2. So sánh mật khẩu bằng bcrypt.compare
   * 3. Cập nhật trạng thái trực tuyến (isOnline = true, lastSeenAt = new Date())
   * 4. Sinh cặp Access Token và Refresh Token
   * 5. Lưu bản băm SHA-256 của Refresh Token vào CSDL
   */
  async login(data: LoginDTO): Promise<AuthResponse> {
    // Bước 1: Trích xuất thông tin định danh (Email hoặc Username)
    const identifier = (data.identifier || data.email)!.trim();

    // Bước 2: Tìm người dùng theo Email hoặc Username và lấy kèm passwordHash
    const user = await this.userRepo.findByIdentifier(identifier, true);
    if (!user) {
      // Thông điệp bảo mật chung, chống tấn công User Enumeration
      throw new UnauthorizedError("Tài khoản hoặc mật khẩu không chính xác");
    }

    // Bước 3: So khớp mật khẩu người dùng gửi lên với bản băm trong cơ sở dữ liệu bằng bcrypt
    const isMatch = await comparePassword(data.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Tài khoản hoặc mật khẩu không chính xác");
    }

    // Bước 4: Cập nhật trạng thái trực tuyến và thời điểm hoạt động gần nhất
    await this.userRepo.updateOnlineStatus(user.id, true);

    // Bước 5: Sinh cặp Access Token và Refresh Token mới
    const { accessToken, refreshToken } = generateAuthTokens({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    // Bước 6: Lưu chuỗi băm của Refresh Token vào CSDL để quản lý phiên
    const tokenHash = hashToken(refreshToken);
    const expiresAt = this.calculateRefreshTokenExpiry();
    await this.refreshTokenRepo.createToken(user.id, tokenHash, expiresAt);

    // Bước 7: Trả về thông tin hồ sơ người dùng an toàn cùng cặp token xác thực
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
      token: accessToken,
    };
  }

  /**
   * Xử lý làm mới Access Token bằng Refresh Token (Cơ chế Token Rotation)
   * 1. Xác thực tính hợp lệ của Refresh Token qua chữ ký JWT
   * 2. Băm token và kiểm tra sự tồn tại trong CSDL (phòng chống token đã bị thu hồi)
   * 3. Xóa token cũ ngay lập tức (Token Rotation)
   * 4. Kiểm tra tài khoản người dùng còn tồn tại hay không
   * 5. Sinh cặp Access Token và Refresh Token mới
   * 6. Lưu băm của Refresh Token mới vào CSDL
   */
  async refreshToken(refreshTokenString: string): Promise<AuthResponse> {
    if (!refreshTokenString) {
      throw new UnauthorizedError("Vui lòng cung cấp refresh token");
    }

    // Bước 1: Xác thực chữ ký và thời hạn của Refresh Token
    let payload;
    try {
      payload = verifyRefreshToken(refreshTokenString);
    } catch (_err) {
      throw new UnauthorizedError("Refresh token không hợp lệ hoặc đã hết hạn");
    }

    // Bước 2: Kiểm tra bản ghi Refresh Token trong CSDL theo chuỗi băm SHA-256
    const tokenHash = hashToken(refreshTokenString);
    const tokenDoc = await this.refreshTokenRepo.findByTokenHash(tokenHash);
    if (!tokenDoc) {
      // Nếu token hợp lệ về mặt chữ ký nhưng không có trong CSDL -> token đã bị thu hồi hoặc tái sử dụng bất hợp pháp
      throw new UnauthorizedError("Refresh token không hợp lệ hoặc đã bị thu hồi");
    }

    // Bước 3: Áp dụng cơ chế Token Rotation: Hủy Refresh Token cũ ngay lập tức
    await this.refreshTokenRepo.deleteByTokenHash(tokenHash);

    // Bước 4: Kiểm tra tài khoản người dùng trong CSDL
    const user = await this.userRepo.findById(payload.userId);
    if (!user) {
      throw new UnauthorizedError("Tài khoản người dùng không tồn tại");
    }

    // Bước 5: Sinh cặp Access Token và Refresh Token hoàn toàn mới
    const { accessToken, refreshToken } = generateAuthTokens({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    // Bước 6: Lưu bản băm của Refresh Token mới vào CSDL
    const newTokenHash = hashToken(refreshToken);
    const expiresAt = this.calculateRefreshTokenExpiry();
    await this.refreshTokenRepo.createToken(user.id, newTokenHash, expiresAt);

    // Bước 7: Trả về cặp token mới và dữ liệu người dùng
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
      token: accessToken,
    };
  }

  /**
   * Xử lý đăng xuất người dùng ở tầng HTTP
   * 1. Băm Refresh Token và truy xuất userId từ CSDL nếu chưa có
   * 2. Xóa bản ghi Refresh Token trong CSDL (hủy phiên làm việc)
   * 3. Cập nhật trạng thái ngoại tuyến isOnline = false cho người dùng
   * @param userId ID người dùng (nếu có từ Access Token)
   * @param refreshTokenString Chuỗi Refresh Token đọc từ Cookie
   */
  async logout(userId?: string, refreshTokenString?: string): Promise<void> {
    let resolvedUserId = userId;

    // Bước 1: Xử lý thu hồi Refresh Token trong CSDL (xóa session)
    if (refreshTokenString) {
      const tokenHash = hashToken(refreshTokenString);

      // Nếu chưa có userId, tra cứu từ CSDL trước khi xóa bản ghi
      if (!resolvedUserId) {
        const tokenDoc = await this.refreshTokenRepo.findByTokenHash(tokenHash);
        if (tokenDoc) {
          resolvedUserId = tokenDoc.userId.toString();
        } else {
          // Dự phòng: Giải mã payload token nếu CSDL chưa kịp cập nhật hoặc đã hết hạn
          try {
            const payload = verifyRefreshToken(refreshTokenString);
            resolvedUserId = payload.userId;
          } catch (_err) {
            // Bỏ qua lỗi giải mã nếu token đã quá hạn
          }
        }
      }

      // Xóa vĩnh viễn bản ghi Refresh Token khỏi CSDL
      await this.refreshTokenRepo.deleteByTokenHash(tokenHash);
    }

    // Bước 2: Cập nhật trạng thái ngoại tuyến của người dùng nếu xác định được userId
    if (resolvedUserId) {
      await this.userRepo.updateOnlineStatus(resolvedUserId, false);
    }
  }

  /**
   * Lấy thông tin hồ sơ người dùng hiện tại theo userId
   */
  async getProfile(userId: string): Promise<IUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError("Không tìm thấy thông tin người dùng");
    }
    return user;
  }
}

// Khởi tạo thực thể AuthService dùng chung (Singleton)
export const authService = new AuthService();
