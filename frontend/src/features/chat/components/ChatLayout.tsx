import React, { useEffect, useState } from "react";
import { MessageSquare, ShieldCheck, Sparkles, ShieldAlert, Upload } from "lucide-react";
import { useAuthStore } from "../../../stores/auth.store";
import { useChatStore } from "../stores/chat.store";
import { useChatSocket } from "../hooks/useChatSocket";
import { useMediaUpload } from "../hooks/useMediaUpload";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { UserProfilePanel } from "./UserProfilePanel";
import { Message } from "../../../types/chat.types";
import { NewConversationModal } from "./NewConversationModal";
import { FriendsView } from "../../friends/components/FriendsView";
import { useFriendStore } from "../../friends/stores/friend.store";
import { FullUserProfileModal } from "../../users/components/FullUserProfileModal";
import { userService } from "../../users/services/user.service";
import { User } from "../../../types/auth.types";
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
    createConversation,
  } = useChatStore();

  // Danh sách người dùng do CHÍNH mình chặn (có hướng) và hành động tải lại danh sách này.
  // Dùng để phát hiện đối tác trong cuộc hội thoại đang mở đã bị mình chặn.
  const blockedUsers = useFriendStore((state) => state.blockedUsers);
  const fetchBlockedUsers = useFriendStore((state) => state.fetchBlockedUsers);

  // Khởi tạo và kết nối Socket.IO
  const { emitTyping } = useChatSocket();

  // Hàng đợi upload media dùng chung cho khung nhập + vùng kéo-thả (lift state).
  // Owner ở ChatLayout để MessageInput chỉ render; conversationId rỗng → hook không ký được.
  const media = useMediaUpload(activeConversationId ?? "");

  // Cờ hiển thị overlay khi người dùng kéo tệp vào vùng chat.
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Trạng thái hiển thị giao diện: "friends" (mặc định như Discord) hoặc "chat"
  const [activeView, setActiveView] = useState<"friends" | "chat">("friends");
  // Trạng thái mở giao diện bạn bè trên mobile
  const [isMobileFriendsActive, setIsMobileFriendsActive] = useState<boolean>(false);

  // Trạng thái mở modal xem hồ sơ người dùng đầy đủ
  const [profileModalUser, setProfileModalUser] = useState<User | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Trạng thái mở modal tạo cuộc trò chuyện mới
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Trạng thái mở/đóng Panel Hồ sơ người dùng Cột 3 (mặc định mở trên desktop)
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(true);

  // 1. Tải danh sách cuộc trò chuyện ban đầu khi mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Tải danh sách người dùng đã chặn để nhận biết hội thoại có đối tác bị chặn.
  // Lưu ý: blockUser() phía Friend Store đã tự tải lại danh sách này rồi.
  useEffect(() => {
    void fetchBlockedUsers();
  }, [fetchBlockedUsers]);

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

  // Trạng thái chặn của đối tác trong cuộc hội thoại đang mở (theo chiều MÌNH chặn họ).
  // Dùng để khóa ô nhập tin và hiển thị thông báo thay vì để lại một hội thoại "ma".
  const partnerIsBlocked = Boolean(
    partner &&
      blockedUsers.some((b) => {
        const blockedId =
          typeof b.blockedId === "object" && b.blockedId !== null
            ? b.blockedId._id || b.blockedId.id
            : b.blockedId;
        return blockedId === partner.id;
      })
  );

  // Xử lý gửi tin nhắn (văn bản TEXT hoặc sticker IMAGE kèm tệp đính kèm từ kho Klipy)
  const handleSendMessage = async (
    content: string,
    type: Message["type"] = "TEXT",
    attachments?: Message["attachments"]
  ) => {
    if (!activeConversationId) return;
    const result = await sendMessage(activeConversationId, content, type, attachments);
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

  /**
   * Bắt đầu cuộc trò chuyện trực tiếp với một người bạn từ FriendsView
   */
  const handleStartChat = async (targetUserId: string) => {
    // 1. Kiểm tra xem đã có cuộc trò chuyện 1-1 với người này chưa
    const existingConv = conversations.find(
      (c) =>
        c.type === "DIRECT" &&
        c.participants.some((p) => p.id === targetUserId)
    );

    if (existingConv) {
      await selectConversation(existingConv.id);
      setActiveView("chat");
      setIsMobileFriendsActive(false);
      return;
    }

    // 2. Nếu chưa có, tạo cuộc trò chuyện trực tiếp mới
    try {
      const newConv = await createConversation({
        type: "DIRECT",
        participantIds: [targetUserId],
      });
      if (newConv) {
        await selectConversation(newConv.id);
        setActiveView("chat");
        setIsMobileFriendsActive(false);
      }
    } catch {
      toast.error("Không thể khởi tạo cuộc trò chuyện với người dùng này.", "Lỗi kết nối");
    }
  };

  /**
   * Mở modal xem hồ sơ người dùng từ FriendsView hoặc các sự kiện bạn bè
   */
  const handleOpenProfile = async (targetUserId: string) => {
    // Tìm trước trong danh sách người tham gia các cuộc hội thoại
    const convPartner = conversations
      .flatMap((c) => c.participants)
      .find((p) => p.id === targetUserId);

    if (convPartner) {
      setProfileModalUser(convPartner as User);
      setIsProfileModalOpen(true);
    }

    // Tải thông tin mới nhất từ API để lấy đủ banner, bio
    try {
      const freshUser = await userService.getUserById(targetUserId);
      if (freshUser) {
        setProfileModalUser(freshUser);
        setIsProfileModalOpen(true);
      }
    } catch {
      if (!convPartner) {
        toast.error("Không thể tải thông tin hồ sơ người dùng này.", "Lỗi");
      }
    }
  };

  // Xác định trên màn hình di động xem có đang hiển thị nội dung (chat hoặc bạn bè) không
  const isMobileShowingContent =
    Boolean(activeConversationId) || (activeView === "friends" && isMobileFriendsActive);

  return (
    <div className="w-full h-full flex-1 flex overflow-hidden bg-uupm-surface">
      {/* 1. CỘT 1: ConversationSidebar & User Control Deck (~280px-320px) */}
      <div
        className={`w-full md:w-72 lg:w-80 shrink-0 h-full ${
          isMobileShowingContent ? "hidden md:flex" : "flex"
        }`}
      >
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onlineUsers={onlineUsers}
          currentUser={user}
          isLoading={isLoadingConversations}
          activeView={activeView}
          onSelectConversation={(id) => {
            setActiveView("chat");
            setIsMobileFriendsActive(false);
            void selectConversation(id);
          }}
          onSelectFriendsView={() => {
            setActiveView("friends");
            setIsMobileFriendsActive(true);
            void selectConversation(null);
          }}
          onOpenNewChatModal={() => setIsModalOpen(true)}
          onLogout={onLogout}
        />
      </div>

      {/* 2. CỘT 2: Khung Nội Dung Chính (Flex-1) */}
      <div
        className={`flex-1 flex flex-col h-full bg-uupm-surface min-w-0 ${
          !isMobileShowingContent ? "hidden md:flex" : "flex"
        }`}
      >
        {activeConversation ? (
          /* Vùng kéo-thả file bao quanh toàn bộ khung chat khi có cuộc trò chuyện.
             Drag-over hiển thị overlay chấm nét đứt; drop chuyển file vào media.pickFiles.
             position:relative để overlay phủ đúng khung, absolute inset-0 chỉ bao đúng box. */
          <div
            className="relative flex flex-col flex-1 min-h-0"
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
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

            {/* Đối tác đã bị chặn: hiển thị thông báo và khóa ô nhập tin nhắn
                (giữ nguyên hội thoại theo đúng phạm vi được duyệt, không tự đóng) */}
            {partnerIsBlocked ? (
              <div className="h-[84px] px-4 border-t-2 border-uupm-line bg-uupm-page flex items-center gap-2 text-xs font-bold text-uupm-ink-muted shrink-0">
                <ShieldAlert className="w-4 h-4 shrink-0 text-uupm-danger-text" />
                <span>Bạn đã chặn người dùng này. Bỏ chặn để tiếp tục trò chuyện.</span>
              </div>
            ) : (
              /* Khung nhập tin nhắn nổi với nút '+' và emoji — media truyền từ ChatLayout */
              <MessageInput
                conversationId={activeConversation.id}
                partnerName={partnerDisplayName}
                onSendMessage={handleSendMessage}
                onTyping={handleTyping}
                media={media}
              />
            )}
          </div>
        ) : activeView === "friends" ? (
          /* Màn hình trung tâm Bạn bè kiểu Discord */
          <FriendsView
            onStartChat={handleStartChat}
            onOpenProfile={handleOpenProfile}
            onBack={() => setIsMobileFriendsActive(false)}
          />
        ) : (
          /* Màn hình chào mừng khi chưa chọn cuộc trò chuyện nào */
          <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-uupm-page select-none">
            <div className="w-16 h-16 rounded-xs bg-uupm-accent border-2 border-uupm-line shadow-uupm-2 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-uupm-ink" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line shadow-uupm-active text-xs font-black uppercase text-uupm-accent-text mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Discord-Style Workspace</span>
            </div>

            <h2 className="text-xl md:text-2xl font-black text-uupm-ink tracking-tight">
              Chào mừng bạn đến với AppMessaging!
            </h2>
            <p className="text-xs md:text-sm font-semibold text-uupm-ink-muted mt-2 max-w-sm">
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

            <div className="mt-8 flex items-center gap-2 text-uupm-ink-muted text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-uupm-accent" />
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

      {/* Modal hiển thị hồ sơ người dùng đầy đủ */}
      <FullUserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={profileModalUser}
        isOnline={profileModalUser ? Boolean(onlineUsers[profileModalUser.id]) : false}
      />
    </div>
  );
};
