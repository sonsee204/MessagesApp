import { create } from "zustand";
import {
  Conversation,
  Message,
  CreateConversationPayload,
  SendMessagePayload,
  MessageType,
  MessageAttachment,
} from "../../../types/chat.types";
import { chatService } from "../services/chat.service";
import { formatApiError } from "../../../lib/error-formatter";

/**
 * Trạng thái phân trang tin nhắn cho từng cuộc hội thoại
 * nextCursor giữ nguyên khả năng nhận null từ API Backend (đã hết tin nhắn)
 */
export interface ConversationPagination {
  nextCursor?: string | null;
  hasMore: boolean;
  isLoading: boolean;
}

/**
 * Interface định nghĩa Trạng thái và các Hành động của Chat Store
 */
export interface ChatState {
  // Danh sách các cuộc trò chuyện đã tham gia
  conversations: Conversation[];
  // ID của cuộc trò chuyện đang được chọn mở trên giao diện
  activeConversationId: string | null;
  // Trạng thái đang tải danh sách cuộc trò chuyện
  isLoadingConversations: boolean;

  // Bản đồ lưu trữ lịch sử tin nhắn theo ID cuộc trò chuyện (conversationId -> Message[])
  // Sắp xếp theo thứ tự thời gian tăng dần (cũ nhất ở đầu, mới nhất ở cuối mảng)
  messages: Record<string, Message[]>;
  // Bản đồ lưu trạng thái phân trang của từng cuộc trò chuyện
  pagination: Record<string, ConversationPagination>;

  // Bản đồ theo dõi danh sách người dùng đang soạn tin (conversationId -> User[])
  typingUsers: Record<string, Array<{ userId: string; username: string }>>;

  // Bản đồ lưu trữ trạng thái trực tuyến của người dùng (userId -> boolean)
  onlineUsers: Record<string, boolean>;

  // Trạng thái đang gửi tin nhắn
  isSendingMessage: boolean;
  // Thông báo lỗi nếu có
  error: string | null;

  // === CÁC HÀNH ĐỘNG (ACTIONS) ===

  // Tải danh sách tất cả các cuộc trò chuyện từ máy chủ
  fetchConversations: () => Promise<void>;

  // Chọn cuộc trò chuyện để hiển thị trên màn hình chat chính
  selectConversation: (conversationId: string | null) => Promise<void>;

  // Tải lịch sử tin nhắn của cuộc trò chuyện (hỗ trợ phân trang cuộn lên để tải tin nhắn cũ hơn)
  fetchMessages: (conversationId: string, loadOlder?: boolean) => Promise<void>;

  // Gửi tin nhắn mới vào cuộc trò chuyện đang chọn (kèm tệp đính kèm sticker/GIF nếu có)
  sendMessage: (
    conversationId: string,
    content: string,
    type?: MessageType,
    attachments?: MessageAttachment[]
  ) => Promise<Message | null>;

  // Khởi tạo cuộc trò chuyện mới (Trực tiếp hoặc Nhóm)
  createConversation: (payload: CreateConversationPayload) => Promise<Conversation | null>;

  // Xử lý khi nhận tin nhắn mới từ Socket.IO (đồng bộ hóa thời gian thực)
  addIncomingMessage: (message: Message) => void;

  // Cập nhật trạng thái người dùng đang soạn tin (Typing Indicator)
  setUserTyping: (
    conversationId: string,
    user: { userId: string; username: string },
    isTyping: boolean
  ) => void;

  // Cập nhật trạng thái trực tuyến/ngoại tuyến của một người dùng
  setUserOnlineStatus: (userId: string, isOnline: boolean) => void;

  // Đánh dấu cuộc hội thoại đã đọc (xóa số đếm unreadCount)
  markAsRead: (conversationId: string) => void;

  // Thu hồi một tin nhắn do chính mình gửi (cập nhật cả server lẫn bộ nhớ cục bộ)
  recallMessage: (conversationId: string, messageId: string) => Promise<void>;

  // Áp dụng trạng thái thu hồi nhận từ Socket.IO (không gọi lại API)
  applyMessageRecalled: (conversationId: string, messageId: string) => void;

  // Áp dụng trạng thái đã đọc của một thành viên nhận từ Socket.IO
  applyMessagesRead: (conversationId: string, userId: string) => void;

  // Xóa sạch toàn bộ dữ liệu trong Chat Store (dùng khi người dùng đăng xuất)
  clearChatStore: () => void;
}

/**
 * Zustand Store trung tâm quản lý toàn bộ trạng thái Tin nhắn & Hội thoại thời gian thực
 */
export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isLoadingConversations: false,
  messages: {},
  pagination: {},
  typingUsers: {},
  onlineUsers: {},
  isSendingMessage: false,
  error: null,

  /**
   * 1. Tải danh sách các cuộc trò chuyện của người dùng hiện tại
   */
  fetchConversations: async () => {
    try {
      set({ isLoadingConversations: true, error: null });
      const conversations = await chatService.getConversations();
      set({ conversations, isLoadingConversations: false });
    } catch (err: unknown) {
      const errorMessage = formatApiError(err, "Lỗi khi tải danh sách hội thoại");
      set({ error: errorMessage, isLoadingConversations: false });
    }
  },

  /**
   * 2. Chọn một cuộc trò chuyện để hiển thị
   * Đồng thời xóa huy hiệu tin nhắn chưa đọc và tự động tải tin nhắn nếu chưa có
   */
  selectConversation: async (conversationId: string | null) => {
    set({ activeConversationId: conversationId });

    if (!conversationId) return;

    // Đánh dấu đã đọc cho cuộc hội thoại này
    get().markAsRead(conversationId);

    // Nếu chưa có tin nhắn nào của cuộc trò chuyện này trong bộ nhớ, tiến hành tải trang đầu tiên
    const currentMessages = get().messages[conversationId];
    if (!currentMessages || currentMessages.length === 0) {
      await get().fetchMessages(conversationId, false);
    }
  },

  /**
   * 3. Tải lịch sử tin nhắn với phân trang con trỏ (Cursor-based Pagination)
   * @param conversationId ID cuộc trò chuyện
   * @param loadOlder true nếu tải thêm tin nhắn cũ hơn, false nếu tải trang đầu tiên mới nhất
   */
  fetchMessages: async (conversationId: string, loadOlder = false) => {
    const currentPagination = get().pagination[conversationId] || {
      hasMore: true,
      isLoading: false,
    };

    // Ngăn chặn gọi trùng lặp nếu đang tải hoặc đã hết tin nhắn cũ
    if (currentPagination.isLoading || (loadOlder && !currentPagination.hasMore)) {
      return;
    }

    // Đánh dấu đang tải tin nhắn cho cuộc trò chuyện này
    set((state) => ({
      pagination: {
        ...state.pagination,
        [conversationId]: {
          ...currentPagination,
          isLoading: true,
        },
      },
    }));

    try {
      // Con trỏ lấy từ kết quả trang trước nếu đang tải tin cũ hơn (chuẩn hóa null → undefined)
      const cursor = loadOlder ? currentPagination.nextCursor ?? undefined : undefined;
      const data = await chatService.getMessages(conversationId, cursor, 20);

      // Lưu ý: Backend trả về tin nhắn được sắp xếp giảm dần theo thời gian (createdAt: -1)
      // Khi hiển thị giao diện chat, ta cần sắp xếp tăng dần (tin cũ ở trên, tin mới ở dưới)
      const formattedBatch = [...data.messages].reverse();

      set((state) => {
        const existingMessages = state.messages[conversationId] || [];
        let updatedMessages: Message[];

        if (loadOlder) {
          // Khi tải tin cũ: Ghép các tin cũ vào đầu danh sách hiện tại
          // Lọc trùng lặp ID để đảm bảo tính duy nhất
          const existingIds = new Set(existingMessages.map((m) => m.id));
          const uniqueOlder = formattedBatch.filter((m) => !existingIds.has(m.id));
          updatedMessages = [...uniqueOlder, ...existingMessages];
        } else {
          // Khi tải lần đầu: Thay thế bằng mảng tin nhắn mới nhất
          updatedMessages = formattedBatch;
        }

        return {
          messages: {
            ...state.messages,
            [conversationId]: updatedMessages,
          },
          pagination: {
            ...state.pagination,
            [conversationId]: {
              nextCursor: data.nextCursor,
              hasMore: data.hasMore,
              isLoading: false,
            },
          },
        };
      });
    } catch (err: unknown) {
      const errorMessage = formatApiError(err, "Lỗi khi tải lịch sử tin nhắn");
      set((state) => ({
        error: errorMessage,
        pagination: {
          ...state.pagination,
          [conversationId]: {
            ...currentPagination,
            isLoading: false,
          },
        },
      }));
    }
  },

  /**
   * 4. Gửi tin nhắn mới vào cuộc trò chuyện
   */
  sendMessage: async (
    conversationId: string,
    content: string,
    type: MessageType = "TEXT",
    attachments?: MessageAttachment[]
  ) => {
    // Tin nhắn hợp lệ khi có chữ OR có tệp đính kèm (đúng ràng buộc Backend: content || attachments)
    if (!content.trim() && !(attachments && attachments.length > 0)) return null;

    try {
      set({ isSendingMessage: true, error: null });

      const payload: SendMessagePayload = {
        content: content.trim(),
        type,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      };

      // Gửi tin nhắn qua REST API
      const savedMessage = await chatService.sendMessage(conversationId, payload);

      // Thêm tin nhắn vào danh sách tin nhắn hiện tại
      get().addIncomingMessage(savedMessage);

      set({ isSendingMessage: false });
      return savedMessage;
    } catch (err: unknown) {
      const errorMessage = formatApiError(err, "Không thể gửi tin nhắn");
      set({ error: errorMessage, isSendingMessage: false });
      return null;
    }
  },

  /**
   * 5. Khởi tạo một cuộc trò chuyện mới
   */
  createConversation: async (payload: CreateConversationPayload) => {
    try {
      set({ error: null });
      const newConversation = await chatService.createConversation(payload);

      set((state) => {
        // Kiểm tra xem cuộc trò chuyện này đã có trong danh sách chưa
        const exists = state.conversations.some((c) => c.id === newConversation.id);
        const updatedList = exists
          ? state.conversations.map((c) => (c.id === newConversation.id ? newConversation : c))
          : [newConversation, ...state.conversations];

        return {
          conversations: updatedList,
          activeConversationId: newConversation.id,
        };
      });

      return newConversation;
    } catch (err: unknown) {
      const errorMessage = formatApiError(err, "Không thể tạo cuộc trò chuyện mới");
      set({ error: errorMessage });
      return null;
    }
  },

  /**
   * 6. Tiếp nhận tin nhắn mới từ máy chủ (thông qua Socket.IO hoặc phản hồi gửi tin)
   * Tự động đưa cuộc trò chuyện lên vị trí đầu danh sách và cập nhật lastMessage
   */
  addIncomingMessage: (message: Message) => {
    const { conversationId } = message;

    set((state) => {
      // A. Cập nhật mảng tin nhắn của cuộc trò chuyện tương ứng
      const currentMessages = state.messages[conversationId] || [];
      // Khử trùng lặp tin nhắn nếu đã tồn tại
      const isDuplicate = currentMessages.some((m) => m.id === message.id);
      const updatedMessages = isDuplicate
        ? currentMessages
        : [...currentMessages, message];

      // B. Cập nhật danh sách cuộc hội thoại: đưa cuộc trò chuyện có tin nhắn mới lên đầu
      const isCurrentActive = state.activeConversationId === conversationId;
      let targetConversation: Conversation | undefined;
      const otherConversations: Conversation[] = [];

      state.conversations.forEach((conv) => {
        if (conv.id === conversationId) {
          targetConversation = {
            ...conv,
            lastMessage: message,
            lastMessageAt: message.createdAt,
            // Nếu không phải cuộc hội thoại đang mở, tăng số tin chưa đọc lên 1
            unreadCount: isCurrentActive ? 0 : (conv.unreadCount || 0) + 1,
          };
        } else {
          otherConversations.push(conv);
        }
      });

      // Tạo danh sách cuộc hội thoại mới với cuộc trò chuyện vừa nhận tin đặt ở vị trí đầu
      const updatedConversations = targetConversation
        ? [targetConversation, ...otherConversations]
        : state.conversations;

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
        conversations: updatedConversations,
      };
    });
  },

  /**
   * 7. Cập nhật trạng thái người dùng đang soạn tin (Typing Indicator)
   */
  setUserTyping: (conversationId, user, isTyping) => {
    set((state) => {
      const currentList = state.typingUsers[conversationId] || [];
      let updatedList: Array<{ userId: string; username: string }>;

      if (isTyping) {
        // Nếu đang gõ, thêm vào danh sách nếu chưa có
        const exists = currentList.some((u) => u.userId === user.userId);
        updatedList = exists ? currentList : [...currentList, user];
      } else {
        // Nếu đã dừng gõ, loại bỏ khỏi danh sách
        updatedList = currentList.filter((u) => u.userId !== user.userId);
      }

      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: updatedList,
        },
      };
    });
  },

  /**
   * 8. Cập nhật trạng thái trực tuyến / ngoại tuyến của người dùng
   */
  setUserOnlineStatus: (userId: string, isOnline: boolean) => {
    set((state) => ({
      onlineUsers: {
        ...state.onlineUsers,
        [userId]: isOnline,
      },
    }));
  },

  /**
   * 9. Đánh dấu cuộc trò chuyện là đã đọc
   */
  markAsRead: (conversationId: string) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      ),
    }));

    // Đồng bộ trạng thái đã đọc lên server để các thành viên khác thấy (fire-and-forget)
    void chatService.markAsRead(conversationId);
  },

  /**
   * 11. Thu hồi tin nhắn do chính mình gửi
   * Gọi API trước, chỉ cập nhật giao diện khi server xác nhận thành công
   */
  recallMessage: async (conversationId, messageId) => {
    try {
      await chatService.recallMessage(conversationId, messageId);
      get().applyMessageRecalled(conversationId, messageId);
    } catch (err: unknown) {
      const errorMessage = formatApiError(err, "Không thể thu hồi tin nhắn");
      set({ error: errorMessage });
    }
  },

  /**
   * 12. Áp dụng trạng thái thu hồi tin nhắn vào bộ nhớ cục bộ
   * Nội dung tin nhắn bị xóa khỏi giao diện nhưng bản ghi vẫn giữ để không phá vỡ thứ tự hiển thị
   */
  applyMessageRecalled: (conversationId, messageId) => {
    set((state) => {
      const currentMessages = state.messages[conversationId];
      if (!currentMessages) return state;

      return {
        messages: {
          ...state.messages,
          [conversationId]: currentMessages.map((m) =>
            m.id === messageId ? { ...m, isDeleted: true, content: "" } : m
          ),
        },
      };
    });
  },

  /**
   * 13. Áp dụng trạng thái đã đọc của một thành viên nhận từ Socket.IO
   * Thêm userId vào `readBy` của mọi tin nhắn trong cuộc trò chuyện mà họ chưa có trong danh sách
   */
  applyMessagesRead: (conversationId, userId) => {
    set((state) => {
      const currentMessages = state.messages[conversationId];
      if (!currentMessages) return state;

      return {
        messages: {
          ...state.messages,
          [conversationId]: currentMessages.map((m) =>
            m.readBy?.includes(userId) ? m : { ...m, readBy: [...(m.readBy || []), userId] }
          ),
        },
      };
    });
  },

  /**
   * 10. Xóa sạch toàn bộ dữ liệu trong Chat Store (dùng khi đăng xuất)
   */
  clearChatStore: () => {
    set({
      conversations: [],
      activeConversationId: null,
      isLoadingConversations: false,
      messages: {},
      pagination: {},
      typingUsers: {},
      onlineUsers: {},
      isSendingMessage: false,
      error: null,
    });
  },
}));
