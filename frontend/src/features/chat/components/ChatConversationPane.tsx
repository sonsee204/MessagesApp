import React, { useState } from "react";
import { Upload, ShieldAlert } from "lucide-react";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { Message } from "../../../types/chat.types";
import { Conversation } from "../../../types/chat.types";
import type { MediaUploadState } from "../hooks/useMediaUpload";

interface ChatConversationPaneProps {
  conversation: Conversation;
  currentUserId?: string;
  isPartnerOnline: boolean;
  partnerDisplayName: string;
  typingUsers: Array<{ userId: string; username: string }>;
  messages: Message[];
  hasMore: boolean | undefined;
  isLoadingMore: boolean | undefined;
  partnerIsBlocked: boolean;
  isProfileOpen: boolean;
  onToggleProfile: () => void;
  onBack: () => void;
  onLoadOlder: () => void;
  onSendMessage: (
    content: string,
    type?: Message["type"],
    attachments?: Message["attachments"]
  ) => Promise<void> | void;
  onTyping: (isTyping: boolean) => void;
  media: MediaUploadState;
}

/**
 * Khung chat trung tâm của một cuộc trò chuyện đang chọn (Cột 2):
 * Vùng kéo-thả tệp + ChatHeader + MessageList + MessageInput (hoặc cảnh báo đã chặn).
 * Tách khỏi ChatLayout để giảm độ dài hàm cha (rule no-giant-component).
 */
export const ChatConversationPane: React.FC<ChatConversationPaneProps> = ({
  conversation,
  currentUserId,
  isPartnerOnline,
  partnerDisplayName,
  typingUsers,
  messages,
  hasMore,
  isLoadingMore,
  partnerIsBlocked,
  isProfileOpen,
  onToggleProfile,
  onBack,
  onLoadOlder,
  onSendMessage,
  onTyping,
  media,
}) => {
  // Cờ hiển thị overlay khi người dùng kéo tệp vào vùng chat.
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  return (
    /* Vùng kéo-thả file bao quanh toàn bộ khung chat.
       Drag-over hiển thị overlay chấm nét đứt; drop chuyển file vào media.pickFiles.
       position:relative để overlay phủ đúng khung, absolute inset-0 chỉ bao đúng box. */
    <div
      className="relative flex flex-col flex-1 min-h-0"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files.length > 0) media.pickFiles(e.dataTransfer.files);
      }}
    >
      {/* Overlay chỉ hiện khi đang kéo tệp vào */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-uupm-accent-soft/80 border-4 border-dashed border-uupm-line rounded-xs select-none pointer-events-none">
          <Upload className="w-10 h-10 text-uupm-ink mb-2" />
          <span className="text-sm font-bold text-uupm-ink">Thả tệp để đính kèm</span>
        </div>
      )}

      {/* Header cuộc trò chuyện với dàn nút tác vụ Discord */}
      <ChatHeader
        conversation={conversation}
        currentUserId={currentUserId}
        isOnline={isPartnerOnline}
        typingUsers={typingUsers}
        isProfileOpen={isProfileOpen}
        onToggleProfile={onToggleProfile}
        onBack={onBack}
      />

      {/* Danh sách tin nhắn dạng Stream kiểu Discord */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadOlder={onLoadOlder}
      />

      {/* Đối tác đã bị chặn: hiển thị thông báo và khóa ô nhập tin nhắn
          (giữ nguyên hội thoại theo đúng phạm vi được duyệt, không tự đóng) */}
      {partnerIsBlocked ? (
        <div className="h-[84px] px-4 border-t-2 border-uupm-line bg-uupm-page flex items-center gap-2 text-xs font-bold text-uupm-ink-muted shrink-0">
          <ShieldAlert className="w-4 h-4 shrink-0 text-uupm-danger-text" />
          <span>Bạn đã chặn người dùng này. Bỏ chặn để tiếp tục trò chuyện.</span>
        </div>
      ) : (
        /* Khung nhập tin nhắn nổi với nút '+' và emoji — media truyền từ ChatLayout
           key={conversation.id}: remount khi đổi cuộc hội thoại để bỏ state cục bộ
           (content/emoji/sticker/mediaclear) tự nhiên thay vì reset tay trong effect
           (giải quyết no-reset-all-state-on-prop-change / no-adjust-state-on-prop-change). */
        <MessageInput
          key={conversation.id}
          partnerName={partnerDisplayName}
          onSendMessage={onSendMessage}
          onTyping={onTyping}
          media={media}
        />
      )}
    </div>
  );
};
