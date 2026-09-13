import { create } from "zustand";
import {
  FriendItem,
  FriendRequestItem,
  BlockedUserItem,
  FriendsTab,
  FriendQueryOptions,
  PaginationOptions,
} from "../types/friend.types";
import { friendService } from "../services/friend.service";
import { getSocket } from "../../../lib/socket";
import { toast } from "../../../stores/toast.store";

/**
 * Cờ cấp module đánh dấu các listener Socket.IO của Friend Store đã được đăng ký hay chưa.
 * useChatSocket có thể gọi initSocketListeners() nhiều lần trên cùng một socket singleton
 * (effect chạy lại khi isAuthenticated/accessToken đổi), nếu không chặn sẽ khiến handler
 * bị xếp chồng và toast bắn lặp một lần cho mỗi lần đăng ký.
 * Cờ được bật khi đăng ký và tắt khi cleanup, nhờ đó một lần reconnect thật sự vẫn đăng ký lại được.
 */
let friendSocketListenersRegistered = false;

/**
 * Interface định nghĩa Trạng thái và Hành động của Friend Store
 */
export interface FriendState {
  // Danh sách bạn bè hiện tại
  friends: FriendItem[];
  // Danh sách lời mời kết bạn nhận được
  receivedRequests: FriendRequestItem[];
  // Danh sách lời mời kết bạn đã gửi đi
  sentRequests: FriendRequestItem[];
  // Danh sách người dùng bị chặn
  blockedUsers: BlockedUserItem[];
  // Tab đang hoạt động trên màn hình quản lý bạn bè
  activeTab: FriendsTab;
  // Trạng thái tải dữ liệu
  isLoading: boolean;
  // Thông báo lỗi khi tải dữ liệu thất bại (null nghĩa là không có lỗi)
  error: string | null;
  // Từ khóa tìm kiếm bạn bè
  searchQuery: string;

  // === CÁC HÀNH ĐỘNG TẢI DỮ LIỆU ===
  // Các hàm fetch trả về true nếu tải thành công, false nếu thất bại (để fetchAll tổng hợp lỗi)
  fetchFriends: (options?: FriendQueryOptions) => Promise<boolean>;
  fetchReceivedRequests: (options?: PaginationOptions) => Promise<boolean>;
  fetchSentRequests: (options?: PaginationOptions) => Promise<boolean>;
  fetchBlockedUsers: (options?: PaginationOptions) => Promise<boolean>;
  fetchAll: () => Promise<void>;
  setActiveTab: (tab: FriendsTab) => void;
  setSearchQuery: (query: string) => void;

  // === CÁC HÀNH ĐỘNG THAO TÁC NGHIỆP VỤ ===
  sendFriendRequest: (receiverId: string, note?: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  cancelFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (targetUserId: string) => Promise<void>;
  blockUser: (targetUserId: string) => Promise<void>;
  unblockUser: (targetUserId: string) => Promise<void>;

  // === ĐỒNG BỘ SOCKET.IO THỜI GIAN THỰC ===
  initSocketListeners: () => () => void;
}

/**
 * Zustand Store quản lý toàn diện Subsystem Bạn bè
 */
export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  receivedRequests: [],
  sentRequests: [],
  blockedUsers: [],
  activeTab: "online",
  isLoading: false,
  error: null,
  searchQuery: "",

  /**
   * Tải danh sách bạn bè từ Backend
   * @returns true nếu tải thành công, false nếu thất bại (lỗi được ghi nhận, không ném ra ngoài)
   */
  fetchFriends: async (options?: FriendQueryOptions) => {
    try {
      const data = await friendService.getFriends(options);
      set({ friends: data.items });
      return true;
    } catch (error) {
      console.error("Lỗi khi tải danh sách bạn bè:", error);
      return false;
    }
  },

  /**
   * Tải danh sách lời mời kết bạn nhận được
   * @returns true nếu tải thành công, false nếu thất bại
   */
  fetchReceivedRequests: async (options?: PaginationOptions) => {
    try {
      const data = await friendService.getReceivedRequests(options);
      set({ receivedRequests: data.items });
      return true;
    } catch (error) {
      console.error("Lỗi khi tải lời mời nhận được:", error);
      return false;
    }
  },

  /**
   * Tải danh sách lời mời kết bạn đã gửi
   * @returns true nếu tải thành công, false nếu thất bại
   */
  fetchSentRequests: async (options?: PaginationOptions) => {
    try {
      const data = await friendService.getSentRequests(options);
      set({ sentRequests: data.items });
      return true;
    } catch (error) {
      console.error("Lỗi khi tải lời mời đã gửi:", error);
      return false;
    }
  },

  /**
   * Tải danh sách người dùng bị chặn
   * @returns true nếu tải thành công, false nếu thất bại
   */
  fetchBlockedUsers: async (options?: PaginationOptions) => {
    try {
      const data = await friendService.getBlockedUsers(options);
      set({ blockedUsers: data.items });
      return true;
    } catch (error) {
      console.error("Lỗi khi tải danh sách chặn:", error);
      return false;
    }
  },

  /**
   * Tải đồng thời tất cả các nhóm dữ liệu để chuẩn bị cho màn hình FriendsView.
   * Nếu BẤT KỲ nhóm nào tải thất bại, ghi nhận thông báo lỗi vào state để giao diện
   * hiển thị trạng thái Error + nút "Thử lại" thay vì hiển thị nhầm trạng thái rỗng.
   */
  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const results = await Promise.all([
        get().fetchFriends(),
        get().fetchReceivedRequests(),
        get().fetchSentRequests(),
        get().fetchBlockedUsers(),
      ]);
      // Chỉ cần 1 trong 4 nhóm thất bại là hiển thị trạng thái lỗi
      set({
        error: results.every(Boolean)
          ? null
          : "Không thể tải dữ liệu bạn bè. Vui lòng kiểm tra kết nối mạng và thử lại.",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Thay đổi tab hiển thị hiện tại
   */
  setActiveTab: (tab: FriendsTab) => set({ activeTab: tab }),

  /**
   * Thay đổi từ khóa tìm kiếm bạn bè
   */
  setSearchQuery: (query: string) => set({ searchQuery: query }),

  /**
   * Gửi lời mời kết bạn
   */
  sendFriendRequest: async (receiverId: string, note?: string) => {
    try {
      await friendService.sendFriendRequest(receiverId, note);
      toast.success("Đã gửi lời mời kết bạn thành công!");
      await get().fetchSentRequests();
    } catch (error: any) {
      toast.error(error.message || "Không thể gửi lời mời kết bạn.");
      throw error;
    }
  },

  /**
   * Chấp nhận lời mời kết bạn
   */
  acceptFriendRequest: async (requestId: string) => {
    try {
      await friendService.acceptFriendRequest(requestId);
      // Cập nhật ngay lập tức: loại bỏ lời mời khỏi danh sách nhận
      set((state) => ({
        receivedRequests: state.receivedRequests.filter(
          (req) => (req._id || req.id) !== requestId
        ),
      }));
      toast.success("Đã chấp nhận lời mời kết bạn!");
      await get().fetchFriends();
    } catch (error: any) {
      toast.error(error.message || "Không thể chấp nhận lời mời kết bạn.");
      throw error;
    }
  },

  /**
   * Từ chối lời mời kết bạn
   */
  rejectFriendRequest: async (requestId: string) => {
    try {
      await friendService.rejectFriendRequest(requestId);
      set((state) => ({
        receivedRequests: state.receivedRequests.filter(
          (req) => (req._id || req.id) !== requestId
        ),
      }));
      toast.info("Đã từ chối lời mời kết bạn.");
    } catch (error: any) {
      toast.error(error.message || "Không thể từ chối lời mời kết bạn.");
      throw error;
    }
  },

  /**
   * Hủy lời mời kết bạn đã gửi đi
   */
  cancelFriendRequest: async (requestId: string) => {
    try {
      await friendService.cancelFriendRequest(requestId);
      set((state) => ({
        sentRequests: state.sentRequests.filter(
          (req) => (req._id || req.id) !== requestId
        ),
      }));
      toast.info("Đã hủy lời mời kết bạn.");
    } catch (error: any) {
      toast.error(error.message || "Không thể hủy lời mời kết bạn.");
      throw error;
    }
  },

  /**
   * Hủy kết bạn (Unfriend)
   */
  removeFriend: async (targetUserId: string) => {
    try {
      await friendService.removeFriend(targetUserId);
      set((state) => ({
        friends: state.friends.filter((f) => f.user.id !== targetUserId),
      }));
      toast.info("Đã hủy kết bạn thành công.");
    } catch (error: any) {
      toast.error(error.message || "Không thể hủy kết bạn.");
      throw error;
    }
  },

  /**
   * Chặn người dùng (Block)
   */
  blockUser: async (targetUserId: string) => {
    try {
      await friendService.blockUser(targetUserId);
      set((state) => ({
        friends: state.friends.filter((f) => f.user.id !== targetUserId),
        receivedRequests: state.receivedRequests.filter((r) => {
          const sId = typeof r.senderId === "object" ? r.senderId._id || r.senderId.id : r.senderId;
          return sId !== targetUserId;
        }),
        sentRequests: state.sentRequests.filter((r) => {
          const rId = typeof r.receiverId === "object" ? r.receiverId._id || r.receiverId.id : r.receiverId;
          return rId !== targetUserId;
        }),
      }));
      toast.warning("Đã chặn người dùng này.");
      await get().fetchBlockedUsers();
    } catch (error: any) {
      toast.error(error.message || "Không thể chặn người dùng.");
      throw error;
    }
  },

  /**
   * Bỏ chặn người dùng (Unblock)
   */
  unblockUser: async (targetUserId: string) => {
    try {
      await friendService.unblockUser(targetUserId);
      set((state) => ({
        blockedUsers: state.blockedUsers.filter((b) => {
          const bId = typeof b.blockedId === "object" ? b.blockedId._id || b.blockedId.id : b.blockedId;
          return bId !== targetUserId;
        }),
      }));
      toast.success("Đã bỏ chặn người dùng.");
    } catch (error: any) {
      toast.error(error.message || "Không thể bỏ chặn người dùng.");
      throw error;
    }
  },

  /**
   * Đăng ký lắng nghe các sự kiện Socket.IO thời gian thực để đồng bộ dữ liệu
   */
  initSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return () => {};

    // Chống đăng ký trùng: socket là singleton nên nếu effect của useChatSocket chạy lại
    // mà không dọn dẹp trước, handler sẽ bị xếp chồng và toast bắn lặp.
    // Trả về hàm no-op để caller không vô tình gỡ listener của lần đăng ký đang hoạt động.
    if (friendSocketListenersRegistered) return () => {};
    friendSocketListenersRegistered = true;

    // 1. Nhận lời mời kết bạn mới
    const handleRequestReceived = (request: FriendRequestItem) => {
      set((state) => {
        const reqId = request._id || request.id;
        const exists = state.receivedRequests.some((r) => (r._id || r.id) === reqId);
        if (exists) return state;
        return { receivedRequests: [request, ...state.receivedRequests] };
      });
      const sender = typeof request.senderId === "object" ? request.senderId : null;
      const name = sender?.displayName || sender?.username || "Một người dùng";
      toast.info(`${name} đã gửi cho bạn lời mời kết bạn.`, "Lời mời kết bạn mới");
    };

    // 2. Lời mời kết bạn được chấp nhận
    const handleRequestAccepted = (payload: { friendshipId: string; friend: any; acceptedAt: string }) => {
      if (payload.friend) {
        const friendId = payload.friend.id || payload.friend._id;
        const newFriend: FriendItem = {
          friendshipId: payload.friendshipId,
          friendSince: payload.acceptedAt || new Date().toISOString(),
          user: {
            id: friendId,
            username: payload.friend.username,
            displayName: payload.friend.displayName,
            avatarUrl: payload.friend.avatarUrl,
            bio: payload.friend.bio,
            isOnline: payload.friend.isOnline ?? false,
            lastSeenAt: payload.friend.lastSeenAt,
          },
        };

        set((state) => ({
          friends: [newFriend, ...state.friends.filter((f) => f.user.id !== friendId)],
          sentRequests: state.sentRequests.filter((r) => {
            const rId = typeof r.receiverId === "object" ? r.receiverId._id || r.receiverId.id : r.receiverId;
            return rId !== friendId;
          }),
          receivedRequests: state.receivedRequests.filter((r) => {
            const sId = typeof r.senderId === "object" ? r.senderId._id || r.senderId.id : r.senderId;
            return sId !== friendId;
          }),
        }));

        const friendName = payload.friend.displayName || payload.friend.username || "Bạn bè";
        toast.success(`${friendName} đã trở thành bạn bè với bạn!`, "Kết bạn thành công");
      }
    };

    // 3. Lời mời kết bạn bị từ chối
    const handleRequestRejected = (payload: { requestId: string; receiverId: string }) => {
      set((state) => ({
        sentRequests: state.sentRequests.filter(
          (r) => (r._id || r.id) !== payload.requestId
        ),
      }));
    };

    // 4. Lời mời kết bạn bị hủy bởi người gửi
    const handleRequestCanceled = (payload: { requestId: string; senderId: string }) => {
      set((state) => ({
        receivedRequests: state.receivedRequests.filter(
          (r) => (r._id || r.id) !== payload.requestId
        ),
      }));
    };

    // 5. Bị hủy quan hệ bạn bè
    const handleFriendRemoved = (payload: { userId: string }) => {
      set((state) => ({
        friends: state.friends.filter((f) => f.user.id !== payload.userId),
      }));
    };

    // 6. Bị chặn bởi người dùng khác.
    // GUARD: chỉ đồng bộ danh bạ/lời mời, TUYỆT ĐỐI không đụng vào chat store
    // (không tự đóng cuộc hội thoại). Giao diện chat tự hiển thị trạng thái bị chặn.
    const handleFriendBlocked = (payload: { blockerId: string }) => {
      set((state) => ({
        friends: state.friends.filter((f) => f.user.id !== payload.blockerId),
        receivedRequests: state.receivedRequests.filter((r) => {
          const sId = typeof r.senderId === "object" ? r.senderId._id || r.senderId.id : r.senderId;
          return sId !== payload.blockerId;
        }),
        sentRequests: state.sentRequests.filter((r) => {
          const rId = typeof r.receiverId === "object" ? r.receiverId._id || r.receiverId.id : r.receiverId;
          return rId !== payload.blockerId;
        }),
      }));
    };

    socket.on("friend:request_received", handleRequestReceived);
    socket.on("friend:request_accepted", handleRequestAccepted);
    socket.on("friend:request_rejected", handleRequestRejected);
    socket.on("friend:request_canceled", handleRequestCanceled);
    socket.on("friend:removed", handleFriendRemoved);
    socket.on("friend:blocked", handleFriendBlocked);

    return () => {
      // Gỡ TOÀN BỘ handler đã đăng ký để một lần reconnect thật sự có thể đăng ký lại từ đầu
      socket.off("friend:request_received", handleRequestReceived);
      socket.off("friend:request_accepted", handleRequestAccepted);
      socket.off("friend:request_rejected", handleRequestRejected);
      socket.off("friend:request_canceled", handleRequestCanceled);
      socket.off("friend:removed", handleFriendRemoved);
      socket.off("friend:blocked", handleFriendBlocked);
      // Mở lại cờ để lần đăng ký kế tiếp (sau reconnect) được thực thi
      friendSocketListenersRegistered = false;
    };
  },
}));
