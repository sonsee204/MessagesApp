import { Request, Response, NextFunction } from "express";
import { friendService, FriendService } from "../services/friend.service";

/**
 * Controller tiếp nhận và điều phối các yêu cầu HTTP cho module Bạn bè (Friend APIs)
 */
export class FriendController {
  constructor(private service: FriendService = friendService) {}

  /**
   * POST /api/friends/requests
   * Gửi lời mời kết bạn
   * - Body: { receiverId: string, note?: string }
   * - Phản hồi: 201 Created kèm dữ liệu lời mời kết bạn vừa tạo
   */
  sendRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const senderId = req.user!.userId;
      const { receiverId, note } = req.body;
      const request = await this.service.sendFriendRequest(senderId, receiverId, note);
      res.status(201).json({
        success: true,
        data: request,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/friends/requests/received
   * Lấy danh sách lời mời kết bạn nhận được đang chờ phản hồi
   * - Query: { page?: number, limit?: number }
   * - Phản hồi: 200 OK kèm danh sách và phân trang
   */
  getReceivedRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await this.service.getReceivedRequests(userId, { page, limit });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/friends/requests/sent
   * Lấy danh sách lời mời kết bạn đã gửi đi đang chờ đối phương phản hồi
   * - Query: { page?: number, limit?: number }
   * - Phản hồi: 200 OK kèm danh sách và phân trang
   */
  getSentRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await this.service.getSentRequests(userId, { page, limit });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/friends/requests/:requestId/accept
   * Chấp nhận lời mời kết bạn
   * - Params: { requestId: string }
   * - Phản hồi: 200 OK kèm thông tin tình bạn mới được thiết lập
   */
  acceptRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      const result = await this.service.acceptFriendRequest(userId, requestId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/friends/requests/:requestId/reject
   * Từ chối lời mời kết bạn
   * - Params: { requestId: string }
   * - Phản hồi: 200 OK kèm thông báo từ chối thành công
   */
  rejectRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      await this.service.rejectFriendRequest(userId, requestId);
      res.status(200).json({
        success: true,
        message: "Đã từ chối lời mời kết bạn",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/friends/requests/:requestId/cancel
   * Hủy lời mời kết bạn đã gửi đi
   * - Params: { requestId: string }
   * - Phản hồi: 200 OK kèm thông báo hủy thành công
   */
  cancelRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      await this.service.cancelFriendRequest(userId, requestId);
      res.status(200).json({
        success: true,
        message: "Đã hủy lời mời kết bạn",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/friends
   * Lấy danh sách bạn bè của người dùng hiện tại
   * - Query: { page?: number, limit?: number, search?: string, onlineOnly?: boolean }
   * - Phản hồi: 200 OK kèm danh sách bạn bè và thông tin phân trang
   */
  getFriends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const onlineOnly = req.query.onlineOnly === "true";

      const result = await this.service.getFriends(userId, {
        page,
        limit,
        search,
        onlineOnly,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/friends/:targetUserId
   * Hủy kết bạn với một người dùng
   * - Params: { targetUserId: string }
   * - Phản hồi: 200 OK kèm thông báo hủy kết bạn thành công
   */
  removeFriend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { targetUserId } = req.params;
      await this.service.removeFriend(userId, targetUserId);
      res.status(200).json({
        success: true,
        message: "Đã hủy kết bạn thành công",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/friends/status/:targetUserId
   * Kiểm tra trạng thái quan hệ 2 chiều với một người dùng
   * - Params: { targetUserId: string }
   * - Phản hồi: 200 OK kèm status (NONE, PENDING_SENT, PENDING_RECEIVED, FRIENDS, BLOCKED)
   *   và blockedByMe (true nếu chính người dùng hiện tại là bên chủ động chặn đối phương)
   */
  getRelationshipStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { targetUserId } = req.params;
      const result = await this.service.getRelationshipStatus(userId, targetUserId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/friends/blocks/:targetUserId
   * Chặn người dùng (hủy bạn bè và lời mời kết bạn liên quan)
   * - Params: { targetUserId: string }
   * - Phản hồi: 201 Created kèm thông báo chặn thành công
   */
  blockUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const blockerId = req.user!.userId;
      const { targetUserId } = req.params;
      await this.service.blockUser(blockerId, targetUserId);
      res.status(201).json({
        success: true,
        message: "Đã chặn người dùng thành công",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/friends/blocks/:targetUserId
   * Bỏ chặn người dùng
   * - Params: { targetUserId: string }
   * - Phản hồi: 200 OK kèm thông báo bỏ chặn thành công
   */
  unblockUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const blockerId = req.user!.userId;
      const { targetUserId } = req.params;
      await this.service.unblockUser(blockerId, targetUserId);
      res.status(200).json({
        success: true,
        message: "Đã bỏ chặn người dùng thành công",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/friends/blocks
   * Lấy danh sách những người dùng bị người này chặn
   * - Query: { page?: number, limit?: number }
   * - Phản hồi: 200 OK kèm danh sách chặn có phân trang
   */
  getBlockedUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const blockerId = req.user!.userId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await this.service.getBlockedUsers(blockerId, { page, limit });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const friendController = new FriendController();
