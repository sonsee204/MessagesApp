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
import { useNotificationStore } from "../../notifications/stores/notification.store";
import { NotificationListModal } from "../../notifications/components/NotificationListModal";
import { cn } from "../../../lib/utils";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onlineUsers: Record<string, boolean>;
  currentUser: User | null;
  isLoading?: boolean;
  onSelectConversation: (id: string) => void;
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
  onSelectConversation,
  onOpenNewChatModal,
  onLogout,
}) => {
  const [filterText, setFilterText] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"friends" | "messages" | "notifications">("messages");
  // Trạng thái mở/đóng popup Cài đặt người dùng (nút bánh răng ở chân cột)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Zustand Store quản lý thông báo người dùng
  const { unreadCount, openModal, fetchNotifications } = useNotificationStore();

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
    <div className="w-full md:w-72 lg:w-80 h-full bg-uupm-page border-r-2 border-uupm-line flex flex-col shrink-0 select-none">
      {/* 1. Thanh tìm kiếm nhanh & Bắt đầu cuộc trò chuyện */}
      <div className="p-3 border-b-2 border-uupm-line bg-uupm-surface">
        <div className="relative">
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

      {/* 2. Menu liên kết điều hướng nhanh (Quick Links) */}
      <div className="p-2 space-y-1 border-b-2 border-uupm-line bg-uupm-surface">
        {/* Nút Bạn bè */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("friends");
            toast.info("Đang hiển thị danh mục Bạn bè trực tuyến.", "Danh bạ bạn bè");
          }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xs border-2 text-xs font-black transition-all cursor-pointer",
            activeTab === "friends"
              ? "bg-uupm-accent/20 border-uupm-line shadow-uupm-active text-uupm-ink translate-x-[1px] translate-y-[1px]"
              : "bg-uupm-surface border-transparent hover:border-uupm-line hover:bg-uupm-surface-hover text-uupm-ink-soft"
          )}
        >
          <div className="w-6 h-6 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line flex items-center justify-center shrink-0">
            <Users className="w-3.5 h-3.5 text-uupm-ink" />
          </div>
          <span>Bạn bè</span>
        </button>

        {/* Nút Thông báo */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("notifications");
            openModal();
          }}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 rounded-xs border-2 text-xs font-black transition-all cursor-pointer",
            activeTab === "notifications"
              ? "bg-uupm-accent/20 border-uupm-line shadow-uupm-active text-uupm-ink translate-x-[1px] translate-y-[1px]"
              : "bg-uupm-surface border-transparent hover:border-uupm-line hover:bg-uupm-surface-hover text-uupm-ink-soft"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-xs bg-uupm-accent border-2 border-uupm-line flex items-center justify-center shrink-0">
              <Bell className="w-3.5 h-3.5 text-uupm-ink" />
            </div>
            <span>Thông báo</span>
          </div>
          {unreadCount > 0 ? (
            <span className="px-1.5 py-0.2 rounded-xs bg-uupm-danger text-white text-[10px] font-black border border-uupm-line">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded-xs bg-uupm-accent/30 text-uupm-ink text-[10px] font-bold border border-uupm-line">
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
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xs border-2 border-transparent hover:border-uupm-line hover:bg-uupm-surface-hover text-xs font-black text-uupm-ink-soft transition-all cursor-pointer"
        >
          {/* Nền vàng + icon phải là MỘT CẶP token cùng theme. Trước đây nền
              viết cứng #fef08a còn icon dùng --uupm-ink: ở theme tối icon thành
              #f2f3f5 (gần trắng) trên nền vàng nhạt -> 1.05:1, chip chìm hẳn. */}
          <div className="w-6 h-6 rounded-xs bg-uupm-warn-soft border-2 border-uupm-line flex items-center justify-center shrink-0">
            <Mail className="w-3.5 h-3.5 text-uupm-warn-soft-ink" />
          </div>
          <span>Yêu cầu tin nhắn</span>
        </button>
      </div>

      {/* 3. Danh mục TIN NHẮN TRỰC TIẾP */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wider text-uupm-ink-muted">
          Tin Nhắn Trực Tiếp
        </span>
        <button
          type="button"
          onClick={onOpenNewChatModal}
          className="w-6 h-6 rounded-xs bg-uupm-surface hover:bg-uupm-accent border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-accent-text cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
          title="Tạo cuộc trò chuyện mới"
          aria-label="Tạo cuộc trò chuyện mới"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Danh sách các cuộc trò chuyện */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
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
                  setActiveTab("messages");
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

      {/* 4. Thanh điều khiển tài khoản người dùng (User Control Deck) ở chân cột */}
      {currentUser && (
        <div className="p-2.5 border-t-2 border-uupm-line bg-uupm-surface flex items-center justify-between gap-1 shrink-0">
          {/* Avatar và Thông tin người dùng */}
          <div className="flex items-center gap-2 min-w-0 flex-1 hover:bg-uupm-surface-hover p-1 rounded-xs cursor-pointer transition-colors">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line shadow-uupm-active flex items-center justify-center font-black text-xs overflow-hidden">
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
                className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-uupm-accent border-2 border-uupm-line"
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
          </div>

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

      {/* Popup Cài đặt người dùng: chỉ gắn khi đã có dữ liệu người dùng hiện tại */}
      {currentUser && (
        <UserSettingsModal
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
