import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../../stores/auth.store";
import { useChatStore } from "../stores/chat.store";
import { useChatSocket } from "../hooks/useChatSocket";
import { useMediaUpload } from "../hooks/useMediaUpload";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatConversationPane } from "./ChatConversationPane";
import { UserProfilePanel } from "./UserProfilePanel";
import { WelcomeScreen } from "./WelcomeScreen";
import { Message } from "../../../types/chat.types";
import { NewConversationModal } from "./NewConversationModal";
import { FriendsView } from "../../friends/components/FriendsView";
import { useFriendStore } from "../../friends/stores/friend.store";
import { FullUserProfileModal } from "../../users/components/FullUserProfileModal";
import { userService } from "../../users/services/user.service";
import { User } from "../../../types/auth.types";
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
            // Xoá queue media khi chuyển cuộc trò chuyện (owner ở ChatLayout, không phải MessageInput).
            media.clear();
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
          <ChatConversationPane
            conversation={activeConversation}
            currentUserId={user?.id}
            isPartnerOnline={isPartnerOnline}
            partnerDisplayName={partnerDisplayName}
            typingUsers={activeTypingList}
            messages={activeMessages}
            hasMore={activePagination?.hasMore}
            isLoadingMore={activePagination?.isLoading}
            partnerIsBlocked={partnerIsBlocked}
            isProfileOpen={isProfileOpen}
            onToggleProfile={() => setIsProfileOpen((prev) => !prev)}
            onBack={() => selectConversation(null)}
            onLoadOlder={handleLoadOlder}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            media={media}
          />
        ) : activeView === "friends" ? (
          /* Màn hình trung tâm Bạn bè kiểu Discord */
          <FriendsView
            onStartChat={handleStartChat}
            onOpenProfile={handleOpenProfile}
            onBack={() => setIsMobileFriendsActive(false)}
          />
        ) : (
          /* Màn hình chào mừng khi chưa chọn cuộc trò chuyện nào (tách riêng thành WelcomeScreen) */
          <WelcomeScreen onStartNewChat={() => setIsModalOpen(true)} />
        )}
      </div>

      {/* 3. CỘT 3: Bảng Hồ Sơ Người Dùng (UserProfilePanel ~300px-320px - Toggleable) */}
      {activeConversation && isProfileOpen && partner && (
        <div className="hidden lg:flex shrink-0 h-full">
          <UserProfilePanel
            key={partner.id}
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
