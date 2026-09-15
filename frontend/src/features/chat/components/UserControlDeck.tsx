import React from "react";
import { Settings, LogOut, User as UserIcon } from "lucide-react";
import { User } from "../../../types/auth.types";
import { cn } from "../../../lib/utils";

interface UserControlDeckProps {
  currentUser: User;
  isDeckPopoverOpen: boolean;
  onToggleDeckPopover: () => void;
  onOpenSettings: () => void;
  onLogout?: () => void;
}

/**
 * Thanh điều khiển tài khoản người dùng (User Control Deck) ở chân ConversationSidebar.
 * Hiển thị avatar + tên người dùng, nút Cài đặt và Đăng xuất.
 * Tách biệt phần UI footer để giảm complexity cho ConversationSidebar (rule no-high-complexity-react-function).
 */
export const UserControlDeck: React.FC<UserControlDeckProps> = ({
  currentUser,
  isDeckPopoverOpen,
  onToggleDeckPopover,
  onOpenSettings,
  onLogout,
}) => (
  <div className="h-[84px] px-3 border-t-2 border-uupm-line bg-uupm-surface flex items-center justify-between gap-1 shrink-0">
    {/* Avatar và Thông tin người dùng: bấm để mở popup Hồ sơ nhanh kiểu Discord */}
    <button
      type="button"
      onClick={onToggleDeckPopover}
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
      <button
        type="button"
        onClick={onOpenSettings}
        className="w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink transition-[background-color,box-shadow,transform] cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
        title="Cài đặt người dùng"
        aria-label="Cài đặt người dùng"
      >
        <Settings className="w-4 h-4" />
      </button>

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="w-8 h-8 rounded-xs bg-uupm-surface hover:bg-rose-100 border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-rose-600 transition-[background-color,box-shadow,transform] cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
          title="Đăng xuất tài khoản"
          aria-label="Đăng xuất tài khoản"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </div>
  </div>
);
