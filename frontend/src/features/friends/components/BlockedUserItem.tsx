import React from "react";
import { ShieldOff } from "lucide-react";
import { BlockedUserItem as BlockedUserItemType } from "../types/friend.types";

export interface BlockedUserItemProps {
  block: BlockedUserItemType;
  onUnblock: (targetUserId: string) => void;
  onOpenProfile?: (userId: string) => void;
}

/**
 * Thành phần hiển thị một hàng người dùng trong danh sách đã chặn
 */
export const BlockedUserItem: React.FC<BlockedUserItemProps> = ({
  block,
  onUnblock,
  onOpenProfile,
}) => {
  const blockedUser =
    typeof block.blockedId === "object" && block.blockedId !== null
      ? block.blockedId
      : {
          id: String(block.blockedId),
          username: "user",
          displayName: "Người dùng bị chặn",
        };

  const targetUserId = (blockedUser as any).id || (blockedUser as any)._id || String(block.blockedId);

  return (
    <div className="flex items-center justify-between p-3 rounded-xs border-b border-uupm-line/20 hover:bg-uupm-surface-hover transition-colors gap-3">
      {/* Thông tin người bị chặn — button语义 mở hồ sơ */}
      <button
        type="button"
        onClick={() => targetUserId && onOpenProfile?.(targetUserId)}
        title="Nhấp để xem hồ sơ"
        aria-label={`Xem hồ sơ ${blockedUser.displayName || blockedUser.username}`}
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer bg-transparent border-0 p-0 rounded-xs text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uupm-accent"
      >
        {/* Avatar */}
        <div className="shrink-0 w-10 h-10 rounded-full border-2 border-uupm-line overflow-hidden bg-uupm-page flex items-center justify-center font-black text-uupm-ink">
          {blockedUser.avatarUrl ? (
            <img
              src={blockedUser.avatarUrl}
              alt={`Avatar của ${blockedUser.displayName}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{(blockedUser.displayName || blockedUser.username || "U").slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        {/* Tên và username */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-sm text-uupm-ink truncate hover:underline">
              {blockedUser.displayName || blockedUser.username}
            </span>
            <span className="text-xs text-uupm-ink-muted font-bold truncate">
              @{blockedUser.username}
            </span>
          </div>
          <p className="text-xs text-uupm-danger-text font-bold mt-0.5">
            Đã chặn
          </p>
        </div>
      </button>

      {/* Nút Bỏ chặn */}
      <button
        type="button"
        onClick={() => onUnblock(targetUserId)}
        className="px-3 py-1.5 rounded-xs bg-uupm-surface hover:bg-uupm-danger/10 text-uupm-danger-text border-2 border-uupm-line shadow-uupm-active flex items-center gap-1.5 text-xs font-black cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
        title="Bỏ chặn người dùng này"
      >
        <ShieldOff className="w-3.5 h-3.5" />
        <span>Bỏ chặn</span>
      </button>
    </div>
  );
};
