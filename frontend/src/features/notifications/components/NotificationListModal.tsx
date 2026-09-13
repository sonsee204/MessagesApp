import React, { useEffect, useCallback, useState } from "react";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  X,
  UserPlus,
  UserCheck,
  AtSign,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useNotificationStore } from "../stores/notification.store";
import { useFriendStore } from "../../friends/stores/friend.store";
import { NotificationItem, NotificationType } from "../types/notification.types";
import { cn } from "../../../lib/utils";

/**
 * Định dạng mốc thời gian dạng tương đối hoặc chuỗi ngày tháng dễ đọc
 * @param dateStr Chuỗi ngày tháng ISO từ API
 */
function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Component hiển thị icon đại diện tương ứng cho từng loại thông báo
 */
const NotificationTypeIcon: React.FC<{ type: NotificationType }> = ({ type }) => {
  switch (type) {
    case "FRIEND_REQUEST_RECEIVED":
      return (
        <div className="w-8 h-8 rounded-xs bg-uupm-accent border-2 border-uupm-line flex items-center justify-center shrink-0">
          <UserPlus className="w-4 h-4 text-uupm-ink" />
        </div>
      );
    case "FRIEND_REQUEST_ACCEPTED":
      return (
        <div className="w-8 h-8 rounded-xs bg-emerald-400 border-2 border-uupm-line flex items-center justify-center shrink-0">
          <UserCheck className="w-4 h-4 text-uupm-ink" />
        </div>
      );
    case "MESSAGE_MENTION":
      return (
        <div className="w-8 h-8 rounded-xs bg-sky-400 border-2 border-uupm-line flex items-center justify-center shrink-0">
          <AtSign className="w-4 h-4 text-uupm-ink" />
        </div>
      );
    case "SYSTEM_ALERT":
    default:
      return (
        <div className="w-8 h-8 rounded-xs bg-uupm-warn-soft border-2 border-uupm-line flex items-center justify-center shrink-0">
          <AlertCircle className="w-4 h-4 text-uupm-warn-soft-ink" />
        </div>
      );
  }
};

/**
 * Component hiển thị từng hàng thông báo đơn lẻ (NotificationItemRow)
 */
const NotificationItemRow: React.FC<{
  item: NotificationItem;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  // Callback xử lý nhanh lời mời kết bạn ngay trong thông báo (chỉ dùng cho FRIEND_REQUEST_RECEIVED)
  onAcceptRequest?: (friendRequestId: string) => Promise<void>;
  onRejectRequest?: (friendRequestId: string) => Promise<void>;
  isProcessing?: boolean;
}> = ({
  item,
  onMarkAsRead,
  onDelete,
  onAcceptRequest,
  onRejectRequest,
  isProcessing = false,
}) => {
  // Lời mời kết bạn đã được xử lý (đọc) thì ẩn cặp nút thao tác nhanh để tránh thao tác lặp
  const friendRequestId = item.data?.friendRequestId;
  const showFriendActions =
    item.type === "FRIEND_REQUEST_RECEIVED" &&
    Boolean(friendRequestId) &&
    !item.isRead &&
    Boolean(onAcceptRequest && onRejectRequest);

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 p-3 rounded-xs border-2 transition-all",
        item.isRead
          ? "bg-uupm-surface border-uupm-line/40 hover:border-uupm-line opacity-90"
          : "bg-uupm-accent/15 border-uupm-line shadow-xs"
      )}
    >
      <NotificationTypeIcon type={item.type} />

      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-2">
          <h4
            className={cn(
              "text-xs font-black truncate text-uupm-ink",
              !item.isRead && "font-black"
            )}
          >
            {item.title}
          </h4>
          <span className="text-[10px] font-bold text-uupm-ink-soft shrink-0">
            {formatTime(item.createdAt)}
          </span>
        </div>

        <p className="text-xs font-medium text-uupm-ink-soft mt-0.5 line-clamp-2 break-words">
          {item.content}
        </p>

        {/* Cặp nút thao tác nhanh cho lời mời kết bạn: Đồng ý / Từ chối */}
        {showFriendActions && (
          <div className="flex items-center gap-1.5 mt-2">
            <button
              type="button"
              disabled={isProcessing}
              aria-disabled={isProcessing}
              onClick={() => void onAcceptRequest?.(friendRequestId as string)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-[11px] font-black rounded-xs border-2 border-uupm-line transition-all",
                isProcessing
                  ? "bg-uupm-surface/50 text-uupm-ink-soft/50 cursor-not-allowed"
                  : "bg-uupm-accent hover:bg-uupm-accent/80 text-uupm-ink cursor-pointer shadow-uupm-active active:translate-x-[1px] active:translate-y-[1px]"
              )}
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              <span>Đồng ý</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              aria-disabled={isProcessing}
              onClick={() => void onRejectRequest?.(friendRequestId as string)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-[11px] font-black rounded-xs border-2 border-uupm-line transition-all",
                isProcessing
                  ? "bg-uupm-surface/50 text-uupm-ink-soft/50 cursor-not-allowed"
                  : "bg-uupm-surface hover:bg-uupm-danger/20 text-uupm-ink cursor-pointer shadow-uupm-active active:translate-x-[1px] active:translate-y-[1px]"
              )}
            >
              <X className="w-3 h-3" />
              <span>Từ chối</span>
            </button>
          </div>
        )}
      </div>

      {/* Cụm hành động nhanh: Đánh dấu đã đọc và Xóa */}
      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
        {!item.isRead && (
          <button
            type="button"
            onClick={() => onMarkAsRead(item._id)}
            title="Đánh dấu đã đọc"
            aria-label="Đánh dấu đã đọc"
            className="w-6 h-6 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border border-uupm-line flex items-center justify-center cursor-pointer transition-colors"
          >
            <Check className="w-3.5 h-3.5 text-uupm-ink" />
          </button>
        )}

        <button
          type="button"
          onClick={() => onDelete(item._id)}
          title="Xóa thông báo"
          aria-label="Xóa thông báo"
          className="w-6 h-6 rounded-xs bg-uupm-surface hover:bg-uupm-danger/20 border border-uupm-line flex items-center justify-center cursor-pointer transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-uupm-danger" />
        </button>
      </div>
    </div>
  );
};

/**
 * Modal Popup Trung tâm thông báo (NotificationListModal)
 * Thiết kế chuẩn Neo-Brutalist, hỗ trợ phân loại Tất cả / Chưa đọc,
 * đánh dấu đọc hàng loạt và cập nhật theo thời gian thực.
 */
export const NotificationListModal: React.FC = () => {
  const {
    isModalOpen,
    closeModal,
    notifications,
    unreadCount,
    isLoading,
    filter,
    setFilter,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  // Chỉ lấy hai hành động cần thiết của Friend Store để xử lý lời mời kết bạn inline
  const acceptFriendRequest = useFriendStore((state) => state.acceptFriendRequest);
  const rejectFriendRequest = useFriendStore((state) => state.rejectFriendRequest);

  // Trạng thái ID lời mời kết bạn đang được xử lý (dùng để khóa nút và hiện spinner)
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  /**
   * Xử lý lời mời kết bạn trực tiếp từ thông báo.
   * Đánh dấu thông báo đã đọc trong CẢ HAI trường hợp thành công lẫn thất bại:
   * - Thành công: ẩn cặp nút thao tác như hành vi cũ.
   * - Thất bại: lời mời có thể đã bị hủy/từ chối ở nơi khác, hàng thông báo đã cũ (stale);
   *   giữ nguyên cặp nút sẽ khiến người dùng bấm lặp và nhận lỗi validation.
   *   Toast lỗi đã do friend store hiển thị nên người dùng vẫn biết thao tác không thành công.
   */
  const handleFriendRequestAction = useCallback(
    async (notificationId: string, friendRequestId: string, action: "accept" | "reject") => {
      if (processingRequestId) return;
      setProcessingRequestId(friendRequestId);
      try {
        if (action === "accept") {
          await acceptFriendRequest(friendRequestId);
        } else {
          await rejectFriendRequest(friendRequestId);
        }
      } catch {
        // Lỗi đã được friend store hiển thị qua toast
      } finally {
        // Luôn đánh dấu đã đọc để hàng thông báo stale không còn chào mời thao tác
        await markAsRead(notificationId);
        setProcessingRequestId(null);
      }
    },
    [processingRequestId, acceptFriendRequest, rejectFriendRequest, markAsRead]
  );

  // Đóng modal khi nhấn phím Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    },
    [closeModal]
  );

  useEffect(() => {
    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen, handleKeyDown]);

  if (!isModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      {/* Lớp nền bắt sự kiện click ra ngoài để đóng */}
      <div
        className="fixed inset-0"
        onClick={closeModal}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-uupm-surface border-2 border-uupm-line shadow-uupm-2 rounded-xs overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-uupm-line bg-uupm-page">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xs bg-uupm-accent border-2 border-uupm-line flex items-center justify-center">
              <Bell className="w-4 h-4 text-uupm-ink" />
            </div>
            <h3
              id="notification-modal-title"
              className="text-sm font-black text-uupm-ink tracking-tight uppercase"
            >
              Trung tâm thông báo
            </h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-xs bg-uupm-danger text-white text-[10px] font-black border border-uupm-line">
                {unreadCount} mới
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Đánh dấu tất cả đã đọc */}
            <button
              type="button"
              disabled={unreadCount === 0 || isLoading}
              onClick={() => void markAllAsRead()}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-black rounded-xs border-2 transition-all",
                unreadCount > 0
                  ? "bg-uupm-surface hover:bg-uupm-surface-hover border-uupm-line text-uupm-ink cursor-pointer shadow-uupm-active active:translate-x-[1px] active:translate-y-[1px]"
                  : "bg-uupm-surface/50 border-uupm-line/40 text-uupm-ink-soft/50 cursor-not-allowed"
              )}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Đọc tất cả</span>
            </button>

            {/* Nút Đóng modal */}
            <button
              type="button"
              onClick={closeModal}
              aria-label="Đóng cửa sổ"
              className="w-7 h-7 rounded-xs bg-uupm-surface hover:bg-uupm-danger/20 border-2 border-uupm-line flex items-center justify-center text-uupm-ink cursor-pointer transition-colors shadow-uupm-active active:translate-x-[1px] active:translate-y-[1px]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thanh chọn bộ lọc (Tabs: Tất cả / Chưa đọc) */}
        <div className="flex items-center gap-2 px-4 py-2 border-b-2 border-uupm-line bg-uupm-surface">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1 text-xs font-black rounded-xs border-2 transition-all cursor-pointer",
              filter === "all"
                ? "bg-uupm-accent border-uupm-line text-uupm-ink shadow-uupm-active translate-x-[1px] translate-y-[1px]"
                : "bg-uupm-page border-transparent hover:border-uupm-line text-uupm-ink-soft"
            )}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={cn(
              "px-3 py-1 text-xs font-black rounded-xs border-2 transition-all cursor-pointer flex items-center gap-1.5",
              filter === "unread"
                ? "bg-uupm-accent border-uupm-line text-uupm-ink shadow-uupm-active translate-x-[1px] translate-y-[1px]"
                : "bg-uupm-page border-transparent hover:border-uupm-line text-uupm-ink-soft"
            )}
          >
            <span>Chưa đọc</span>
            {unreadCount > 0 && (
              <span className="w-4 h-4 rounded-xs bg-uupm-danger text-white text-[9px] font-black border border-uupm-line flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Danh sách thông báo */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[260px] max-h-[55vh]">
          {isLoading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-uupm-ink-soft">
              <Loader2 className="w-6 h-6 animate-spin text-uupm-ink mb-2" />
              <p className="text-xs font-bold">Đang tải danh sách thông báo...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-12 h-12 rounded-xs bg-uupm-surface border-2 border-uupm-line flex items-center justify-center mb-3">
                <BellOff className="w-6 h-6 text-uupm-ink-soft" />
              </div>
              <h4 className="text-sm font-black text-uupm-ink">Không có thông báo nào</h4>
              <p className="text-xs font-medium text-uupm-ink-soft mt-1 max-w-[260px]">
                {filter === "unread"
                  ? "Bạn đã đọc hết tất cả thông báo rồi. Tuyệt vời!"
                  : "Hiện chưa có thông báo nào được gửi đến tài khoản của bạn."}
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <NotificationItemRow
                key={item._id}
                item={item}
                onMarkAsRead={(id) => void markAsRead(id)}
                onDelete={(id) => void deleteNotification(id)}
                isProcessing={
                  Boolean(item.data?.friendRequestId) &&
                  processingRequestId === item.data?.friendRequestId
                }
                onAcceptRequest={(requestId) =>
                  handleFriendRequestAction(item._id, requestId, "accept")
                }
                onRejectRequest={(requestId) =>
                  handleFriendRequestAction(item._id, requestId, "reject")
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
