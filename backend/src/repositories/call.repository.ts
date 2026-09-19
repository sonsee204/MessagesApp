import { Types } from "mongoose";
import { CallModel, ICall, CallStatus, CallType } from "../models/call.model";

/**
 * Tham số đầu vào để tạo mới cuộc gọi
 */
export interface ICreateCallDTO {
  /** Mã định danh cuộc trò chuyện trực tiếp (DIRECT) */
  conversationId: string | Types.ObjectId;
  /** Mã định danh người gọi */
  callerId: string | Types.ObjectId;
  /** Mã định danh người nhận cuộc gọi */
  calleeId: string | Types.ObjectId;
  /** Loại cuộc gọi: thoại (audio) hoặc video */
  type: CallType;
}

/**
 * Dữ liệu bổ sung khi cập nhật trạng thái cuộc gọi
 */
export interface IUpdateCallStatusPatch {
  /** Thời điểm người nhận bắt máy */
  answeredAt?: Date;
  /** Thời điểm cuộc gọi kết thúc */
  endedAt?: Date;
  /** Tổng thời lượng đàm thoại tính theo giây */
  durationSec?: number;
}

/**
 * Tùy chọn phân trang khi truy vấn danh sách cuộc gọi
 */
export interface IPaginationOptions {
  /** Trang hiện tại (bắt đầu từ 1) */
  page?: number;
  /** Số bản ghi tối đa trên một trang */
  limit?: number;
}

/**
 * Giao diện Repository quản lý dữ liệu cuộc gọi (Call Repository Interface)
 */
export interface ICallRepository {
  /**
   * Tạo bản ghi cuộc gọi mới với trạng thái mặc định "ringing"
   */
  create(data: ICreateCallDTO): Promise<ICall>;

  /**
   * Tìm kiếm cuộc gọi theo mã ID
   */
  findById(id: string): Promise<ICall | null>;

  /**
   * Batch query nhiều cuộc gọi theo IDs (dùng $in để tránh N+1 query — backend.md §4)
   * @param ids Danh sách ID cần truy vấn
   */
  findByIds(ids: string[]): Promise<Map<string, ICall>>;

  /**
   * Cập nhật trạng thái cuộc gọi cùng các mốc thời gian liên quan
   */
  updateStatus(
    callId: string,
    status: CallStatus,
    patch?: IUpdateCallStatusPatch
  ): Promise<ICall | null>;

  /**
   * Lấy danh sách cuộc gọi gần đây của người dùng có phân trang
   */
  findRecentByUser(userId: string, options?: IPaginationOptions): Promise<ICall[]>;

  /**
   * Đếm số lượng cuộc gọi nhỡ (status: "missed") mà người dùng là caller hoặc callee
   */
  countMissed(userId: string): Promise<number>;
}

/**
 * Hiện thực ICallRepository sử dụng Mongoose ODM
 */
export class MongooseCallRepository implements ICallRepository {
  /**
   * Tạo bản ghi cuộc gọi mới trong MongoDB
   * - Trạng thái mặc định được gán là "ringing"
   * - Thời gian bắt đầu (startedAt) mặc định là thời điểm hiện tại
   */
  async create(data: ICreateCallDTO): Promise<ICall> {
    const conversationId =
      typeof data.conversationId === "string"
        ? new Types.ObjectId(data.conversationId)
        : data.conversationId;
    const callerId =
      typeof data.callerId === "string" ? new Types.ObjectId(data.callerId) : data.callerId;
    const calleeId =
      typeof data.calleeId === "string" ? new Types.ObjectId(data.calleeId) : data.calleeId;

    return CallModel.create({
      conversationId,
      callerId,
      calleeId,
      type: data.type,
      status: "ringing",
      startedAt: new Date(),
    });
  }

  /**
   * Tìm kiếm thông tin cuộc gọi theo ID
   */
  async findById(id: string): Promise<ICall | null> {
    return CallModel.findById(id).exec();
  }

  /**
   * Batch query nhiều cuộc gọi theo IDs — dùng $in để tránh N+1 query trong loop.
   * Trả về Map<string, ICall> phục vụ lookup nhanh (backend.md §4).
   * @param ids Danh sách ID cần truy vấn (tối đa 2 trong ngữ cảnh hiện tại)
   */
  async findByIds(ids: string[]): Promise<Map<string, ICall>> {
    if (ids.length === 0) return new Map();
    const calls = await CallModel.find({ _id: { $in: ids } }).exec();
    return new Map(calls.map((c) => [c._id.toString(), c]));
  }

  /**
   * Cập nhật trạng thái cuộc gọi và các mốc thời gian kèm theo (nếu có)
   * Trả về bản ghi cuộc gọi mới nhất sau khi cập nhật
   */
  async updateStatus(
    callId: string,
    status: CallStatus,
    patch?: IUpdateCallStatusPatch
  ): Promise<ICall | null> {
    return CallModel.findByIdAndUpdate(
      callId,
      {
        $set: {
          status,
          ...(patch?.answeredAt !== undefined && { answeredAt: patch.answeredAt }),
          ...(patch?.endedAt !== undefined && { endedAt: patch.endedAt }),
          ...(patch?.durationSec !== undefined && { durationSec: patch.durationSec }),
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Lấy danh sách các cuộc gọi gần đây của người dùng (là người gọi hoặc người nhận)
   * Sắp xếp theo startedAt giảm dần và bắt buộc áp dụng phân trang (skip/limit)
   */
  async findRecentByUser(
    userId: string,
    options: IPaginationOptions = {}
  ): Promise<ICall[]> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const skip = (page - 1) * limit;
    const userObjectId = new Types.ObjectId(userId);

    return CallModel.find({
      $or: [{ callerId: userObjectId }, { calleeId: userObjectId }],
    })
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  /**
   * Đếm tổng số cuộc gọi nhỡ (status == "missed") mà người dùng liên đới (caller hoặc callee)
   */
  async countMissed(userId: string): Promise<number> {
    const userObjectId = new Types.ObjectId(userId);
    return CallModel.countDocuments({
      status: "missed",
      $or: [{ callerId: userObjectId }, { calleeId: userObjectId }],
    }).exec();
  }
}

/** Thể hiện mặc định (Singleton) của MongooseCallRepository */
export const callRepository = new MongooseCallRepository();
