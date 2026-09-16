import { Request, Response, NextFunction } from "express";
import { CallService, callService } from "../services/call.service";
import {
  IDeviceTokenRepository,
  deviceTokenRepository,
} from "../repositories/device-token.repository";
import {
  CallHistoryQueryDTO,
  DeviceTokenBodyDTO,
  DeleteDeviceTokenDTO,
} from "../schemas/call.schema";

/**
 * Controller xử lý các yêu cầu HTTP liên quan đến Cuộc gọi và Token thiết bị
 * Tuân thủ Kiến trúc phân tầng (Layered Architecture): trích xuất dữ liệu, gọi Service/Repository và trả kết quả.
 */
export class CallController {
  constructor(
    private callServ: CallService = callService,
    private deviceTokenRepo: IDeviceTokenRepository = deviceTokenRepository
  ) {
    this.getCallHistory = this.getCallHistory.bind(this);
    this.getMissedCount = this.getMissedCount.bind(this);
    this.registerDeviceToken = this.registerDeviceToken.bind(this);
    this.removeDeviceToken = this.removeDeviceToken.bind(this);
  }

  /**
   * [GET /api/calls]
   * Lấy danh sách lịch sử cuộc gọi của người dùng hiện tại có phân trang
   * Phản hồi HTTP 200 OK kèm danh sách các cuộc gọi
   */
  async getCallHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const query = req.query as unknown as CallHistoryQueryDTO;

      const calls = await this.callServ.getCallHistory(userId, {
        page: query.page,
        limit: query.limit,
      });

      res.status(200).json({
        success: true,
        data: calls,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET /api/calls/missed-count]
   * Đếm tổng số lượng cuộc gọi nhỡ chưa xử lý của người dùng hiện tại
   * Phản hồi HTTP 200 OK kèm đối tượng { count: number }
   */
  async getMissedCount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const count = await this.callServ.countMissed(userId);

      res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST /api/calls/device-tokens]
   * Đăng ký mới hoặc cập nhật token thiết bị phục vụ đẩy thông báo FCM
   * Phản hồi HTTP 201 Created kèm dữ liệu token thiết bị vừa lưu
   */
  async registerDeviceToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const body = req.body as DeviceTokenBodyDTO;

      const deviceToken = await this.deviceTokenRepo.upsert({
        userId,
        token: body.token,
        platform: body.platform,
      });

      res.status(201).json({
        success: true,
        data: deviceToken,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE /api/calls/device-tokens]
   * Hủy và xóa mã token thiết bị (khi người dùng đăng xuất hoặc tắt thông báo)
   * Phản hồi HTTP 200 OK
   */
  async removeDeviceToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const body = req.body as DeleteDeviceTokenDTO;

      await this.deviceTokenRepo.deleteByToken(body.token);

      res.status(200).json({
        success: true,
        message: "Mã token thiết bị đã được xóa thành công",
      });
    } catch (error) {
      next(error);
    }
  }
}

/** Thể hiện mặc định (Singleton) của CallController */
export const callController = new CallController();
