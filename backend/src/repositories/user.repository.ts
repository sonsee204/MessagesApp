import { UserModel, IUser } from "../models/user.model";

export interface IUserRepository {
  findById(id: string): Promise<IUser | null>;
  findByEmail(email: string, includePassword?: boolean): Promise<IUser | null>;
  findByUsername(username: string): Promise<IUser | null>;
  findByIdentifier(identifier: string, includePassword?: boolean): Promise<IUser | null>;
  create(userData: Partial<IUser>): Promise<IUser>;
  updateOnlineStatus(id: string, isOnline: boolean): Promise<IUser | null>;
  updateProfile(id: string, data: Partial<Pick<IUser, "displayName" | "avatarUrl" | "bannerUrl" | "bio" | "statusMessage">>): Promise<IUser | null>;
  /** Cập nhật riêng ảnh đại diện hoặc ảnh bìa sau khi tệp đã lưu thành công */
  updateImage(id: string, field: "avatarUrl" | "bannerUrl", url: string | null): Promise<IUser | null>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  searchUsers(keyword: string, currentUserId: string, page: number, limit: number): Promise<{ users: IUser[]; total: number }>;
}

export class MongooseUserRepository implements IUserRepository {
  async findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id).exec();
  }

  async findByEmail(email: string, includePassword = false): Promise<IUser | null> {
    const query = UserModel.findOne({ email: email.toLowerCase().trim() });
    if (includePassword) {
      query.select("+passwordHash");
    }
    return query.exec();
  }

  async findByUsername(username: string): Promise<IUser | null> {
    return UserModel.findOne({ username: username.toLowerCase().trim() }).exec();
  }

  /**
   * Tìm kiếm người dùng theo Email hoặc Username
   * Hỗ trợ lấy kèm trường mật khẩu băm (passwordHash) khi cần xác thực
   */
  async findByIdentifier(identifier: string, includePassword = false): Promise<IUser | null> {
    const clean = identifier.toLowerCase().trim();
    const query = UserModel.findOne({
      $or: [{ email: clean }, { username: clean }],
    });
    if (includePassword) {
      query.select("+passwordHash");
    }
    return query.exec();
  }

  async create(userData: Partial<IUser>): Promise<IUser> {
    return UserModel.create(userData);
  }

  async updateOnlineStatus(id: string, isOnline: boolean): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { isOnline, lastSeenAt: new Date() },
      { new: true }
    ).exec();
  }

  async updateProfile(
    id: string,
    data: Partial<Pick<IUser, "displayName" | "avatarUrl" | "bannerUrl" | "bio" | "statusMessage">>
  ): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }

  /**
   * Cập nhật riêng một trường ảnh (avatarUrl hoặc bannerUrl).
   * Tách khỏi updateProfile vì luồng tải ảnh không đi qua middleware validate,
   * và cần đọc URL cũ trước đó để dọn tệp.
   */
  async updateImage(
    id: string,
    field: "avatarUrl" | "bannerUrl",
    url: string | null
  ): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, { $set: { [field]: url } }, { new: true }).exec();
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await UserModel.findByIdAndUpdate(id, { $set: { passwordHash } }).exec();
  }

  async searchUsers(
    keyword: string,
    currentUserId: string,
    page: number,
    limit: number
  ): Promise<{ users: IUser[]; total: number }> {
    const regex = new RegExp(keyword.trim(), "i");
    const query = {
      _id: { $ne: currentUserId },
      $or: [{ username: regex }, { displayName: regex }, { email: regex }],
    };

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      UserModel.find(query).skip(skip).limit(limit).exec(),
      UserModel.countDocuments(query).exec(),
    ]);

    return { users, total };
  }
}

export const userRepository = new MongooseUserRepository();
