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
import { EmojiPicker, PickedEmoji } from "./EmojiPicker";
import { StickerPicker } from "./StickerPicker";
import { MediaPreviewBar } from "./MediaPreviewBar";
import type { MediaUploadState } from "../hooks/useMediaUpload";
import { Message, MessageAttachment } from "../../../types/chat.types";
import { cn } from "../../../lib/utils";

// Danh sách MIME được phép cho input[type=file] accept — khớp whitelist hook useMediaUpload.
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/x-rar-compressed,application/vnd.rar,application/x-7z-compressed,text/plain,text/csv";

interface MessageInputProps {
  conversationId: string;
  partnerName?: string;
  // Gửi tin nhắn: văn bản thuần (TEXT) hoặc sticker/GIF (IMAGE + attachments)
  onSendMessage: (
    content: string,
    type?: Message["type"],
    attachments?: Message["attachments"]
  ) => Promise<void> | void;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
  // Trạng thái media upload do ChatLayout quản lý (lift state pattern).
  media?: MediaUploadState;
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
  media,
}) => {
  const [content, setContent] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Input file ẩn: nút "+" lập trình click vào đây để mở hộp chọn tệp.
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Trạng thái mở/đóng popup chọn emoji (bind vào nút Smile để highlight đúng kiểu nút Bell)
  const [isEmojiOpen, setIsEmojiOpen] = useState<boolean>(false);
  // Trạng thái mở/đóng popup kho sticker (bind vào nút Sticker để highlight khi đang mở)
  const [isStickerOpen, setIsStickerOpen] = useState<boolean>(false);

  // Tự động điều chỉnh tiêu điểm vào ô nhập khi chuyển cuộc hội thoại
  useEffect(() => {
    setContent("");
    onTyping(false);
    setIsEmojiOpen(false);
    setIsStickerOpen(false);
    // Xoá queue media cũ khi chuyển sang cuộc hội thoại khác.
    media?.clear();
    textareaRef.current?.focus();
  }, [conversationId, onTyping, media]);

  // Chèn emoji vào ĐÚNG vị trí con trỏ đang đứng (không append mù quáng vào cuối chuỗi),
  // sau đó trả con trỏ ngay sau emoji và giữ tiêu điểm để người dùng gõ tiếp.
  const handleInsertEmoji = (emoji: PickedEmoji) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji.native + content.slice(end);

    setContent(next);
    // Emoji ghép có độ dài UTF-16 > 1 (vd. gia đình): đặt con trỏ theo độ dài thực đo được
    const caret = start + emoji.native.length;
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(caret, caret);
    });

    // Có nội dung thì phát tín hiệu đang soạn tin
    if (next.trim().length > 0) onTyping(true);
  };

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

  // Xử lý gửi tin nhắn: upload tệp (nếu có) trước, sau đó gửi nội dung + attachments.
  const handleSend = async () => {
    if (disabled) return;
    const trimmed = content.trim();
    let attachments: MessageAttachment[] = [];

    // Upload tệp từ queue nếu có (trả attachments[] rỗng nếu không có gì queued).
    if (media && media.items.length > 0) {
      if (media.isUploading) return; // Đang upload → chặn bấm gửi lần nữa.
      attachments = await media.uploadAll();
    }

    // Không có gì để gửi: không text + không attachment.
    if (!trimmed && attachments.length === 0) return;

    // Suy ra type: toàn ảnh → IMAGE, có file/video → FILE, chỉ text → TEXT.
    const type: Message["type"] =
      attachments.length === 0
        ? "TEXT"
        : attachments.every((a) => a.mimeType.startsWith("image/"))
          ? "IMAGE"
          : "FILE";

    setContent("");
    onTyping(false);
    media?.clear();

    await onSendMessage(trimmed, type, attachments.length > 0 ? attachments : undefined);
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
    <div className="min-h-[84px] px-3 md:px-4 bg-uupm-surface border-t-2 border-uupm-line shrink-0 flex flex-col justify-center py-2">
      {/* Dải preview các tệp đang chờ upload (ẩn khi queue rỗng) */}
      {media && <MediaPreviewBar items={media.items} onRemove={media.removeItem} />}

      {/* Input file ẩn: mở bởi nút "+" — nhiều tệp, giới hạn MIME ở whitelist ở trên */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          // Reset value sau mỗi lần chọn để cho phép chọn lại đúng 1 tệp bị loại trước đó.
          if (e.target.files && e.target.files.length > 0) media?.pickFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Khung nhập nổi dạng Discord (Floating Container) - Cân đối trọng tâm thẳng hàng với danh sách tin nhắn */}
      <div className="w-full max-w-5xl xl:max-w-6xl mx-auto flex items-center gap-2 bg-uupm-page border-2 border-uupm-line rounded-xs shadow-uupm-active p-1.5 focus-within:bg-uupm-surface focus-within:shadow-uupm-2 transition-all">
        {/* Nút "+" đính kèm tệp tin / ảnh ở góc trái — mở hộp chọn tệp hệ điều hành */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!media}
          className="w-8 h-8 rounded-xs bg-uupm-surface-strong hover:bg-uupm-accent hover:text-uupm-accent-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-accent-text shrink-0 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Nút Nhãn dán Sticker: mở kho sticker Klipy, chọn là gửi ngay tin nhắn IMAGE */}
          <StickerPicker
            open={isStickerOpen}
            onOpenChange={setIsStickerOpen}
            onSelect={(attachment) =>
              void onSendMessage("", "IMAGE", [attachment])
            }
          >
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={isStickerOpen}
              className={cn(
                "w-7 h-7 rounded-xs flex items-center justify-center cursor-pointer transition-colors hidden sm:flex",
                isStickerOpen
                  ? "bg-uupm-surface-strong text-uupm-ink"
                  : "hover:bg-uupm-surface-strong text-uupm-ink-muted hover:text-uupm-ink"
              )}
              title="Mở nhãn dán"
              aria-label="Mở nhãn dán"
            >
              <Sticker className="w-4 h-4" />
            </button>
          </StickerPicker>

          {/* Nút Biểu tượng cảm xúc (Emoji): kích hoạt popup chọn emoji kiểu Discord */}
          <EmojiPicker
            open={isEmojiOpen}
            onOpenChange={setIsEmojiOpen}
            onSelect={handleInsertEmoji}
          >
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={isEmojiOpen}
              className={cn(
                "w-7 h-7 rounded-xs flex items-center justify-center cursor-pointer transition-colors",
                isEmojiOpen
                  ? "bg-uupm-surface-strong text-uupm-ink"
                  : "hover:bg-uupm-surface-strong text-uupm-ink-muted hover:text-uupm-ink"
              )}
              title="Chọn biểu cảm"
              aria-label="Chọn biểu cảm"
            >
              <Smile className="w-4 h-4" />
            </button>
          </EmojiPicker>

          {/* Nút Gửi Xúc Giác (Tactile Send Button) */}
          <button
            type="button"
            disabled={disabled || media?.isUploading || (!content.trim() && (!media || media.items.length === 0))}
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
