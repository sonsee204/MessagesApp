import { RefreshTokenModel, IRefreshToken } from "../models/refresh-token.model";

/**
 * Interface giao ước cho tầng Repository quản lý Refresh Token
 */
export interface IRefreshTokenRepository {
  createToken(userId: string, tokenHash: string, expiresAt: Date): Promise<IRefreshToken>;
  findByTokenHash(tokenHash: string): Promise<IRefreshToken | null>;
  deleteByTokenHash(tokenHash: string): Promise<boolean>;
  deleteAllForUser(userId: string): Promise<void>;
  deleteExpiredTokens(): Promise<number>;
}

/**
 * Lớp triển khai các thao tác với bảng RefreshToken trên MongoDB bằng Mongoose
 */
export class MongooseRefreshTokenRepository implements IRefreshTokenRepository {
  /**
   * Lưu trữ bản ghi Refresh Token mới vào cơ sở dữ liệu
   * @param userId ID của người dùng sở hữu token
   * @param tokenHash Chuỗi băm SHA-256 của Refresh Token
   * @param expiresAt Thời điểm hết hạn của token
   */
  async createToken(userId: string, tokenHash: string, expiresAt: Date): Promise<IRefreshToken> {
    return RefreshTokenModel.create({
      userId,
      tokenHash,
      expiresAt,
    });
  }

  /**
   * Tìm kiếm bản ghi Refresh Token theo chuỗi băm
   * @param tokenHash Chuỗi băm SHA-256 cần tra cứu
   * @returns Bản ghi token nếu tồn tại và chưa hết hạn, ngược lại null
   */
  async findByTokenHash(tokenHash: string): Promise<IRefreshToken | null> {
    return RefreshTokenModel.findOne({ tokenHash }).exec();
  }

  /**
   * Xóa một Refresh Token cụ thể (dùng trong Token Rotation hoặc Logout thiết bị hiện tại)
   * @param tokenHash Chuỗi băm SHA-256 cần xóa
   * @returns true nếu đã xóa thành công, false nếu không tìm thấy bản ghi
   */
  async deleteByTokenHash(tokenHash: string): Promise<boolean> {
    const result = await RefreshTokenModel.deleteOne({ tokenHash }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Xóa toàn bộ Refresh Token của một người dùng (dùng khi đổi mật khẩu hoặc đăng xuất tất cả thiết bị)
   * @param userId ID người dùng cần thu hồi toàn bộ token
   */
  async deleteAllForUser(userId: string): Promise<void> {
    await RefreshTokenModel.deleteMany({ userId }).exec();
  }

  /**
   * Xóa chủ động tất cả các token đã hết hạn (hỗ trợ dọn dẹp tức thì hoặc fallback)
   * @returns Số lượng bản ghi đã được xóa
   */
  async deleteExpiredTokens(): Promise<number> {
    const result = await RefreshTokenModel.deleteMany({ expiresAt: { $lte: new Date() } }).exec();
    return result.deletedCount;
  }
}

// Khởi tạo đối tượng Repository dùng chung (Singleton)
export const refreshTokenRepository = new MongooseRefreshTokenRepository();
