import React, { useState } from "react";
import {
  ArrowLeft,
  Users,
  User as UserIcon,
  Phone,
  Video,
  Pin,
  UserPlus,
  UserCircle2,
  Search,
  Inbox,
  HelpCircle,
  Hash,
  AtSign,
} from "lucide-react";
import { Conversation } from "../../../types/chat.types";
import { toast } from "../../../stores/toast.store";
import { cn } from "../../../lib/utils";
import { ThemeToggle } from "../../../components/ui/ThemeToggle";

interface ChatHeaderProps {
  conversation: Conversation;
  currentUserId?: string;
  isOnline?: boolean;
  typingUsers?: Array<{ userId: string; username: string }>;
  isProfileOpen?: boolean;
  onToggleProfile?: () => void;
  onBack?: () => void;
}

/**
 * Thanh tiêu đề hội thoại kiểu Discord (ChatHeader)
 * Thiết kế Tactile Neo-Brutalist chuẩn UI/UX Pro Max:
 * - Biểu tượng @ hoặc # trong khung tactile viền 2px #2d3748
 * - Tên đối tác/nhóm in đậm kèm trạng thái hoạt động / typing indicator
 * - Dàn nút tác vụ Discord: Gọi thoại, Video, Ghim tin, Thêm bạn, Toggle Profile, Tìm kiếm
 * - Nút chuyển đổi (Toggle) bảng hồ sơ Cột 3 với trạng thái Active rõ ràng
 */
export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  currentUserId,
  isOnline = false,
  typingUsers = [],
  isProfileOpen = true,
  onToggleProfile,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const isGroup = conversation.type === "GROUP";

  // Lấy thông tin đối tác trò chuyện (với chat 1-1)
  const partner = !isGroup
    ? conversation.participants.find((p) => p.id !== currentUserId) || conversation.participants[0]
    : null;

  // Tên tiêu đề cuộc trò chuyện
  const title = isGroup
    ? conversation.title || "Cuộc trò chuyện nhóm"
    : partner?.displayName || partner?.username || "Người dùng";

  // Lọc danh sách người đang gõ tin (loại trừ chính bản thân mình)
  const activeTypers = typingUsers.filter((u) => u.userId !== currentUserId);
  const isAnyoneTyping = activeTypers.length > 0;

  // Chuỗi thông báo người đang gõ phím
  const typingText =
    activeTypers.length === 1
      ? `${activeTypers[0].username} đang soạn tin...`
      : `${activeTypers.length} người đang soạn tin...`;

  return (
    <div className="h-14 px-3 md:px-4 bg-uupm-surface border-b-2 border-uupm-line flex items-center justify-between shrink-0 select-none z-10 gap-2">
      {/* 1. Phần thông tin đối tác bên trái */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Nút Quay lại trên Mobile */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden w-8 h-8 rounded-xs bg-uupm-surface border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink hover:bg-uupm-surface-hover cursor-pointer"
            aria-label="Quay lại danh sách hội thoại"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* Biểu tượng @ hoặc # theo phong cách Discord */}
        <div className="w-8 h-8 rounded-xs bg-uupm-page border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink-soft shrink-0">
          {isGroup ? (
            <Hash className="w-4 h-4 text-uupm-ink" />
          ) : (
            <AtSign className="w-4 h-4 text-uupm-ink" />
          )}
        </div>

        {/* Khung Avatar nhỏ */}
        <div className="relative shrink-0 hidden sm:block">
          <div className="w-7 h-7 rounded-xs border-2 border-uupm-line shadow-uupm-active flex items-center justify-center overflow-hidden bg-uupm-accent-soft">
            {isGroup ? (
              <Users className="w-3.5 h-3.5 text-uupm-ink" />
            ) : partner?.avatarUrl ? (
              <img
                src={partner.avatarUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon className="w-3.5 h-3.5 text-uupm-ink" />
            )}
          </div>
          {!isGroup && (
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-uupm-line",
                isOnline ? "bg-uupm-accent" : "bg-uupm-ink-muted"
              )}
            />
          )}
        </div>

        {/* Tên và Trạng thái */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-black text-uupm-ink truncate leading-none">
              {title}
            </h2>
            {!isGroup && <span className="text-xs">🌸</span>}
          </div>

          {/* Chỉ báo đang soạn tin hoặc trạng thái */}
          {isAnyoneTyping ? (
            <div className="flex items-center gap-1 text-[11px] font-bold text-uupm-accent animate-pulse">
              <span>{typingText}</span>
              <span className="inline-flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-uupm-accent animate-bounce" />
                <span className="w-1 h-1 rounded-full bg-uupm-accent animate-bounce [animation-delay:0.2s]" />
                <span className="w-1 h-1 rounded-full bg-uupm-accent animate-bounce [animation-delay:0.4s]" />
              </span>
            </div>
          ) : (
            <p className="text-[10px] font-bold text-uupm-ink-muted">
              {isGroup
                ? `${conversation.participants.length} thành viên`
                : isOnline
                ? "Trực tuyến"
                : "Ngoại tuyến"}
            </p>
          )}
        </div>
      </div>

      {/* 2. Dàn nút tác vụ bên phải kiểu Discord */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Nút chuyển đổi chế độ Sáng / Tối */}
        <ThemeToggle className="mr-0.5" />

        {/* Nút Bắt đầu cuộc gọi thoại */}
        <button
          type="button"
          onClick={() =>
            toast.info(
              `Đang kết nối cuộc gọi thoại với ${title}...`,
              "Cuộc gọi thoại"
            )
          }
          className="w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
          title="Bắt đầu cuộc gọi thoại"
          aria-label="Bắt đầu cuộc gọi thoại"
        >
          <Phone className="w-4 h-4 text-uupm-ink-soft" />
        </button>

        {/* Nút Bắt đầu cuộc gọi video */}
        <button
          type="button"
          onClick={() =>
            toast.info(
              `Đang kết nối cuộc gọi video với ${title}...`,
              "Cuộc gọi video"
            )
          }
          className="w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
          title="Bắt đầu cuộc gọi video"
          aria-label="Bắt đầu cuộc gọi video"
        >
          <Video className="w-4 h-4 text-uupm-ink-soft" />
        </button>

        {/* Nút Tin nhắn đã ghim */}
        <button
          type="button"
          onClick={() =>
            toast.info("Hiện chưa có tin nhắn nào được ghim trong hội thoại.", "Tin nhắn đã ghim")
          }
          className="w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px] hidden sm:flex"
          title="Tin nhắn đã ghim"
          aria-label="Tin nhắn đã ghim"
        >
          <Pin className="w-4 h-4 text-uupm-ink-soft" />
        </button>

        {/* Nút Thêm bạn bè vào DM */}
        <button
          type="button"
          onClick={() =>
            toast.info("Mời bạn bè vào cuộc trò chuyện đang được hoàn thiện.", "Thêm bạn vào nhóm")
          }
          className="w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px] hidden sm:flex"
          title="Thêm bạn bè vào nhóm"
          aria-label="Thêm bạn bè vào nhóm"
        >
          <UserPlus className="w-4 h-4 text-uupm-ink-soft" />
        </button>

        {/* Nút BẬT/TẮT Bảng Hồ Sơ Người Dùng (Cột 3 Toggle) */}
        {onToggleProfile && (
          <button
            type="button"
            onClick={onToggleProfile}
            className={cn(
              "w-8 h-8 rounded-xs border-2 border-uupm-line shadow-uupm-active flex items-center justify-center cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]",
              isProfileOpen
                ? "bg-uupm-accent text-uupm-accent-text"
                : "bg-uupm-surface hover:bg-uupm-surface-hover text-uupm-ink-soft"
            )}
            title={isProfileOpen ? "Ẩn hồ sơ người dùng" : "Hiện hồ sơ người dùng"}
            aria-label={isProfileOpen ? "Ẩn hồ sơ người dùng" : "Hiện hồ sơ người dùng"}
          >
            <UserCircle2 className="w-4 h-4" />
          </button>
        )}

        {/* Ô tìm kiếm tin nhắn trong hội thoại */}
        <div className="relative hidden lg:block">
          <Search className="w-3.5 h-3.5 text-uupm-ink-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm..."
            aria-label="Tìm kiếm tin nhắn trong cuộc trò chuyện"
            className="w-32 xl:w-40 pl-2.5 pr-7 py-1 text-xs font-semibold bg-uupm-page rounded-xs border-2 border-uupm-line shadow-uupm-active focus:bg-uupm-surface focus:outline-none focus:w-48 transition-[background-color,box-shadow,transform]"
          />
        </div>

        {/* Nút Hộp thư thông báo */}
        <button
          type="button"
          onClick={() => toast.info("Hộp thư thông báo hiện không có tin mới.", "Hộp thư")}
          className="w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px] hidden xl:flex"
          title="Hộp thư"
          aria-label="Hộp thư"
        >
          <Inbox className="w-4 h-4 text-uupm-ink-soft" />
        </button>

        {/* Nút Trợ giúp */}
        <button
          type="button"
          onClick={() =>
            toast.info(
              "AppMessaging - Hệ thống nhắn tin thời gian thực Neo-Brutalist Discord Style.",
              "Trợ giúp"
            )
          }
          className="w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px] hidden xl:flex"
          title="Trợ giúp"
          aria-label="Trợ giúp"
        >
          <HelpCircle className="w-4 h-4 text-uupm-ink-soft" />
        </button>
      </div>
    </div>
  );
};
