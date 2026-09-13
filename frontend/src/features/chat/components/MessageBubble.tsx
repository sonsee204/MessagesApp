import React from "react";
import { User as UserIcon } from "lucide-react";
import { Message } from "../../../types/chat.types";
import { cn } from "../../../lib/utils";

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  showAvatar?: boolean;
}

/**
 * Bong bóng hiển thị nội dung tin nhắn (MessageBubble)
 * Phong cách Tactile Neo-Brutalist:
 * 1. Viền 2px #2d3748, bóng đổ vật lý shadow-uupm-active
 * 2. Tin nhắn của chính mình: Nền xanh lá #22c55e, căn lề phải
 * 3. Tin nhắn của người đối thoại: Nền trắng sạch, căn lề trái kèm avatar
 * 4. Hiển thị mốc thời gian gửi tin nhắn chính xác
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMe,
  showAvatar = true,
}) => {
  // Định dạng giờ gửi tin nhắn (HH:mm)
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className={cn(
        "flex items-end gap-2 my-1.5",
        isMe ? "justify-end" : "justify-start"
      )}
    >
      {/* Avatar của người gửi (Chỉ hiển thị khi nhận tin từ người khác) */}
      {!isMe && showAvatar && (
        <div className="w-8 h-8 rounded-xs bg-[#add8e6] border-2 border-[#2d3748] shadow-uupm-active flex items-center justify-center shrink-0 mb-1 overflow-hidden">
          {message.sender?.avatarUrl ? (
            <img
              src={message.sender.avatarUrl}
              alt={message.sender.displayName || message.sender.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <UserIcon className="w-4 h-4 text-[#0f172a]" />
          )}
        </div>
      )}

      {/* Khoảng trống bù avatar nếu không hiển thị avatar liên tiếp */}
      {!isMe && !showAvatar && <div className="w-8 shrink-0" />}

      {/* Khung nội dung tin nhắn */}
      <div
        className={cn(
          "max-w-[75%] md:max-w-[65%] p-3 rounded-xs border-2 select-text",
          isMe
            ? "bg-[#22c55e] text-[#0f172a] border-[#2d3748] shadow-uupm-active rounded-br-none"
            : "bg-white text-[#0f172a] border-[#2d3748] shadow-uupm-active rounded-bl-none"
        )}
      >
        {/* Tên người gửi trong phòng chat nhóm */}
        {!isMe && message.sender && (
          <p className="text-[11px] font-black text-slate-600 mb-1">
            {message.sender.displayName || message.sender.username}
          </p>
        )}

        {/* Nội dung tin nhắn văn bản */}
        <p className="text-sm font-semibold whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>

        {/* Mốc thời gian gửi */}
        <div
          className={cn(
            "text-[10px] font-bold mt-1 text-right",
            isMe ? "text-[#0f172a]/75" : "text-slate-400"
          )}
        >
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
};
