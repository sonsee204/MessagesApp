import { Request, Response, NextFunction } from "express";
import { IFriendRepository, friendRepository } from "../repositories/friend.repository";
import { IBlockRepository, blockRepository } from "../repositories/block.repository";
import { UnauthorizedError, ForbiddenError, ValidationError } from "../core/errors";

/**
 * Hàm hoặc tên trường dùng để trích xuất targetUserId từ Express Request
 */
export type TargetUserExtractor = string | ((req: Request) => string | undefined | null);

/**
 * Cấu trúc thông tin quan hệ giữa người dùng hiện tại và người dùng mục tiêu
 */
export interface RelationshipContext {
  targetUserId: string;
  isFriend: boolean;
  isBlocked: boolean;
  isBlockedByMe: boolean;
  isBlockedByTarget: boolean;
}

// Mở rộng kiểu dữ liệu Request của Express để chứa thông tin quan hệ bạn bè
declare global {
  namespace Express {
    interface Request {
      relationship?: RelationshipContext;
    }
  }
}

/**
 * Trợ thủ nội bộ trích xuất ID người dùng mục tiêu từ params hoặc body
 * Ưu tiên: Custom Extractor > req.params.targetUserId > req.params.userId > req.body.receiverId > req.body.targetUserId
 *
 * @param req Đối tượng Express Request
 * @param extractor Tùy chọn trích xuất tùy biến
 * @returns Chuỗi ID người dùng mục tiêu hoặc undefined
 */
export function resolveTargetUserId(
  req: Request,
  extractor?: TargetUserExtractor
): string | undefined {
  if (typeof extractor === "function") {
    const extracted = extractor(req);
    return extracted ? String(extracted).trim() : undefined;
  }

  if (typeof extractor === "string" && extractor.length > 0) {
    const fromParams = req.params?.[extractor];
    if (fromParams) return String(fromParams).trim();

    const fromBody = req.body?.[extractor];
    if (fromBody) return String(fromBody).trim();

    const fromQuery = req.query?.[extractor];
    if (fromQuery) return String(fromQuery).trim();
  }

  // Thứ tự fallback mặc định
  return (
    req.params?.targetUserId ||
    req.params?.userId ||
    req.body?.receiverId ||
    req.body?.targetUserId ||
    req.params?.receiverId
  );
}

/**
 * Khởi tạo bộ Middlewares quản lý quan hệ bạn bè & chặn với Dependency Injection
 *
 * @param friendRepo Repository thao tác dữ liệu bạn bè
 * @param blockRepo Repository thao tác dữ liệu chặn
 */
export function createFriendMiddlewares(
  friendRepo: IFriendRepository = friendRepository,
  blockRepo: IBlockRepository = blockRepository
) {
  /**
   * Middleware ngăn người dùng thực hiện hành động với chính mình (Self-Action Guard)
   * 1. Kiểm tra xác thực (req.user)
   * 2. Trích xuất targetUserId
   * 3. So sánh targetUserId với ID người dùng hiện tại
   *
   * @param extractor Hàm hoặc tên trường trích xuất ID người dùng mục tiêu
   */
  function preventSelfAction(extractor?: TargetUserExtractor) {
    return (req: Request, _res: Response, next: NextFunction): void => {
      try {
        // Bước 1: Kiểm tra người dùng đã đăng nhập hay chưa
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
          throw new UnauthorizedError("Vui lòng đăng nhập để thực hiện hành động này");
        }

        // Bước 2: Trích xuất ID người dùng mục tiêu
        const targetUserId = resolveTargetUserId(req, extractor);
        if (!targetUserId) {
          throw new ValidationError("Thiếu thông tin ID người dùng mục tiêu");
        }

        // Bước 3: So sánh ID, từ chối nếu người dùng tự thao tác với chính mình
        if (currentUserId === targetUserId) {
          throw new ValidationError("Không thể thực hiện hành động này với chính mình");
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Middleware kiểm tra quan hệ chặn 2 chiều (Block Check Guard)
   * 1. Kiểm tra xác thực (req.user)
   * 2. Trích xuất targetUserId
   * 3. Kiểm tra xem một trong hai người có đang chặn người kia hay không
   *
   * @param extractor Hàm hoặc tên trường trích xuất ID người dùng mục tiêu
   */
  function checkNotBlocked(extractor?: TargetUserExtractor) {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        // Bước 1: Kiểm tra trạng thái đăng nhập của người dùng
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
          throw new UnauthorizedError("Vui lòng đăng nhập để thực hiện hành động này");
        }

        // Bước 2: Trích xuất ID người dùng mục tiêu
        const targetUserId = resolveTargetUserId(req, extractor);
        if (!targetUserId) {
          throw new ValidationError("Thiếu thông tin ID người dùng mục tiêu");
        }

        // Bỏ qua kiểm tra nếu cùng một người (sẽ do preventSelfAction bắt nếu có)
        if (currentUserId === targetUserId) {
          return next();
        }

        // Bước 3: Kiểm tra quan hệ chặn 2 chiều qua CSDL
        const isBlocked = await blockRepo.isBlocked(currentUserId, targetUserId);
        if (isBlocked) {
          throw new ForbiddenError(
            "Không thể thực hiện hành động do quan hệ giữa hai người dùng đã bị chặn"
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Middleware yêu cầu phải có quan hệ bạn bè (Friendship Guard)
   * 1. Kiểm tra xác thực (req.user)
   * 2. Trích xuất targetUserId
   * 3. Kiểm tra xem 2 người có đang là bạn bè hay không
   *
   * @param extractor Hàm hoặc tên trường trích xuất ID người dùng mục tiêu
   */
  function requireFriendship(extractor?: TargetUserExtractor) {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        // Bước 1: Kiểm tra trạng thái đăng nhập của người dùng
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
          throw new UnauthorizedError("Vui lòng đăng nhập để thực hiện hành động này");
        }

        // Bước 2: Trích xuất ID người dùng mục tiêu
        const targetUserId = resolveTargetUserId(req, extractor);
        if (!targetUserId) {
          throw new ValidationError("Thiếu thông tin ID người dùng mục tiêu");
        }

        // Bước 3: Kiểm tra trạng thái quan hệ bạn bè trong CSDL
        const isFriend = await friendRepo.isFriend(currentUserId, targetUserId);
        if (!isFriend) {
          throw new ForbiddenError("Yêu cầu quan hệ bạn bè để thực hiện hành động này");
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Middleware tiện ích gắn thông tin chi tiết mối quan hệ vào req.relationship
   * Thực hiện truy vấn song song (Parallel queries) để tối ưu hiệu năng:
   * - friendRepo.isFriend
   * - blockRepo.isBlockedBy(current, target)
   * - blockRepo.isBlockedBy(target, current)
   *
   * @param extractor Hàm hoặc tên trường trích xuất ID người dùng mục tiêu
   */
  function attachRelationshipStatus(extractor?: TargetUserExtractor) {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        // Bước 1: Kiểm tra người dùng đã đăng nhập hay chưa
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
          throw new UnauthorizedError("Vui lòng đăng nhập để thực hiện hành động này");
        }

        // Bước 2: Trích xuất ID người dùng mục tiêu
        const targetUserId = resolveTargetUserId(req, extractor);
        if (!targetUserId) {
          throw new ValidationError("Thiếu thông tin ID người dùng mục tiêu");
        }

        // Bước 3: Truy vấn song song quan hệ bạn bè và chặn 2 chiều
        const [isFriend, isBlockedByMe, isBlockedByTarget] = await Promise.all([
          friendRepo.isFriend(currentUserId, targetUserId),
          blockRepo.isBlockedBy(currentUserId, targetUserId),
          blockRepo.isBlockedBy(targetUserId, currentUserId),
        ]);

        // Bước 4: Gắn thông tin ngữ cảnh quan hệ vào đối tượng Request
        req.relationship = {
          targetUserId,
          isFriend,
          isBlocked: isBlockedByMe || isBlockedByTarget,
          isBlockedByMe,
          isBlockedByTarget,
        };

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  return {
    preventSelfAction,
    checkNotBlocked,
    requireFriendship,
    attachRelationshipStatus,
  };
}

// Khởi tạo và xuất các middlewares mặc định sử dụng singleton repositories
const defaultMiddlewares = createFriendMiddlewares();

export const preventSelfAction = defaultMiddlewares.preventSelfAction;
export const checkNotBlocked = defaultMiddlewares.checkNotBlocked;
export const requireFriendship = defaultMiddlewares.requireFriendship;
export const attachRelationshipStatus = defaultMiddlewares.attachRelationshipStatus;
