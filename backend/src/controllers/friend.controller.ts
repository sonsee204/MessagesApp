import { Request, Response, NextFunction } from "express";
import { friendService, FriendService } from "../services/friend.service";

export class FriendController {
  constructor(private service: FriendService = friendService) {}

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

  getFriends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const onlineOnly = req.query.onlineOnly === "true" || req.query.onlineOnly === true;

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
