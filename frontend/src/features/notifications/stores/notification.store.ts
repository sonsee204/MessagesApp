import { create } from "zustand";
import {
  NotificationItem,
  NotificationPagination,
  NotificationFilter,
} from "../types/notification.types";
import { notificationService } from "../services/notification.service";
import { toast } from "../../../stores/toast.store";

/**
 * Interface định nghĩa Trạng thái và Hành động của Notification Store
 */
export interface NotificationState {
  // Danh sách các thông báo đang tải về
  notifications: NotificationItem[];
  // Số lượng thông báo chưa đọc
  unreadCount: number;
  // Dữ liệu phân trang
  pagination: NotificationPagination | null;
  // Trạng thái đang tải dữ liệu
  isLoading: boolean;
  // Bộ lọc đang chọn: 'all' (tất cả) hoặc 'unread' (chưa đọc)
  filter: NotificationFilter;
  // Trạng thái đóng/mở modal danh sách thông báo
  isModalOpen: boolean;

  // === CÁC HÀNH ĐỘNG (ACTIONS) ===
  fetchNotifications: (page?: number, unreadOnly?: boolean) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  setFilter: (filter: NotificationFilter) => void;
  openModal: () => void;
  closeModal: () => void;
  addIncomingNotification: (notif: NotificationItem) => void;
  applyNotificationRead: (payload: { notificationId?: string; all?: boolean }) => void;
}

/**
 * Zustand Store quản lý toàn bộ trạng thái Thông báo người dùng (Notification Store)
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  pagination: null,
  isLoading: false,
  filter: "all",
  isModalOpen: false,

  /**
   * Tải danh sách thông báo từ Backend API
   */
  fetchNotifications: async (page = 1, unreadOnly = false) => {
    set({ isLoading: true });
    try {
      const data = await notificationService.getNotifications({
        page,
        limit: 20,
        unreadOnly,
      });
      set({
        notifications: data.notifications,
        pagination: data.pagination,
        unreadCount: data.unreadCount,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  /**
   * Đánh dấu một thông báo là đã đọc và cập nhật unreadCount
   */
  markAsRead: async (id: string) => {
    // Cập nhật lạc quan (Optimistic Update) trên Client
    const currentList = get().notifications;
    const target = currentList.find((n) => n._id === id);
    if (!target || target.isRead) return;

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await notificationService.markAsRead(id);
    } catch {
      // Nếu API thất bại, hoàn tác lại trạng thái cũ
      set({ notifications: currentList });
      toast.error("Không thể đánh dấu thông báo đã đọc", "Lỗi");
    }
  },

  /**
   * Đánh dấu tất cả thông báo chưa đọc thành đã đọc
   */
  markAllAsRead: async () => {
    const prevNotifications = get().notifications;
    const prevUnreadCount = get().unreadCount;

    // Cập nhật lạc quan
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: new Date().toISOString(),
      })),
      unreadCount: 0,
    }));

    try {
      await notificationService.markAllAsRead();
      toast.success("Đã đánh dấu tất cả thông báo là đã đọc", "Thành công");
    } catch {
      set({
        notifications: prevNotifications,
        unreadCount: prevUnreadCount,
      });
      toast.error("Không thể đánh dấu tất cả thông báo", "Lỗi");
    }
  },

  /**
   * Xóa một thông báo khỏi danh sách
   */
  deleteNotification: async (id: string) => {
    const prevNotifications = get().notifications;
    const target = prevNotifications.find((n) => n._id === id);

    set((state) => ({
      notifications: state.notifications.filter((n) => n._id !== id),
      unreadCount:
        target && !target.isRead
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
    }));

    try {
      await notificationService.deleteNotification(id);
      toast.success("Đã xóa thông báo", "Thành công");
    } catch {
      set({ notifications: prevNotifications });
      toast.error("Không thể xóa thông báo", "Lỗi");
    }
  },

  /**
   * Đổi bộ lọc 'all' hoặc 'unread'
   */
  setFilter: (filter: NotificationFilter) => {
    set({ filter });
    void get().fetchNotifications(1, filter === "unread");
  },

  /**
   * Mở modal danh sách thông báo
   */
  openModal: () => {
    set({ isModalOpen: true });
    void get().fetchNotifications(1, get().filter === "unread");
  },

  /**
   * Đóng modal danh sách thông báo
   */
  closeModal: () => {
    set({ isModalOpen: false });
  },

  /**
   * Thêm thông báo thời gian thực nhận được từ Socket.IO
   */
  addIncomingNotification: (notif: NotificationItem) => {
    set((state) => {
      // Tránh trùng lặp nếu thông báo đã có trong danh sách
      if (state.notifications.some((n) => n._id === notif._id)) {
        return state;
      }
      return {
        notifications: [notif, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      };
    });
  },

  /**
   * Đồng bộ trạng thái đã đọc từ Socket.IO (khi người dùng thao tác ở thiết bị khác)
   */
  applyNotificationRead: (payload: { notificationId?: string; all?: boolean }) => {
    if (payload.all) {
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          isRead: true,
        })),
        unreadCount: 0,
      }));
    } else if (payload.notificationId) {
      set((state) => {
        const target = state.notifications.find(
          (n) => n._id === payload.notificationId
        );
        return {
          notifications: state.notifications.map((n) =>
            n._id === payload.notificationId ? { ...n, isRead: true } : n
          ),
          unreadCount:
            target && !target.isRead
              ? Math.max(0, state.unreadCount - 1)
              : state.unreadCount,
        };
      });
    }
  },
}));
