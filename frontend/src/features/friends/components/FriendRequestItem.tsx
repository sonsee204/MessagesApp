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
 * Chuẩn hóa người đối diện thành đối tượng FriendRequestUser.
 * Hỗ trợ cả trường hợp populate object hoặc chỉ id thuần (string).
 * Pure helper module-scope để giảm complexity của FriendRequestItem.
 */
function resolveOtherUser(raw: FriendRequestUser | string | undefined): FriendRequestUser {
  if (typeof raw === "object" && raw !== null) return raw;
  return { id: String(raw), username: "user", displayName: "Người dùng" };
}

/**
 * Cụm nút hành động cho mỗi loại lời mời (received: Accept/Reject, sent: Cancel).
 * Tách thành child component để chuyển các nhánh điều kiện ra khỏi FriendRequestItem
 * (rule no-high-complexity-react-function).
 */
function FriendRequestActions({
  type,
  requestId,
  onAccept,
  onReject,
  onCancel,
}: {
  type: "received" | "sent";
  requestId: string;
  onAccept?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
}) {
  if (type === "received") {
    return (
      <>
        <button
          type="button"
          onClick={() => onAccept?.(requestId)}
          className="w-9 h-9 rounded-xs bg-uupm-accent hover:bg-uupm-accent-hover text-uupm-accent-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
          title="Chấp nhận kết bạn"
          aria-label="Chấp nhận lời mời kết bạn"
        >
          <Check className="w-4 h-4 stroke-[3]" />
        </button>
        <button
          type="button"
          onClick={() => onReject?.(requestId)}
          className="w-9 h-9 rounded-xs bg-uupm-surface hover:bg-uupm-danger/10 text-uupm-danger-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
          title="Từ chối lời mời"
          aria-label="Từ chối lời mời kết bạn"
        >
          <X className="w-4 h-4 stroke-[3]" />
        </button>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onCancel?.(requestId)}
      className="w-9 h-9 rounded-xs bg-uupm-surface hover:bg-uupm-danger/10 text-uupm-danger-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
      title="Hủy lời mời kết bạn"
      aria-label="Hủy lời mời kết bạn"
    >
      <X className="w-4 h-4 stroke-[3]" />
    </button>
  );
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

  // Xác định người dùng đối diện — dùng pure helper module-scope
  const otherUser = resolveOtherUser(
    type === "received" ? request.senderId : request.receiverId
  );
  const targetUserId = otherUser.id || otherUser._id || "";

  // Ghi chú/mô tả cho từng loại lời mời
  const noteText =
    type === "received"
      ? request.note
        ? `"${request.note}"`
        : "Lời mời kết bạn nhận được"
      : "Lời mời kết bạn đã gửi — Đang chờ phản hồi";

  return (
    <div className="flex items-center justify-between p-3 rounded-xs border-b border-uupm-line/20 hover:bg-uupm-surface-hover transition-colors gap-3">
      {/* Khối thông tin người gửi/nhận — button语义 */}
      <button
        type="button"
        onClick={() => targetUserId && onOpenProfile?.(targetUserId)}
        title="Nhấp để xem hồ sơ"
        aria-label={`Xem hồ sơ ${otherUser.displayName || otherUser.username}`}
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer bg-transparent border-0 p-0 rounded-xs text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uupm-accent"
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
          <p className="text-xs text-uupm-ink-muted font-medium mt-0.5 truncate">{noteText}</p>
        </div>
      </button>

      {/* Khối nút tương tác — tách sang FriendRequestActions */}
      <div className="flex items-center gap-2 shrink-0">
        <FriendRequestActions
          type={type}
          requestId={requestId}
          onAccept={onAccept}
          onReject={onReject}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
};
