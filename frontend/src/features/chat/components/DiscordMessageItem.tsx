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
 * Thành phần dòng tin nhắn theo phong cách 2 cột kiểu Messenger (DiscordMessageItem)
 * Thiết kế Tactile Neo-Brutalist chuẩn UI/UX Pro Max:
 * - isMe=true  → bubble nằm BÊN PHẢI, nền bg-uupm-accent, text tương phản
 * - isMe=false → bubble nằm BÊN TRÁI,  nền bg-uupm-page, text chuẩn
 * - Hover Action Bar: phải với tin của mình, trái với tin người khác
 * - Hỗ trợ Call Log (sự kiện cuộc gọi hệ thống) — không có bubble
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

  // 2. Dòng tin nhắn 2 cột kiểu Messenger
  // - isMe=true  → wrapper justify-end, bubble phải (bg-uupm-accent)
  // - isMe=false → wrapper justify-start, bubble trái (bg-uupm-page)
  return (
    <div
      className={cn(
        // Wrapper ngoài: chiều rộng đầy đủ, flex ngang để bubble trái/phải
        "group relative flex w-full px-4 py-1",
        isCompact ? "mt-0.5" : "mt-2",
        isMe ? "justify-end" : "justify-start"
      )}
    >
      {/* Bubble container: giới hạn max-width để không chiếm toàn màn hình */}
      <div className={cn("relative max-w-[72%] min-w-0 flex flex-col", isMe ? "items-end" : "items-start")}>

        {/* Dòng tiêu đề: tên + badge + giờ — chỉ hiển thị ở tin đầu nhóm */}
        {!isCompact && (
          <div className={cn("flex items-center gap-2 mb-1 leading-none", isMe ? "flex-row-reverse" : "flex-row")}>
            {/* Tên người gửi — ẩn với isMe vì đã có badge "Bạn" */}
            {!isMe && (
              <span className="text-sm font-black text-uupm-ink hover:underline cursor-pointer">
                {senderName}
              </span>
            )}

            {/* Emoji trang trí chỉ cho tin người khác */}
            {!isMe && (
              <span className="text-xs" title="Biểu tượng">
                🌸
              </span>
            )}

            {/* Badge "Bạn" cho tin của mình */}
            {isMe && (
              <span className="px-1.5 py-[2px] rounded-xs bg-uupm-accent border border-uupm-line text-[9px] font-black text-uupm-accent-text uppercase">
                Bạn
              </span>
            )}

            {/* Giờ gửi */}
            <span className="text-[11px] font-bold text-uupm-ink-muted">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}

        {/* Bubble tin nhắn chính
            - isMe    → nền uupm-accent, bo góc: tròn đều trừ góc dưới-phải nhỏ hơn
            - !isMe   → nền uupm-page,   bo góc: tròn đều trừ góc dưới-trái nhỏ hơn
        */}
        <div
          className={cn(
            "px-3 py-2 border-2 border-uupm-line shadow-uupm-active transition-colors",
            isMe
              ? "bg-uupm-accent text-uupm-accent-text rounded-xl rounded-br-sm"
              : "bg-uupm-page text-uupm-ink rounded-xl rounded-bl-sm"
          )}
        >
          {/* Nội dung văn bản */}
          {message.content && (
            <p className="text-sm font-semibold whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          )}

          {/* Attachments: ảnh/video/file */}
          <AttachmentRenderer attachments={message.attachments ?? []} />
        </div>

        {/* Giờ gửi nhỏ bên dưới bubble — chỉ hiển thị khi isCompact (không có header) */}
        {isCompact && (
          <span className="text-[10px] font-semibold text-uupm-ink-muted mt-0.5">
            {formatTime(message.createdAt)}
          </span>
        )}

        {/* Dải cảm xúc đã thả nếu có */}
        {Object.keys(reactions).length > 0 && (
          <div className={cn("flex items-center gap-1 mt-1.5 flex-wrap", isMe ? "justify-end" : "justify-start")}>
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

      {/* Thanh tác vụ nổi (Hover Action Bar):
          - isMe=true  → right-4 (góc phải bên ngoài bubble)
          - isMe=false → left-4  (góc trái bên ngoài bubble)
      */}
      <div
        className={cn(
          "absolute -top-3 hidden group-hover:flex items-center bg-uupm-surface border-2 border-uupm-line rounded-xs shadow-uupm-active p-0.5 gap-0.5 z-10 select-none",
          isMe ? "right-4" : "left-4"
        )}
      >
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
