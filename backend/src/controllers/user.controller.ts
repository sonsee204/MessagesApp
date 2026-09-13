import { Request, Response, NextFunction } from "express";
import { userRepository } from "../repositories/user.repository";
import { NotFoundError, UnauthorizedError, ValidationError } from "../core/errors";
import { comparePassword, hashPassword } from "../utils/auth";
import { saveImage, deleteImageByUrl } from "../utils/image-storage";
import { ImageKind } from "../config/upload";

/**
 * Controller xử lý các tác vụ liên quan đến tài khoản người dùng
 */
export class UserController {
  /**
   * [GET /api/users/profile]
   * Lấy thông tin hồ sơ của tài khoản đang đăng nhập
   * Đặt TRƯỚC route động `GET /users/:id` để không bị bắt nhầm thành ID người dùng.
   * Phản hồi HTTP 200 OK kèm dữ liệu hồ sơ công khai của chính người dùng
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Trích xuất userId từ JWT — không nhận ID từ tham số đường dẫn để tránh xem hồ sơ người khác
      const userId = req.user!.userId;

      const user = await userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError("Không tìm thấy người dùng");
      }

      // Trả về thông tin hồ sơ (trường passwordHash đã bị loại bỏ bởi toJSON của User model)
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PATCH /api/users/profile]
   * Cập nhật thông tin hồ sơ của tài khoản đang đăng nhập
   * Phản hồi HTTP 200 OK kèm dữ liệu người dùng sau khi cập nhật
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Trích xuất userId từ JWT payload gắn trong req.user
      const userId = req.user!.userId;

      // Cập nhật thông tin hồ sơ qua Repository
      const updatedUser = await userRepository.updateProfile(userId, req.body);
      if (!updatedUser) {
        throw new NotFoundError("Không tìm thấy người dùng");
      }

      // Trả về thông tin hồ sơ mới cập nhật
      res.status(200).json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      // Chuyển tiếp lỗi sang Global Error Handler middleware
      next(error);
    }
  }

  /**
   * [POST /api/users/change-password]
   * Đổi mật khẩu cho người dùng đang đăng nhập
   * Phản hồi HTTP 200 OK với thông điệp thành công
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;

      // Bước 1: Kiểm tra người dùng có tồn tại trong hệ thống không
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError("Không tìm thấy người dùng");
      }

      // Bước 2: Lấy bản ghi người dùng kèm trường passwordHash ẩn để đối chiếu
      const userWithPass = await userRepository.findByEmail(user.email, true);
      if (!userWithPass) {
        throw new NotFoundError("Không tìm thấy người dùng");
      }

      // Bước 3: So sánh mật khẩu hiện tại bằng bcrypt
      const isMatch = await comparePassword(currentPassword, userWithPass.passwordHash);
      if (!isMatch) {
        throw new UnauthorizedError("Mật khẩu hiện tại không chính xác");
      }

      // Bước 4: Băm mật khẩu mới với bcrypt và cập nhật vào CSDL
      const newHash = await hashPassword(newPassword);
      await userRepository.updatePassword(userId, newHash);

      // Trả về HTTP 200 thông báo đổi mật khẩu thành công
      res.status(200).json({
        success: true,
        data: {
          message: "Đổi mật khẩu thành công",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET /api/users/search]
   * Tìm kiếm người dùng theo từ khóa (username hoặc displayName) có phân trang
   * Phản hồi HTTP 200 OK kèm danh sách và metadata phân trang
   */
  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!.userId;
      const keyword = (req.query.q as string) || "";
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      // Tìm kiếm loại trừ chính người dùng hiện tại
      const result = await userRepository.searchUsers(keyword, currentUserId, page, limit);

      // Trả về kết quả kèm phân trang
      res.status(200).json({
        success: true,
        data: result.users,
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET /api/users/:id]
   * Lấy thông tin công khai của người dùng theo ID
   * Phản hồi HTTP 200 OK kèm thông tin người dùng
   */
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Tìm kiếm thông tin người dùng theo param id
      const user = await userRepository.findById(req.params.id);
      if (!user) {
        throw new NotFoundError("Không tìm thấy người dùng");
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Xử lý chung cho cả ảnh đại diện và ảnh bìa — một luồng, hai tham số hình học.
   *
   * THỨ TỰ BẮT BUỘC: ghi tệp mới -> cập nhật CSDL -> mới xoá tệp cũ.
   * Nếu xoá trước mà bước CSDL thất bại, người dùng MẤT ẢNH HOÀN TOÀN.
   * Làm đúng thứ tự này thì trường hợp xấu nhất chỉ là còn lại một tệp rác.
   *
   * Phản hồi HTTP 200 OK kèm hồ sơ người dùng đã cập nhật.
   */
  private replaceImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
    kind: ImageKind
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;

      // Kiểm tra tệp đến từ middleware multer hay không
      if (!req.file) {
        throw new ValidationError("Vui lòng chọn một tệp ảnh");
      }

      // Đọc URL CŨ trước khi ghi CSDL — sau khi ghi thì giá trị này đã bị thay
      const field = kind === "avatar" ? "avatarUrl" : "bannerUrl";
      const previousUrl = req.currentUser ? (req.currentUser[field] as string | null) : null;

      // Bước 1: xử lý ảnh và ghi tệp mới xuống đĩa
      const newUrl = await saveImage(req.file.buffer, kind, userId);

      // Bước 2: trỏ CSDL sang tệp mới
      const updatedUser = await userRepository.updateImage(userId, field, newUrl);
      if (!updatedUser) {
        throw new NotFoundError("Không tìm thấy người dùng");
      }

      // Bước 3: dọn tệp cũ. Hàm này không bao giờ ném lỗi nên không thể làm hỏng request.
      await deleteImageByUrl(previousUrl);

      res.status(200).json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * [POST /api/users/avatar]
   * Tải lên ảnh đại diện mới (multipart/form-data, trường tên "file")
   * Phản hồi HTTP 200 OK kèm hồ sơ người dùng đã cập nhật
   */
  uploadAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return this.replaceImage(req, res, next, "avatar");
  };

  /**
   * [POST /api/users/banner]
   * Tải lên ảnh bìa trang hồ sơ (multipart/form-data, trường tên "file")
   * Phản hồi HTTP 200 OK kèm hồ sơ người dùng đã cập nhật
   */
  uploadBanner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return this.replaceImage(req, res, next, "banner");
  };
}

export const userController = new UserController();
