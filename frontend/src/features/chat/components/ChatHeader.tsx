import React, { useState } from "react";
import {
  ArrowLeft,
  Users,
  User as UserIcon,
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
import { CallButtons } from "../../call/components/molecules/CallButtons";

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
 * Nút tác vụ chuẩn của thanh tiêu đề (Discord-style 8x8 tactical button).
 * Tách thành molecule local để triệt tiêu 8 khối JSX lặp lại và giảm complexity
 * của ChatHeader (rule no-high-complexity-react-function).
 */
function ChatHeaderActionButton({
  icon,
  label,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]",
        className
      )}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

/**
 * Khối thông tin đối tác/thuộc tính hội thoại bên trái thanh tiêu đề.
 * Tách thành child component để chuyển các nhánh điều kiện (?:, &&) ra khỏi
 * hàm ChatHeader, giảm độ phức tạp control-flow (rule no-high-complexity-react-function).
 */
function ChatHeaderPartnerInfo({
  isGroup,
  title,
  partner,
  isOnline,
  isAnyoneTyping,
  typingText,
  memberCount,
  onBack,
}: {
  isGroup: boolean;
  title: string;
  partner: { displayName?: string; username?: string; avatarUrl?: string | null } | null;
  isOnline: boolean;
  isAnyoneTyping: boolean;
  typingText: string;
  memberCount: number;
  onBack?: () => void;
}) {
  return (
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
              ? `${memberCount} thành viên`
              : isOnline
              ? "Trực tuyến"
              : "Ngoại tuyến"}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Ô tìm kiếm tin nhắn trong hội thoại (ẩn dưới breakpoint lg).
 * Tách khỏi ChatHeader để giảm độ phức tạp hàm cha.
 */
function ChatHeaderSearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative hidden lg:block">
      <Search className="w-3.5 h-3.5 text-uupm-ink-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tìm kiếm..."
        aria-label="Tìm kiếm tin nhắn trong cuộc trò chuyện"
        className="w-32 xl:w-40 pl-2.5 pr-7 py-1 text-xs font-semibold bg-uupm-page rounded-xs border-2 border-uupm-line shadow-uupm-active focus:bg-uupm-surface focus:outline-none focus:w-48 transition-[background-color,box-shadow,transform]"
      />
    </div>
  );
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

  // Cấu hình dàn nút tác vụ bên phải — render vòng lặp để giảm độ phức tạp hàm cha
  const toolbarActions: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    className?: string;
  }> = [
    {
      label: "Tin nhắn đã ghim",
      icon: <Pin className="w-4 h-4 text-uupm-ink-soft" />,
      onClick: () =>
        toast.info("Hiện chưa có tin nhắn nào được ghim trong hội thoại.", "Tin nhắn đã ghim"),
      className: "hidden sm:flex",
    },
    {
      label: "Thêm bạn bè vào nhóm",
      icon: <UserPlus className="w-4 h-4 text-uupm-ink-soft" />,
      onClick: () =>
        toast.info("Mời bạn bè vào cuộc trò chuyện đang được hoàn thiện.", "Thêm bạn vào nhóm"),
      className: "hidden sm:flex",
    },
  ];

  // Nút ẩn sau breakpoint xl (Hộp thư, Trợ giúp) — nhóm riêng cho gọn JSX
  const overflowActions: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }> = [
    {
      label: "Hộp thư",
      icon: <Inbox className="w-4 h-4 text-uupm-ink-soft" />,
      onClick: () => toast.info("Hộp thư thông báo hiện không có tin mới.", "Hộp thư"),
    },
    {
      label: "Trợ giúp",
      icon: <HelpCircle className="w-4 h-4 text-uupm-ink-soft" />,
      onClick: () =>
        toast.info(
          "AppMessaging - Hệ thống nhắn tin thời gian thực Neo-Brutalist Discord Style.",
          "Trợ giúp"
        ),
    },
  ];

  return (
    <div className="h-14 px-3 md:px-4 bg-uupm-surface border-b-2 border-uupm-line flex items-center justify-between shrink-0 select-none z-10 gap-2">
      {/* 1. Phần thông tin đối tác bên trái — tách sang ChatHeaderPartnerInfo */}
      <ChatHeaderPartnerInfo
        isGroup={isGroup}
        title={title}
        partner={partner}
        isOnline={isOnline}
        isAnyoneTyping={isAnyoneTyping}
        typingText={typingText}
        memberCount={conversation.participants.length}
        onBack={onBack}
      />

      {/* 2. Dàn nút tác vụ bên phải kiểu Discord — render từ toolbarActions config */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ThemeToggle className="mr-0.5" />

        {/* Cụm nút gọi thoại và video (chỉ hiển thị cho hội thoại 1-1 trực tiếp) */}
        <CallButtons peerId={partner?.id} conversationType={conversation.type} />

        {toolbarActions.map((action) => (
          <ChatHeaderActionButton
            key={action.label}
            icon={action.icon}
            label={action.label}
            onClick={action.onClick}
            className={action.className}
          />
        ))}

        {overflowActions.map((action) => (
          <ChatHeaderActionButton
            key={action.label}
            icon={action.icon}
            label={action.label}
            onClick={action.onClick}
            className="hidden xl:flex"
          />
        ))}

        {/* Nút bật/tắt bảng hồ sơ Cột 3 (trạng thái active đổi màu riêng) */}
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

        {/* Ô tìm kiếm tin nhắn trong hội thoại — tách sang ChatHeaderSearchBox */}
        <ChatHeaderSearchBox value={searchQuery} onChange={setSearchQuery} />
      </div>
    </div>
  );
};
