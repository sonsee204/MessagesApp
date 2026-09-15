import React, { useState } from "react";
import {
  PhoneCall,
  Reply,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Message } from "../../../types/chat.types";
import { toast } from "../../../stores/toast.store";
import { useChatStore } from "../stores/chat.store";
import { AttachmentRenderer } from "./AttachmentRenderer";
import { cn } from "../../../lib/utils";

interface DiscordMessageItemProps {
  message: Message;
  currentUserId?: string;
  isCompact?: boolean; // Tin nhắn liên tiếp cùng người gửi trong 5 phút
  isCallLog?: boolean; // Sự kiện cuộc gọi thoại hệ thống
}

/**
 * Thành phần dòng tin nhắn theo phong cách Dòng thời gian Discord (DiscordMessageItem)
 * Thiết kế Tactile Neo-Brutalist chuẩn UI/UX Pro Max:
 * - Hiển thị tên người gửi, huy hiệu và mốc thời gian ở đầu mỗi tin nhắn
 * - Đã lược bỏ avatar để tối ưu không gian hiển thị theo yêu cầu người dùng
 * - Thanh công cụ phản ứng nhanh (Hover Action Bar): Thả cảm xúc, Trả lời, Thu hồi
 * - Hỗ trợ hiển thị sự kiện cuộc gọi thoại hệ thống (Call Log)
 */
export const DiscordMessageItem: React.FC<DiscordMessageItemProps> = ({
  message,
  currentUserId,
  isCompact = false,
  isCallLog = false,
}) => {
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const recallMessage = useChatStore((state) => state.recallMessage);
  const isMe = message.senderId === currentUserId;

  // Chỉ người gửi mới được thu hồi tin nhắn của chính mình (Backend cũng chặn ở tầng Service)
  const handleRecall = () => {
    void recallMessage(message.conversationId, message.id);
  };

  const senderName =
    message.sender?.displayName || message.sender?.username || (isMe ? "Bạn" : "Thành viên");

  // Định dạng giờ gửi tin nhắn (vd: 6:52 CH)
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  // Xử lý thả cảm xúc nhanh
  const handleAddReaction = (emoji: string) => {
    setReactions((prev) => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1,
    }));
    toast.success(`Đã thả biểu cảm ${emoji}`, "Phản ứng tin nhắn");
  };

  // 0. Tin nhắn đã bị thu hồi: hiển thị dòng thông báo mờ thay cho nội dung gốc
  if (message.isDeleted) {
    return (
      <div className="flex items-center gap-2 px-4 py-1 select-none">
        <span className="text-xs font-semibold italic text-uupm-ink-muted">
          {isMe ? "Bạn" : senderName} đã thu hồi một tin nhắn
        </span>
        <span className="text-[10px] font-bold text-uupm-ink-muted">
          {formatTime(message.createdAt)}
        </span>
      </div>
    );
  }

  // 1. Nếu là tin nhắn sự kiện cuộc gọi thoại (Call Log Event)
  if (isCallLog) {
    return (
      <div className="group relative flex items-center gap-3 px-4 py-2 hover:bg-uupm-surface-hover/60 rounded-xs transition-colors my-1 select-text">
        <div className="w-8 h-8 rounded-xs bg-uupm-accent border-2 border-uupm-line shadow-uupm-active flex items-center justify-center shrink-0">
          <PhoneCall className="w-4 h-4 text-uupm-ink" />
        </div>
        <div className="flex-1 text-xs font-bold text-uupm-ink flex items-center gap-2 flex-wrap">
          <span>
            <strong className="font-black text-uupm-ink">{senderName}</strong> đã bắt đầu cuộc gọi kéo dài trong vài giây.
          </span>
          <span className="text-[11px] font-semibold text-uupm-ink-muted">
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  // 2. Dòng tin nhắn hiển thị tên người gửi ở đầu (không hiển thị avatar)
  return (
    <div
      className={cn(
        "group relative flex flex-col px-4 py-1.5 hover:bg-uupm-surface-hover/60 rounded-xs transition-colors select-text",
        isCompact ? "mt-1" : "mt-2"
      )}
    >
      {/* Khối nội dung tin nhắn */}
      <div className="w-full min-w-0">
        {/* Dòng tiêu đề: Tên người gửi ở đầu + Huy hiệu + Giờ gửi */}
        <div className="flex items-center gap-2 mb-1 leading-none">
          <span className="text-sm font-black text-uupm-ink hover:underline cursor-pointer">
            {senderName}
          </span>

          {!isMe && (
            <span className="text-xs" title="Biểu tượng">
              🌸
            </span>
          )}

          {isMe && (
            <span className="px-1.5 py-0.2 rounded-xs bg-uupm-accent border border-uupm-line text-[9px] font-black text-uupm-accent-text uppercase">
              Bạn
            </span>
          )}

          <span className="text-[11px] font-bold text-uupm-ink-muted ml-1">
            {formatTime(message.createdAt)}
          </span>
        </div>

        {/* Nội dung văn bản (luôn hiển thị, kể cả khi có attachments — mixed content) */}
        {message.content && (
          <p className="text-sm font-semibold text-uupm-ink whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        )}

        {/* Attachments: render qua AttachmentRenderer (phân loại ảnh/video/file) */}
        <AttachmentRenderer attachments={message.attachments ?? []} />

        {/* Dải cảm xúc đã thả nếu có */}
        {Object.keys(reactions).length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {Object.entries(reactions).map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAddReaction(emoji)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-uupm-surface border-2 border-uupm-line shadow-uupm-active text-xs font-black text-uupm-accent-text hover:bg-uupm-accent-soft cursor-pointer transition-colors"
              >
                <span>{emoji}</span>
                <span className="text-[10px]">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Thanh tác vụ nổi xuất hiện khi hover ở góc trên bên phải */}
      <div className="absolute right-4 -top-3 hidden group-hover:flex items-center bg-uupm-surface border-2 border-uupm-line rounded-xs shadow-uupm-active p-0.5 gap-0.5 z-10 select-none">
        <button
          type="button"
          onClick={() => handleAddReaction("👍")}
          className="w-6 h-6 hover:bg-uupm-surface-hover rounded-xs flex items-center justify-center text-xs cursor-pointer"
          title="Thích"
        >
          👍
        </button>
        <button
          type="button"
          onClick={() => handleAddReaction("❤️")}
          className="w-6 h-6 hover:bg-uupm-surface-hover rounded-xs flex items-center justify-center text-xs cursor-pointer"
          title="Yêu thích"
        >
          ❤️
        </button>
        <button
          type="button"
          onClick={() => handleAddReaction("😂")}
          className="w-6 h-6 hover:bg-uupm-surface-hover rounded-xs flex items-center justify-center text-xs cursor-pointer"
          title="Haha"
        >
          😂
        </button>
        <button
          type="button"
          onClick={() =>
            toast.info(`Trả lời tin nhắn của ${senderName}`, "Trả lời tin nhắn")
          }
          className="w-6 h-6 hover:bg-uupm-surface-hover rounded-xs flex items-center justify-center text-uupm-ink-soft cursor-pointer"
          title="Trả lời"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>
        {isMe ? (
          <button
            type="button"
            onClick={handleRecall}
            className="w-6 h-6 hover:bg-uupm-surface-hover rounded-xs flex items-center justify-center text-uupm-ink-soft cursor-pointer"
            title="Thu hồi tin nhắn"
            aria-label="Thu hồi tin nhắn"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => toast.info("Tùy chọn tin nhắn đang được hoàn thiện", "Tùy chọn")}
            className="w-6 h-6 hover:bg-uupm-surface-hover rounded-xs flex items-center justify-center text-uupm-ink-soft cursor-pointer"
            title="Thêm"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
