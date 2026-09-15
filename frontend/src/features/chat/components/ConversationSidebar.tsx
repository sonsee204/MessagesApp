import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  Users,
  Mail,
  Bell,
  Loader2,
  Settings,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { Conversation } from "../../../types/chat.types";
import { User } from "../../../types/auth.types";
import { ConversationItem } from "./ConversationItem";
import { toast } from "../../../stores/toast.store";
import { UserSettingsModal } from "../../users/components/UserSettingsModal";
import { UserDeckPopover } from "../../users/components/UserDeckPopover";
import { FullUserProfileModal } from "../../users/components/FullUserProfileModal";
import { useNotificationStore } from "../../notifications/stores/notification.store";
import { NotificationListModal } from "../../notifications/components/NotificationListModal";
import { useFriendStore } from "../../friends/stores/friend.store";
import { cn } from "../../../lib/utils";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onlineUsers: Record<string, boolean>;
  currentUser: User | null;
  isLoading?: boolean;
  activeView?: "friends" | "chat";
  onSelectConversation: (id: string) => void;
  onSelectFriendsView?: () => void;
  onOpenNewChatModal: () => void;
  onLogout?: () => void;
}

/**
 * Thanh danh sách cuộc trò chuyện và điều khiển tài khoản (ConversationSidebar - Cột 1)
 * Bố cục Direct Messaging phong cách Discord kết hợp Tactile Neo-Brutalism:
 * 1. Nút tìm kiếm nhanh "Tìm hoặc bắt đầu cuộc trò chuyện" (Ctrl + K)
 * 2. Menu liên kết điều hướng Bạn bè và Yêu cầu tin nhắn
 * 3. Danh mục TIN NHẮN TRỰC TIẾP với nút tạo mới (+)
 * 4. User Control Deck ở chân cột (Avatar, Tên, Nút Mic, Tai nghe, Cài đặt)
 */
export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeConversationId,
  onlineUsers,
  currentUser,
  isLoading = false,
  activeView = "chat",
  onSelectConversation,
  onSelectFriendsView,
  onOpenNewChatModal,
  onLogout,
}) => {
  const [filterText, setFilterText] = useState<string>("");
  // Trạng thái mở/đóng popup Cài đặt người dùng (nút bánh răng ở chân cột)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  // Trạng thái mở/đóng popup Hồ sơ nhanh (UserDeckPopover) và modal Xem hồ sơ đầy đủ của chính mình
  const [isDeckPopoverOpen, setIsDeckPopoverOpen] = useState<boolean>(false);
  const [isSelfProfileOpen, setIsSelfProfileOpen] = useState<boolean>(false);

  // Zustand Store quản lý thông báo người dùng
  const { unreadCount, openModal, fetchNotifications, isModalOpen } = useNotificationStore();
  // Số lời mời kết bạn nhận được đang chờ duyệt
  const receivedRequestsCount = useFriendStore((state) => state.receivedRequests.length);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Lọc danh sách cuộc trò chuyện theo từ khóa tìm kiếm
  const filteredConversations = useMemo(() => {
    if (!filterText.trim()) return conversations;

    const lower = filterText.toLowerCase();
    return conversations.filter((conv) => {
      if (conv.type === "GROUP") {
        return conv.title?.toLowerCase().includes(lower);
      }
      const partner = conv.participants.find((p) => p.id !== currentUser?.id);
      const nameMatch =
        partner?.displayName?.toLowerCase().includes(lower) ||
        partner?.username.toLowerCase().includes(lower);
      return Boolean(nameMatch);
    });
  }, [conversations, filterText, currentUser?.id]);

  return (
    <div className="relative w-full md:w-72 lg:w-80 h-full bg-uupm-page border-r-2 border-uupm-line flex flex-col shrink-0 select-none">
      {/* 1. Thanh tìm kiếm nhanh & Bắt đầu cuộc trò chuyện (Cố định h-14 đồng bộ đường kẻ ngang với Header chính) */}
      <div className="h-14 px-3 border-b-2 border-uupm-line bg-uupm-surface flex items-center shrink-0">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-uupm-ink-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Tìm hoặc bắt đầu trò chuyện"
            className="w-full pl-8 pr-12 py-1.5 bg-uupm-page hover:bg-uupm-surface-hover focus:bg-uupm-surface rounded-xs border-2 border-uupm-line shadow-uupm-active text-xs font-bold text-uupm-ink placeholder:text-uupm-ink-muted focus:outline-none focus:shadow-uupm-2 transition-all"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-black text-uupm-ink bg-uupm-surface border border-uupm-line rounded shadow-sm absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            Ctrl K
          </kbd>
        </div>
      </div>

      {/* Thân danh sách cuộn mượt đồng nhất (Quick Links và Danh sách Hội thoại) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
        {/* 2. Menu liên kết điều hướng nhanh (Quick Links chuẩn Tactile Neo-Brutalist) */}
        <div className="space-y-1.5">
          {/* Nút Bạn bè */}
          <button
            type="button"
            onClick={() => {
              onSelectFriendsView?.();
            }}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-xs border-2 text-xs font-black transition-all cursor-pointer",
              activeView === "friends" && !activeConversationId
                ? "bg-uupm-accent/20 border-uupm-line shadow-uupm-active text-uupm-ink translate-x-[1px] translate-y-[1px]"
                : "bg-uupm-surface border-uupm-line shadow-uupm-active hover:bg-uupm-surface-hover hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] text-uupm-ink"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 text-uupm-ink" />
              </div>
              <span>Bạn bè</span>
            </div>
            {receivedRequestsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-uupm-danger text-uupm-danger-ink text-[10px] font-black border border-uupm-line">
                {receivedRequestsCount > 99 ? "99+" : receivedRequestsCount}
              </span>
            )}
          </button>

          {/* Nút Thông báo */}
          <button
            type="button"
            onClick={openModal}
            title="Xem thông báo hệ thống và tương tác"
            aria-label="Xem danh sách thông báo"
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-xs border-2 text-xs font-black transition-all cursor-pointer",
              isModalOpen
                ? "bg-uupm-accent/20 border-uupm-line shadow-uupm-active text-uupm-ink translate-x-[1px] translate-y-[1px]"
                : "bg-uupm-surface border-uupm-line shadow-uupm-active hover:bg-uupm-surface-hover hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] text-uupm-ink"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-6 h-6 rounded-xs border-2 border-uupm-line flex items-center justify-center shrink-0 transition-colors",
                  unreadCount > 0 ? "bg-uupm-danger text-white" : "bg-uupm-accent text-uupm-ink"
                )}
              >
                <Bell className="w-3.5 h-3.5" />
              </div>
              <span>Thông báo</span>
            </div>
            {unreadCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-uupm-danger text-white text-[10px] font-black border border-uupm-line animate-pulse">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full bg-uupm-surface-hover text-uupm-ink-muted text-[10px] font-bold border border-uupm-line/50">
                0
              </span>
            )}
          </button>

          {/* Nút Yêu cầu tin nhắn */}
          <button
            type="button"
            onClick={() => {
              toast.info("Hiện không có yêu cầu tin nhắn chờ nào.", "Hộp thư chờ");
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xs border-2 bg-uupm-surface border-uupm-line shadow-uupm-active hover:bg-uupm-surface-hover hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] text-xs font-black text-uupm-ink transition-all cursor-pointer"
          >
            <div className="w-6 h-6 rounded-xs bg-uupm-warn-soft border-2 border-uupm-line flex items-center justify-center shrink-0">
              <Mail className="w-3.5 h-3.5 text-uupm-warn-soft-ink" />
            </div>
            <span>Yêu cầu tin nhắn</span>
          </button>
        </div>

        {/* Đường kẻ phân cách tinh tế giữa Danh mục điều hướng và Danh sách tin nhắn */}
        <div className="border-t-2 border-uupm-line/20 mx-1" />

        {/* 3. Danh mục TIN NHẮN TRỰC TIẾP */}
        <div className="space-y-1.5">
          <div className="px-1 py-1 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-uupm-ink-muted">
              Tin Nhắn Trực Tiếp
            </span>
            <button
              type="button"
              onClick={onOpenNewChatModal}
              className="w-6 h-6 rounded-xs bg-uupm-surface hover:bg-uupm-accent border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink hover:text-uupm-accent-text cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
              title="Tạo cuộc trò chuyện mới"
              aria-label="Tạo cuộc trò chuyện mới"
            >
              <Plus className="w-3.5 h-3.5 font-bold" />
            </button>
          </div>

          {/* Danh sách các cuộc trò chuyện */}
          <div className="space-y-1.5">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-uupm-ink-muted gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-uupm-accent" />
                <span className="text-xs font-bold">Đang tải cuộc trò chuyện...</span>
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conversation) => {
                const partner = conversation.participants.find((p) => p.id !== currentUser?.id);
                const isOnline = Boolean(partner && onlineUsers[partner.id]);

                return (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    currentUserId={currentUser?.id}
                    isActive={conversation.id === activeConversationId}
                    isOnline={isOnline}
                    onClick={() => {
                      onSelectConversation(conversation.id);
                    }}
                    onCloseConversation={() => {
                      toast.info("Đã đóng cuộc trò chuyện khỏi danh sách.", "Đóng hội thoại");
                    }}
                  />
                );
              })
            ) : (
              <div className="py-12 text-center text-uupm-ink-muted px-4">
                <p className="text-xs font-bold">
                  {filterText ? "Không tìm thấy cuộc trò chuyện phù hợp" : "Chưa có cuộc trò chuyện nào"}
                </p>
                <p className="text-[11px] text-uupm-ink-muted mt-1">
                  Nhấn nút &quot;+&quot; ở trên để bắt đầu kết nối với bạn bè!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Thanh điều khiển tài khoản người dùng (User Control Deck) ở chân cột (Cố định h-[84px] đồng bộ đường kẻ ngang với MessageInput cột 2) */}
      {currentUser && (
        <div className="h-[84px] px-3 border-t-2 border-uupm-line bg-uupm-surface flex items-center justify-between gap-1 shrink-0">
          {/* Avatar và Thông tin người dùng: bấm để mở popup Hồ sơ nhanh kiểu Discord */}
          <button
            type="button"
            onClick={() => setIsDeckPopoverOpen((prev) => !prev)}
            aria-haspopup="dialog"
            aria-expanded={isDeckPopoverOpen}
            aria-label="Mở hồ sơ nhanh của bạn"
            className={cn(
              "flex items-center gap-2.5 min-w-0 flex-1 text-left p-1.5 rounded-xs transition-colors cursor-pointer",
              isDeckPopoverOpen
                ? "bg-uupm-surface-hover"
                : "hover:bg-uupm-surface-hover"
            )}
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line shadow-uupm-active flex items-center justify-center font-black text-xs overflow-hidden">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-4 h-4 text-uupm-ink" />
                )}
              </div>
              <span
                className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-uupm-accent border-2 border-uupm-line"
                title="Trực tuyến"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black text-uupm-ink truncate leading-tight">
                {currentUser.displayName || currentUser.username}
              </h4>
              <p className="text-[10px] font-bold text-uupm-ink-muted truncate">
                @{currentUser.username}
              </p>
            </div>
          </button>

          {/* Cụm nút tiện ích tài khoản: Cài đặt và Đăng xuất */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Nút Cài đặt */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
              title="Cài đặt người dùng"
              aria-label="Cài đặt người dùng"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Nút Đăng xuất tài khoản */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-8 h-8 rounded-xs bg-uupm-surface hover:bg-rose-100 border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-rose-600 transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                title="Đăng xuất tài khoản"
                aria-label="Đăng xuất tài khoản"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Popup Hồ sơ nhanh kiểu Discord (UserDeckPopover): neo trên đầu User Control Deck.
          key=isOpen remount mỗi lần mở → reset statusDraft/isEditingState tự nhiên
          (rule no-adjust-state-on-prop-change / no-reset-all-state-on-prop-change). */}
      {currentUser && (
        <UserDeckPopover
          key={`deck-${isDeckPopoverOpen}`}
          isOpen={isDeckPopoverOpen}
          onClose={() => setIsDeckPopoverOpen(false)}
          currentUser={currentUser}
          onOpenProfile={() => setIsSelfProfileOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLogout={onLogout}
        />
      )}

      {/* Modal Xem hồ sơ đầy đủ của chính mình mở từ popup hồ sơ nhanh */}
      {currentUser && (
        <FullUserProfileModal
          isOpen={isSelfProfileOpen}
          onClose={() => setIsSelfProfileOpen(false)}
          user={currentUser}
          isOnline
        />
      )}

      {/* Popup Cài đặt người dùng: key=isOpen remount mỗi lần mở để reset activeTab
          tự nhiên thay vì effect reset tay (rule no-reset-all-state-on-prop-change). */}
      {currentUser && (
        <UserSettingsModal
          key={`settings-${isSettingsOpen}`}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentUser={currentUser}
        />
      )}

      {/* Popup Trung tâm thông báo người dùng */}
      <NotificationListModal />
    </div>
  );
};
