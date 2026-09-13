import {
  IConversationRepository,
  conversationRepository,
} from "../repositories/conversation.repository";
import { IUserRepository, userRepository } from "../repositories/user.repository";
import { IConversation } from "../models/conversation.model";
import { NotFoundError, ForbiddenError, ValidationError } from "../core/errors";

/**
 * Service xử lý các nghiệp vụ liên quan đến Cuộc trò chuyện (Conversation)
 */
export class ConversationService {
  constructor(
    private convRepo: IConversationRepository = conversationRepository,
    private userRepo: IUserRepository = userRepository
  ) {}

  /**
   * Tạo cuộc trò chuyện mới hoặc trả về cuộc trò chuyện trực tiếp sẵn có
   * 1. Hợp nhất ID người tạo và danh sách thành viên tham gia
   * 2. Rà soát tính hợp lệ theo loại cuộc trò chuyện (DIRECT hay GROUP)
   * 3. Kiểm tra tính tồn tại của tất cả người dùng tham gia
   * 4. Lưu bản ghi vào cơ sở dữ liệu
   */
  async createConversation(data: {
    title?: string;
    type: "DIRECT" | "GROUP";
    participantIds: string[];
    creatorId: string;
  }): Promise<IConversation> {
    // Bước 1: Khử trùng lặp danh sách ID thành viên (bao gồm cả người tạo)
    const allParticipants = Array.from(
      new Set([data.creatorId, ...data.participantIds])
    );

    // Bước 2: Kiểm tra ràng buộc theo loại trò chuyện
    if (data.type === "DIRECT") {
      // Cuộc trò chuyện 1-1 phải có chính xác 2 người
      if (allParticipants.length !== 2) {
        throw new ValidationError("Cuộc trò chuyện 1-1 bắt buộc phải có đúng 2 người tham gia");
      }

      // Kiểm tra nếu cuộc trò chuyện trực tiếp giữa 2 người này đã tồn tại thì tái sử dụng
      const existing = await this.convRepo.findDirectBetween(
        allParticipants[0],
        allParticipants[1]
      );
      if (existing) {
        return existing;
      }
    } else if (data.type === "GROUP") {
      // Nhóm trò chuyện phải có từ 2 thành viên trở lên
      if (allParticipants.length < 2) {
        throw new ValidationError("Nhóm trò chuyện phải có ít nhất 2 thành viên");
      }
      // Nhóm trò chuyện bắt buộc phải có tên/tiêu đề
      if (!data.title) {
        throw new ValidationError("Nhóm trò chuyện bắt buộc phải có tiêu đề");
      }
    }

    // Bước 3: Xác thực tất cả các ID thành viên đều là người dùng hợp lệ trong CSDL
    for (const pId of allParticipants) {
      const user = await this.userRepo.findById(pId);
      if (!user) {
        throw new NotFoundError(`Không tìm thấy người dùng với ID: ${pId}`);
      }
    }

    // Bước 4: Khởi tạo bản ghi cuộc trò chuyện mới trong CSDL
    return this.convRepo.create({
      title: data.title,
      type: data.type,
      participants: allParticipants,
      createdBy: data.creatorId,
    });
  }

  /**
   * Lấy danh sách các cuộc trò chuyện mà một người dùng tham gia
   */
  async getUserConversations(userId: string): Promise<IConversation[]> {
    return this.convRepo.findByUserId(userId);
  }

  /**
   * Lấy thông tin chi tiết cuộc trò chuyện và kiểm tra quyền thành viên
   */
  async getConversationById(conversationId: string, userId: string): Promise<IConversation> {
    // Bước 1: Tìm kiếm cuộc trò chuyện theo ID
    const conv = await this.convRepo.findById(conversationId);
    if (!conv) {
      throw new NotFoundError("Không tìm thấy cuộc trò chuyện");
    }

    // Bước 2: Kiểm tra người dùng có phải là thành viên trong cuộc trò chuyện không
    const isMember = conv.participants.some(
      (p) => (p as unknown as { _id?: string; id?: string }).id === userId || p.toString() === userId
    );

    // Bước 3: Nếu không phải thành viên, từ chối quyền truy cập
    if (!isMember) {
      throw new ForbiddenError("Bạn không có quyền truy cập cuộc trò chuyện này");
    }

    return conv;
  }
}

export const conversationService = new ConversationService();
