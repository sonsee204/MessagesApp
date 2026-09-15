import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  Loader2,
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
import { SidebarQuickLinks } from "./SidebarQuickLinks";
import { UserControlDeck } from "./UserControlDeck";

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
            aria-label="Tìm kiếm hoặc bắt đầu cuộc trò chuyện mới"
            className="w-full pl-8 pr-12 py-1.5 bg-uupm-page hover:bg-uupm-surface-hover focus:bg-uupm-surface rounded-xs border-2 border-uupm-line shadow-uupm-active text-xs font-bold text-uupm-ink placeholder:text-uupm-ink-muted focus:outline-none focus:shadow-uupm-2 transition-[background-color,box-shadow,transform]"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-black text-uupm-ink bg-uupm-surface border border-uupm-line rounded shadow-sm absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            Ctrl K
          </kbd>
        </div>
      </div>

      {/* Thân danh sách cuộn mượt đồng nhất (Quick Links và Danh sách Hội thoại) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
        {/* 2. Menu liên kết điều hướng nhanh — tách thành SidebarQuickLinks để giảm complexity */}
        <SidebarQuickLinks
          activeView={activeView}
          activeConversationId={activeConversationId}
          receivedRequestsCount={receivedRequestsCount}
          unreadCount={unreadCount}
          isNotificationsOpen={isModalOpen}
          onSelectFriendsView={() => onSelectFriendsView?.()}
          onOpenNotifications={openModal}
        />

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
              className="w-6 h-6 rounded-xs bg-uupm-surface hover:bg-uupm-accent border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink hover:text-uupm-accent-text cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
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

      {/* 4. Thanh điều khiển tài khoản người dùng (User Control Deck) ở chân cột — tách thành component riêng để giảm complexity */}
      {currentUser && (
        <UserControlDeck
          currentUser={currentUser}
          isDeckPopoverOpen={isDeckPopoverOpen}
          onToggleDeckPopover={() => setIsDeckPopoverOpen((prev) => !prev)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLogout={onLogout}
        />
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
