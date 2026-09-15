import React from "react";
import { Users, User as UserIcon, X } from "lucide-react";
import { Conversation } from "../../../types/chat.types";
import { cn } from "../../../lib/utils";

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId?: string;
  isActive: boolean;
  isOnline?: boolean;
  onClick: () => void;
  onCloseConversation?: (e: React.MouseEvent) => void;
}

/**
 * Thẻ hiển thị cuộc trò chuyện trực tiếp phong cách Discord (ConversationItem)
 * Thiết kế Tactile Neo-Brutalist chuẩn UI/UX Pro Max:
 * - Avatar bo góc rounded-xs viền 2px #2d3748 kèm chấm tròn trực tuyến
 * - Tên đối tác in đậm kèm biểu tượng trạng thái
 * - Dòng tóm tắt tin nhắn cuối cùng hoặc trạng thái hoạt động
 * - Huy hiệu tin chưa đọc nền đỏ viền đen sắc nét
 * - Nút X ẩn cuộc trò chuyện xuất hiện khi rê chuột (hover)
 * - Hiệu ứng lún chìm cơ học khi hover và click
 */
export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  currentUserId,
  isActive,
  isOnline = false,
  onClick,
  onCloseConversation,
}) => {
  // Xác định thông tin hiển thị theo loại hội thoại
  const isGroup = conversation.type === "GROUP";

  // Với trò chuyện trực tiếp: tìm đối tác khác với bản thân
  const partner = !isGroup
    ? conversation.participants.find((p) => p.id !== currentUserId) || conversation.participants[0]
    : null;

  // Tên hiển thị của cuộc trò chuyện
  const displayName = isGroup
    ? conversation.title || "Cuộc trò chuyện nhóm"
    : partner?.displayName || partner?.username || "Người dùng";

  // Định dạng thời gian gửi tin nhắn gần nhất
  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  // Nội dung tóm tắt tin nhắn cuối
  const lastMessageText = conversation.lastMessage
    ? conversation.lastMessage.type === "IMAGE"
      ? "[Hình ảnh]"
      : conversation.lastMessage.type === "FILE"
      ? "[Tập tin]"
      : conversation.lastMessage.content
    : isOnline
    ? "Đang trực tuyến"
    : "Ngoại tuyến";

  return (
    // Khối ngoài cùng không tương tác: nút đóng là sibling, tránh lồng điều khiển tương tác
    <div className="relative group">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={`Mở cuộc trò chuyện ${displayName}`}
        className={cn(
          "w-full text-left p-2.5 rounded-xs border-2 transition-[background-color,box-shadow,transform] duration-150 ease-out select-none cursor-pointer flex items-center gap-3",
          // Trạng thái được chọn (Active)
          isActive
            ? "bg-uupm-accent/20 border-uupm-line shadow-uupm-active font-bold translate-x-[1px] translate-y-[1px]"
            : "bg-uupm-surface border-uupm-line shadow-uupm-active hover:bg-uupm-surface-hover hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] text-uupm-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        )}
      >
      {/* Khung Avatar kèm chỉ báo trực tuyến */}
      <div className="relative shrink-0">
        <div
          className={cn(
            "w-10 h-10 rounded-xs border-2 border-uupm-line shadow-uupm-active flex items-center justify-center font-black text-sm uppercase overflow-hidden",
            isGroup ? "bg-uupm-accent-soft text-uupm-accent-text" : "bg-uupm-warn-soft text-uupm-warn-soft-ink"
          )}
        >
          {isGroup ? (
            <Users className="w-5 h-5 text-uupm-ink" />
          ) : partner?.avatarUrl ? (
            <img
              src={partner.avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <UserIcon className="w-5 h-5 text-uupm-ink" />
          )}
        </div>

        {/* Chấm tròn trạng thái Online (Chỉ áp dụng cho chat 1-1) */}
        {!isGroup && (
          <span
            className={cn(
              "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-uupm-line",
              isOnline ? "bg-uupm-accent" : "bg-uupm-ink-muted"
            )}
            title={isOnline ? "Đang trực tuyến" : "Ngoại tuyến"}
          />
        )}
      </div>

      {/* Nội dung tóm tắt cuộc hội thoại */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className="text-xs font-black text-uupm-ink truncate">{displayName}</h3>
            {!isGroup && (
              <span className="text-[10px] shrink-0" title="Trạng thái">
                🌸
              </span>
            )}
          </div>

          <span className="text-[10px] font-bold text-uupm-ink-muted shrink-0">
            {formatTime(conversation.lastMessageAt || conversation.createdAt)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] text-uupm-ink-muted truncate font-semibold">
            {lastMessageText}
          </p>

          {/* Huy hiệu số tin nhắn chưa đọc (Unread Badge) */}
          {Boolean(conversation.unreadCount && conversation.unreadCount > 0) && (
            <span className="shrink-0 min-w-[18px] h-4.5 px-1.5 rounded-full bg-uupm-danger border-2 border-uupm-line text-[9px] font-black text-uupm-danger-ink flex items-center justify-center shadow-uupm-active">
              {conversation.unreadCount! > 99 ? "99+" : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>

      </div>

      {/* Nút X đóng/ẩn cuộc trò chuyện kiểu Discord (Hiện khi hover vào item) — sibling, không lồng trong role=button */}
      {onCloseConversation && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCloseConversation(e);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-xs bg-uupm-surface-hover hover:bg-uupm-danger hover:text-uupm-danger-ink border border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          title="Đóng cuộc trò chuyện"
          aria-label="Đóng cuộc trò chuyện"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
