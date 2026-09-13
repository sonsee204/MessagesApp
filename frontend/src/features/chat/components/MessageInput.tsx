import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Plus,
  Gift,
  Film,
  Smile,
  Sticker,
} from "lucide-react";
import { toast } from "../../../stores/toast.store";

interface MessageInputProps {
  conversationId: string;
  partnerName?: string;
  onSendMessage: (content: string) => Promise<void> | void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

/**
 * Khung nhập tin nhắn dạng nổi phong cách Discord (MessageInput)
 * Thiết kế Tactile Neo-Brutalist chuẩn UI/UX Pro Max:
 * - Khung nhập nổi bo tròn viền 2px #2d3748, bóng đổ vật lý sắc sảo
 * - Nút "+" ở góc trái để đính kèm tệp, ảnh
 * - Placeholder động: "Nhắn @[tên]"
 * - Cụm tiện ích bên phải: Quà tặng (Gift), GIF, Nhãn dán (Sticker), Biểu tượng cảm xúc (Smile)
 * - Nút Gửi xúc giác lún nhấn chìm vật lý
 */
export const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  partnerName = "cuộc trò chuyện",
  onSendMessage,
  onTyping,
  disabled = false,
}) => {
  const [content, setContent] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tự động điều chỉnh tiêu điểm vào ô nhập khi chuyển cuộc hội thoại
  useEffect(() => {
    setContent("");
    onTyping(false);
    textareaRef.current?.focus();
  }, [conversationId, onTyping]);

  // Xử lý sự kiện thay đổi nội dung gõ phím
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    // Kích hoạt tín hiệu đang soạn tin nếu có ký tự
    if (val.trim().length > 0) {
      onTyping(true);
    } else {
      onTyping(false);
    }
  };

  // Xử lý gửi tin nhắn
  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    // Xóa nội dung ô nhập và báo dừng soạn tin tức thời
    setContent("");
    onTyping(false);

    // Gọi hàm gửi tin nhắn từ props
    await onSendMessage(trimmed);

    // Đưa tiêu điểm trở lại ô nhập
    textareaRef.current?.focus();
  };

  // Bắt phím Enter để gửi (trừ khi giữ phím Shift)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-3 md:p-4 bg-uupm-surface border-t-2 border-uupm-line shrink-0">
      {/* Khung nhập nổi dạng Discord (Floating Container) - Cân đối trọng tâm thẳng hàng với danh sách tin nhắn */}
      <div className="w-full max-w-5xl xl:max-w-6xl mx-auto flex items-center gap-2 bg-uupm-page border-2 border-uupm-line rounded-xs shadow-uupm-active p-1.5 focus-within:bg-uupm-surface focus-within:shadow-uupm-2 transition-all">
        {/* Nút "+" đính kèm tệp tin / ảnh ở góc trái */}
        <button
          type="button"
          onClick={() =>
            toast.info(
              "Tính năng tải ảnh và tệp đính kèm đang được kết nối với Cloud Storage.",
              "Đính kèm tệp"
            )
          }
          className="w-8 h-8 rounded-xs bg-uupm-surface-strong hover:bg-uupm-accent hover:text-uupm-accent-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-accent-text shrink-0 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
          title="Tải lên tệp hoặc ảnh"
          aria-label="Tải lên tệp hoặc ảnh"
        >
          <Plus className="w-4 h-4 font-black" />
        </button>

        {/* Ô nhập văn bản đa dòng tự co giãn */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={content}
          disabled={disabled}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Nhắn @${partnerName}`}
          className="flex-1 min-h-[36px] max-h-32 py-1.5 px-2 text-xs md:text-sm font-semibold text-uupm-ink placeholder:text-uupm-ink-muted bg-transparent focus:outline-none resize-none leading-relaxed"
        />

        {/* Cụm nút tiện ích kiểu Discord ở góc phải */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Nút Quà tặng Nitro */}
          <button
            type="button"
            onClick={() =>
              toast.info(
                "Tính năng quà tặng và vật phẩm đang được phát triển.",
                "Quà tặng Nitro"
              )
            }
            className="w-7 h-7 rounded-xs hover:bg-uupm-surface-strong text-uupm-ink-muted hover:text-uupm-ink flex items-center justify-center cursor-pointer transition-colors hidden sm:flex"
            title="Tặng quà"
            aria-label="Tặng quà"
          >
            <Gift className="w-4 h-4" />
          </button>

          {/* Nút GIF */}
          <button
            type="button"
            onClick={() =>
              toast.info("Kho ảnh động GIF đang chuẩn bị ra mắt.", "Kho GIF")
            }
            className="w-7 h-7 rounded-xs hover:bg-uupm-surface-strong text-uupm-ink-muted hover:text-uupm-ink flex items-center justify-center cursor-pointer transition-colors hidden sm:flex"
            title="Mở ảnh GIF"
            aria-label="Mở ảnh GIF"
          >
            <Film className="w-4 h-4" />
          </button>

          {/* Nút Nhãn dán Sticker */}
          <button
            type="button"
            onClick={() =>
              toast.info("Bộ sưu tập Sticker độc quyền đang được tích hợp.", "Nhãn dán")
            }
            className="w-7 h-7 rounded-xs hover:bg-uupm-surface-strong text-uupm-ink-muted hover:text-uupm-ink flex items-center justify-center cursor-pointer transition-colors hidden sm:flex"
            title="Mở nhãn dán"
            aria-label="Mở nhãn dán"
          >
            <Sticker className="w-4 h-4" />
          </button>

          {/* Nút Biểu tượng cảm xúc (Emoji) */}
          <button
            type="button"
            onClick={() =>
              toast.info(
                "Bộ biểu tượng cảm xúc Discord Emojis đang chuẩn bị mở.",
                "Biểu tượng cảm xúc"
              )
            }
            className="w-7 h-7 rounded-xs hover:bg-uupm-surface-strong text-uupm-ink-muted hover:text-uupm-ink flex items-center justify-center cursor-pointer transition-colors"
            title="Chọn biểu cảm"
            aria-label="Chọn biểu cảm"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Nút Gửi Xúc Giác (Tactile Send Button) */}
          <button
            type="button"
            disabled={disabled || !content.trim()}
            onClick={handleSend}
            className="h-8 px-3 rounded-xs bg-uupm-accent hover:bg-uupm-accent-hover disabled:bg-uupm-surface-strong disabled:opacity-50 disabled:cursor-not-allowed border-2 border-uupm-line shadow-uupm-active text-uupm-accent-text font-black text-xs uppercase flex items-center gap-1 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
            title="Gửi tin nhắn"
            aria-label="Gửi tin nhắn"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Gửi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
