import React from "react";
import { Check, X } from "lucide-react";
import { FriendRequestItem as FriendRequestItemType, FriendRequestUser } from "../types/friend.types";

export interface FriendRequestItemProps {
  request: FriendRequestItemType;
  type: "received" | "sent";
  onAccept?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
  onOpenProfile?: (userId: string) => void;
}

/**
 * Thành phần hiển thị một mục lời mời kết bạn (dành cho cả lời mời nhận được và đã gửi)
 */
export const FriendRequestItem: React.FC<FriendRequestItemProps> = ({
  request,
  type,
  onAccept,
  onReject,
  onCancel,
  onOpenProfile,
}) => {
  const requestId = request._id || request.id || "";

  // Xác định người dùng đối diện trong quan hệ
  const otherUserRaw = type === "received" ? request.senderId : request.receiverId;
  const otherUser: FriendRequestUser =
    typeof otherUserRaw === "object" && otherUserRaw !== null
      ? otherUserRaw
      : {
          id: String(otherUserRaw),
          username: "user",
          displayName: "Người dùng",
        };

  const targetUserId = otherUser.id || otherUser._id || "";

  return (
    <div className="flex items-center justify-between p-3 rounded-xs border-b border-uupm-line/20 hover:bg-uupm-surface-hover transition-colors gap-3">
      {/* Khối thông tin người gửi/nhận */}
      <div
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        onClick={() => targetUserId && onOpenProfile?.(targetUserId)}
        title="Nhấp để xem hồ sơ"
      >
        {/* Ảnh đại diện */}
        <div className="shrink-0 w-10 h-10 rounded-full border-2 border-uupm-line overflow-hidden bg-uupm-page flex items-center justify-center font-black text-uupm-ink">
          {otherUser.avatarUrl ? (
            <img
              src={otherUser.avatarUrl}
              alt={`Avatar của ${otherUser.displayName}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{(otherUser.displayName || otherUser.username || "U").slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        {/* Tên và ghi chú / trạng thái */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-sm text-uupm-ink truncate hover:underline">
              {otherUser.displayName || otherUser.username}
            </span>
            <span className="text-xs text-uupm-ink-muted font-bold truncate">
              @{otherUser.username}
            </span>
          </div>

          <p className="text-xs text-uupm-ink-muted font-medium mt-0.5 truncate">
            {type === "received"
              ? request.note
                ? `"${request.note}"`
                : "Lời mời kết bạn nhận được"
              : "Lời mời kết bạn đã gửi — Đang chờ phản hồi"}
          </p>
        </div>
      </div>

      {/* Khối nút tương tác */}
      <div className="flex items-center gap-2 shrink-0">
        {type === "received" ? (
          <>
            {/* Nút Chấp nhận */}
            <button
              type="button"
              onClick={() => onAccept?.(requestId)}
              className="w-9 h-9 rounded-xs bg-uupm-accent hover:bg-uupm-accent-hover text-uupm-accent-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
              title="Chấp nhận kết bạn"
              aria-label="Chấp nhận lời mời kết bạn"
            >
              <Check className="w-4 h-4 stroke-[3]" />
            </button>

            {/* Nút Từ chối */}
            <button
              type="button"
              onClick={() => onReject?.(requestId)}
              className="w-9 h-9 rounded-xs bg-uupm-surface hover:bg-uupm-danger/10 text-uupm-danger-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
              title="Từ chối lời mời"
              aria-label="Từ chối lời mời kết bạn"
            >
              <X className="w-4 h-4 stroke-[3]" />
            </button>
          </>
        ) : (
          /* Nút Hủy lời mời đã gửi */
          <button
            type="button"
            onClick={() => onCancel?.(requestId)}
            className="w-9 h-9 rounded-xs bg-uupm-surface hover:bg-uupm-danger/10 text-uupm-danger-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
            title="Hủy lời mời kết bạn"
            aria-label="Hủy lời mời kết bạn"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        )}
      </div>
    </div>
  );
};
