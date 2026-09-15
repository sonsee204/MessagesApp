import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, MoreVertical, User as UserIcon, UserMinus, ShieldAlert } from "lucide-react";
import { FriendItem as FriendItemType } from "../types/friend.types";

export interface FriendItemProps {
  friend: FriendItemType;
  onStartChat: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onBlockUser: (userId: string) => void;
}

/**
 * Thành phần hiển thị một hàng bạn bè theo chuẩn Tactile Neo-Brutalist
 */
export const FriendItem: React.FC<FriendItemProps> = ({
  friend,
  onStartChat,
  onOpenProfile,
  onRemoveFriend,
  onBlockUser,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = friend;

  // Tự động đóng menu khi nhấp ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div className="group relative flex items-center justify-between p-3 rounded-xs border-b border-uupm-line/20 hover:bg-uupm-surface-hover transition-colors">
      {/* Khối bên trái: Avatar và thông tin tài khoản — button语义 để mở hồ sơ bằng chuột lẫn bàn phím */}
      <button
        type="button"
        onClick={() => onOpenProfile(user.id)}
        title="Nhấp để xem hồ sơ"
        aria-label={`Xem hồ sơ ${user.displayName || user.username}`}
        className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 text-left bg-transparent border-0 p-0 rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uupm-accent"
      >
        {/* Ảnh đại diện với chỉ báo trạng thái trực tuyến */}
        <div className="relative shrink-0 w-10 h-10 rounded-full border-2 border-uupm-line overflow-visible bg-uupm-page flex items-center justify-center font-black text-uupm-ink">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`Avatar của ${user.displayName}`}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <span>{(user.displayName || user.username || "U").slice(0, 1).toUpperCase()}</span>
          )}

          {/* Chấm trạng thái Online (xanh lá) / Offline (xám) */}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-uupm-surface ${
              user.isOnline ? "bg-uupm-accent" : "bg-uupm-ink-muted"
            }`}
            title={user.isOnline ? "Trực tuyến" : "Ngoại tuyến"}
          />
        </div>

        {/* Tên hiển thị, username và thông điệp trạng thái */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-sm text-uupm-ink truncate hover:underline">
              {user.displayName || user.username}
            </span>
            <span className="text-xs text-uupm-ink-muted font-bold truncate">
              @{user.username}
            </span>
          </div>
          {user.bio && (
            <p className="text-xs text-uupm-ink-soft truncate mt-0.5">
              {user.bio}
            </p>
          )}
        </div>
      </button>

      {/* Khối bên phải: Các nút hành động */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Nút Nhắn tin */}
        <button
          type="button"
          onClick={() => onStartChat(user.id)}
          className="w-9 h-9 rounded-xs bg-uupm-surface hover:bg-uupm-surface-strong border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
          title="Nhắn tin"
          aria-label={`Nhắn tin cho ${user.displayName}`}
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        {/* Nút menu 3 chấm mở rộng */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-9 h-9 rounded-xs bg-uupm-surface hover:bg-uupm-surface-strong border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
            title="Tùy chọn khác"
            aria-label="Tùy chọn khác"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Menu thả xuống */}
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-uupm-surface border-2 border-uupm-line rounded-xs shadow-uupm-2 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenProfile(user.id);
                }}
                className="w-full px-3 py-1.5 text-left text-xs font-bold text-uupm-ink hover:bg-uupm-surface-hover flex items-center gap-2 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-uupm-ink-muted" />
                <span>Xem hồ sơ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onRemoveFriend(user.id);
                }}
                className="w-full px-3 py-1.5 text-left text-xs font-bold text-uupm-danger-text hover:bg-uupm-danger/10 flex items-center gap-2 cursor-pointer border-t border-uupm-line/20"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Hủy kết bạn</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onBlockUser(user.id);
                }}
                className="w-full px-3 py-1.5 text-left text-xs font-bold text-uupm-danger-text hover:bg-uupm-danger/10 flex items-center gap-2 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Chặn người dùng</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
