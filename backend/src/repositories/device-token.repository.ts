import { Types } from "mongoose";
import {
  DeviceTokenModel,
  IDeviceToken,
  DevicePlatform,
} from "../models/device-token.model";

/**
 * Tham số đầu vào để tạo hoặc cập nhật mã token thiết bị
 */
export interface IUpsertDeviceTokenDTO {
  /** Mã định danh người dùng sở hữu thiết bị */
  userId: string | Types.ObjectId;
  /** Nền tảng thiết bị (web, android, ios) */
  platform: DevicePlatform;
  /** Chuỗi token định danh thiết bị */
  token: string;
}

/**
 * Giao diện Repository quản lý mã token thiết bị (Device Token Repository Interface)
 */
export interface IDeviceTokenRepository {
  /**
   * Thêm mới hoặc cập nhật token thiết bị nếu token đã tồn tại
   */
  upsert(data: IUpsertDeviceTokenDTO): Promise<IDeviceToken>;

  /**
   * Xóa bản ghi token thiết bị theo mã token
   */
  deleteByToken(token: string): Promise<void>;

  /**
   * Tìm danh sách tất cả các token thiết bị của một người dùng
   */
  findByUserId(userId: string): Promise<IDeviceToken[]>;
}

/**
 * Hiện thực IDeviceTokenRepository sử dụng Mongoose ODM
 */
export class MongooseDeviceTokenRepository implements IDeviceTokenRepository {
  /**
   * Thêm mới hoặc cập nhật mã token thiết bị trong MongoDB
   * - Tìm kiếm theo trường duy nhất `token`
   * - Nếu tìm thấy: cập nhật `userId`, `platform`
   * - Nếu chưa có: tạo mới với `upsert: true, setDefaultsOnInsert: true`
   * - Trả về bản ghi mới sau khi cập nhật (`new: true`)
   */
  async upsert(data: IUpsertDeviceTokenDTO): Promise<IDeviceToken> {
    const userObjectId =
      typeof data.userId === "string" ? new Types.ObjectId(data.userId) : data.userId;

    const document = await DeviceTokenModel.findOneAndUpdate(
      { token: data.token },
      {
        $set: {
          userId: userObjectId,
          platform: data.platform,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    if (!document) {
      throw new Error("Không thể tạo hoặc cập nhật mã token thiết bị");
    }

    return document;
  }

  /**
   * Xóa tất cả các bản ghi có mã token tương ứng (một thiết bị đăng xuất hoặc hủy token)
   */
  async deleteByToken(token: string): Promise<void> {
    await DeviceTokenModel.deleteMany({ token }).exec();
  }

  /**
   * Lấy danh sách token thiết bị của một người dùng phục vụ gửi Push Notification đa thiết bị
   */
  async findByUserId(userId: string): Promise<IDeviceToken[]> {
    const userObjectId = new Types.ObjectId(userId);
    return DeviceTokenModel.find({ userId: userObjectId }).exec();
  }
}

/** Thể hiện mặc định (Singleton) của MongooseDeviceTokenRepository */
export const deviceTokenRepository = new MongooseDeviceTokenRepository();
