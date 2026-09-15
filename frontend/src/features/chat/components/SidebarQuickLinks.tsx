import React from "react";
import { Users, Bell, Mail } from "lucide-react";
import { toast } from "../../../stores/toast.store";
import { cn } from "../../../lib/utils";

interface SidebarQuickLinksProps {
  activeView: "friends" | "chat";
  activeConversationId: string | null;
  receivedRequestsCount: number;
  unreadCount: number;
  isNotificationsOpen: boolean;
  onSelectFriendsView: () => void;
  onOpenNotifications: () => void;
}

/**
 * Menu liên kết điều hướng nhanh trong ConversationSidebar (Bạn bè, Thông báo, Yêu cầu tin nhắn).
 * Tách biệt để giảm JSX nesting và complexity cho ConversationSidebar.
 */
export const SidebarQuickLinks: React.FC<SidebarQuickLinksProps> = ({
  activeView,
  activeConversationId,
  receivedRequestsCount,
  unreadCount,
  isNotificationsOpen,
  onSelectFriendsView,
  onOpenNotifications,
}) => (
  <div className="space-y-1.5">
    {/* Nút Bạn bè */}
    <button
      type="button"
      onClick={onSelectFriendsView}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2 rounded-xs border-2 text-xs font-black transition-[background-color,box-shadow,transform] cursor-pointer",
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
        <span className="px-1.5 py-[2px] rounded-full bg-uupm-danger text-uupm-danger-ink text-[10px] font-black border border-uupm-line">
          {receivedRequestsCount > 99 ? "99+" : receivedRequestsCount}
        </span>
      )}
    </button>

    {/* Nút Thông báo */}
    <button
      type="button"
      onClick={onOpenNotifications}
      title="Xem thông báo hệ thống và tương tác"
      aria-label="Xem danh sách thông báo"
      className={cn(
        "w-full flex items-center justify-between px-3 py-2 rounded-xs border-2 text-xs font-black transition-[background-color,box-shadow,transform] cursor-pointer",
        isNotificationsOpen
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
        <span className="px-1.5 py-[2px] rounded-full bg-uupm-danger text-white text-[10px] font-black border border-uupm-line animate-pulse">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : (
        <span className="px-1.5 py-[2px] rounded-full bg-uupm-surface-hover text-uupm-ink-muted text-[10px] font-bold border border-uupm-line/50">
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
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xs border-2 bg-uupm-surface border-uupm-line shadow-uupm-active hover:bg-uupm-surface-hover hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] text-xs font-black text-uupm-ink transition-[background-color,box-shadow,transform] cursor-pointer"
    >
      <div className="w-6 h-6 rounded-xs bg-uupm-warn-soft border-2 border-uupm-line flex items-center justify-center shrink-0">
        <Mail className="w-3.5 h-3.5 text-uupm-warn-soft-ink" />
      </div>
      <span>Yêu cầu tin nhắn</span>
    </button>
  </div>
);
