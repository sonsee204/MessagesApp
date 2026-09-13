import React, { useEffect, useState } from "react";
import { MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { useAuthStore } from "../../../stores/auth.store";
import { useChatStore } from "../stores/chat.store";
import { useChatSocket } from "../hooks/useChatSocket";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { UserProfilePanel } from "./UserProfilePanel";
import { NewConversationModal } from "./NewConversationModal";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../stores/toast.store";

interface ChatLayoutProps {
  onLogout?: () => void;
}

/**
 * Bố cục Không gian làm việc Tin nhắn 3 Cột Tinh Giản phong cách Discord (ChatLayout)
 * Thiết kế Tactile Neo-Brutalist chuẩn UI/UX Pro Max:
 * - Cột 1 (Sidebar ~280px-320px): Tìm kiếm, liên kết bạn bè, danh sách DM và User Control Deck
 * - Cột 2 (Khung Chat Chính Flex-1): Header tác vụ Discord, Message Stream, và Floating Input
 * - Cột 3 (UserProfilePanel ~300px-320px): Banner, avatar 80px, huy hiệu, bạn chung, bio (Toggleable)
 * - Tự động kết nối Socket.IO thời gian thực và đồng bộ dữ liệu
 */
export const ChatLayout: React.FC<ChatLayoutProps> = ({ onLogout }) => {
  const { user } = useAuthStore();
  const {
    conversations,
    activeConversationId,
    isLoadingConversations,
    messages,
    pagination,
    typingUsers,
    onlineUsers,
    fetchConversations,
    selectConversation,
    fetchMessages,
    sendMessage,
  } = useChatStore();

  // Khởi tạo và kết nối Socket.IO
  const { emitTyping } = useChatSocket();

  // Trạng thái mở modal tạo cuộc trò chuyện mới
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Trạng thái mở/đóng Panel Hồ sơ người dùng Cột 3 (mặc định mở trên desktop)
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(true);

  // 1. Tải danh sách cuộc trò chuyện ban đầu khi mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Lấy dữ liệu cuộc trò chuyện hiện tại đang được chọn
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeMessages = activeConversationId ? messages[activeConversationId] || [] : [];
  const activePagination = activeConversationId
    ? pagination[activeConversationId]
    : undefined;
  const activeTypingList = activeConversationId
    ? typingUsers[activeConversationId] || []
    : [];

  // Tìm đối tác để kiểm tra trạng thái online và hiển thị hồ sơ
  const partner =
    activeConversation && activeConversation.type !== "GROUP"
      ? activeConversation.participants.find((p) => p.id !== user?.id) ||
        activeConversation.participants[0] ||
        null
      : null;
  const isPartnerOnline = Boolean(partner && onlineUsers[partner.id]);
  const partnerDisplayName = partner?.displayName || partner?.username || activeConversation?.title || "cuộc trò chuyện";

  // Xử lý gửi tin nhắn
  const handleSendMessage = async (content: string) => {
    if (!activeConversationId) return;
    const result = await sendMessage(activeConversationId, content, "TEXT");
    if (!result) {
      toast.error("Không thể gửi tin nhắn. Vui lòng kiểm tra lại kết nối mạng.", "Lỗi gửi tin");
    }
  };

  // Xử lý phát tín hiệu đang soạn tin
  const handleTyping = (isTyping: boolean) => {
    if (!activeConversationId) return;
    emitTyping(activeConversationId, isTyping);
  };

  // Xử lý tải thêm tin nhắn cũ
  const handleLoadOlder = () => {
    if (!activeConversationId) return;
    fetchMessages(activeConversationId, true);
  };

  return (
    <div className="w-full h-full flex-1 flex overflow-hidden bg-white">
      {/* 1. CỘT 1: ConversationSidebar & User Control Deck (~280px-320px) */}
      <div
        className={`w-full md:w-72 lg:w-80 shrink-0 h-full ${
          activeConversationId ? "hidden md:flex" : "flex"
        }`}
      >
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onlineUsers={onlineUsers}
          currentUser={user}
          isLoading={isLoadingConversations}
          onSelectConversation={(id) => selectConversation(id)}
          onOpenNewChatModal={() => setIsModalOpen(true)}
          onLogout={onLogout}
        />
      </div>

      {/* 2. CỘT 2: Khung Hội Thoại Chính (Flex-1) */}
      <div
        className={`flex-1 flex flex-col h-full bg-white min-w-0 ${
          !activeConversationId ? "hidden md:flex" : "flex"
        }`}
      >
        {activeConversation ? (
          <>
            {/* Header cuộc trò chuyện với dàn nút tác vụ Discord */}
            <ChatHeader
              conversation={activeConversation}
              currentUserId={user?.id}
              isOnline={isPartnerOnline}
              typingUsers={activeTypingList}
              isProfileOpen={isProfileOpen}
              onToggleProfile={() => setIsProfileOpen((prev) => !prev)}
              onBack={() => selectConversation(null)}
            />

            {/* Danh sách tin nhắn dạng Stream kiểu Discord */}
            <MessageList
              messages={activeMessages}
              currentUserId={user?.id}
              hasMore={activePagination?.hasMore}
              isLoadingMore={activePagination?.isLoading}
              onLoadOlder={handleLoadOlder}
            />

            {/* Khung nhập tin nhắn nổi với nút '+' và emoji */}
            <MessageInput
              conversationId={activeConversation.id}
              partnerName={partnerDisplayName}
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
            />
          </>
        ) : (
          /* Màn hình chào mừng khi chưa chọn cuộc trò chuyện nào */
          <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-[#f8fafc] select-none">
            <div className="w-16 h-16 rounded-xs bg-[#22c55e] border-2 border-[#2d3748] shadow-uupm-2 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-[#0f172a]" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xs bg-[#add8e6] border-2 border-[#2d3748] shadow-uupm-active text-xs font-black uppercase text-[#0f172a] mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Discord-Style Workspace</span>
            </div>

            <h2 className="text-xl md:text-2xl font-black text-[#0f172a] tracking-tight">
              Chào mừng bạn đến với AppMessaging!
            </h2>
            <p className="text-xs md:text-sm font-semibold text-slate-500 mt-2 max-w-sm">
              Chọn một người bạn từ danh sách bên trái hoặc nhấn nút bên dưới để bắt đầu gửi tin nhắn bảo mật thời gian thực.
            </p>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setIsModalOpen(true)}
              className="mt-6"
            >
              Bắt Đầu Cuộc Trò Chuyện Mới
            </Button>

            <div className="mt-8 flex items-center gap-2 text-slate-400 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
              <span>Bảo mật kết nối Socket.IO & Access Token trong RAM</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. CỘT 3: Bảng Hồ Sơ Người Dùng (UserProfilePanel ~300px-320px - Toggleable) */}
      {activeConversation && isProfileOpen && partner && (
        <div className="hidden lg:flex shrink-0 h-full">
          <UserProfilePanel
            user={partner}
            isOnline={isPartnerOnline}
            onClose={() => setIsProfileOpen(false)}
          />
        </div>
      )}

      {/* Hộp thoại tạo cuộc trò chuyện mới */}
      <NewConversationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentUserId={user?.id}
      />
    </div>
  );
};
