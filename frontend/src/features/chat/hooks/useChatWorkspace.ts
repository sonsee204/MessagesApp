import { useEffect, useState } from "react";
import { User } from "../../../types/auth.types";
import { Conversation, Message } from "../../../types/chat.types";
import { BlockedUserItem } from "../../friends/types/friend.types";
import { useAuthStore } from "../../../stores/auth.store";
import { useChatStore } from "../stores/chat.store";
import { useFriendStore } from "../../friends/stores/friend.store";
import { userService } from "../../users/services/user.service";
import { toast } from "../../../stores/toast.store";

/**
 * Trích khóa người dùng bị chặn từ bản ghi block (populate object hoặc id thuần).
 * Pure helper tách ngoài hook để giảm nhánh điều khiển trong useChatWorkspace
 * (rule no-high-complexity-react-function).
 */
function getBlockedId(b: BlockedUserItem): string | undefined {
  if (typeof b.blockedId === "object" && b.blockedId !== null) {
    return b.blockedId._id || b.blockedId.id;
  }
  return b.blockedId;
}

/** Đối tác 1-1 của hội thoại đang chọn (GROUP trả về null). */
function findPartner(conversation: Conversation | undefined, currentUserId?: string) {
  if (!conversation || conversation.type === "GROUP") return null;
  return (
    conversation.participants.find((p) => p.id !== currentUserId) ||
    conversation.participants[0] ||
    null
  );
}

/** Tên hiển thị ưu tiên của đối tác, fallback về tiêu đề hội thoại. */
function resolvePartnerDisplayName(
  partner: ReturnType<typeof findPartner>,
  conversation: Conversation | undefined
): string {
  return partner?.displayName || partner?.username || conversation?.title || "cuộc trò chuyện";
}

/**
 * Hook headless điều phối toàn bộ Workspace Chat (ChatLayout):
 * - State điều hướng: activeView, mobile friends overlay, profile panel, các modal
 * - Derived state: hội thoại đang chọn, tin nhắn, phân trang, typing, đối tác, trạng thái chặn
 * - Handlers: gửi tin, typing, tải tin cũ, bắt đầu chat, mở hồ sơ
 * Tách khỏi ChatLayout để component cha chỉ còn JSX (rule no-high-complexity-react-function).
 * @param emitTyping  hàm Socket.IO phát tín hiệu soạn tin (truyền từ useChatSocket ở ChatLayout)
 */
export function useChatWorkspace(
  emitTyping: (conversationId: string, isTyping: boolean) => void
) {
  const user = useAuthStore((state) => state.user);
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

  // Danh sách người dùng do CHÍNH mình chặn — phát hiện đối tác đã bị chặn.
  const blockedUsers = useFriendStore((state) => state.blockedUsers);
  const fetchBlockedUsers = useFriendStore((state) => state.fetchBlockedUsers);

  // State điều hướng giao diện
  const [activeView, setActiveView] = useState<"friends" | "chat">("friends");
  const [isMobileFriendsActive, setIsMobileFriendsActive] = useState<boolean>(false);
  const [profileModalUser, setProfileModalUser] = useState<User | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(true);

  // Tải danh sách hội thoại + danh sách đã chặn khi mount
  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    void fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  // ===== Derived state của hội thoại đang chọn (dùng pure helpers phía trên) =====
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeMessages = activeConversationId ? messages[activeConversationId] || [] : [];
  const activePagination = activeConversationId ? pagination[activeConversationId] : undefined;
  const activeTypingList = activeConversationId
    ? typingUsers[activeConversationId] || []
    : [];

  const partner = findPartner(activeConversation, user?.id);
  const isPartnerOnline = Boolean(partner && onlineUsers[partner.id]);
  const partnerDisplayName = resolvePartnerDisplayName(partner, activeConversation);

  // Đối tác bị MÌNH chặn — khóa ô nhập tin + hiển thị cảnh báo
  const partnerIsBlocked = Boolean(
    partner && blockedUsers.some((b) => getBlockedId(b) === partner.id)
  );

  const isMobileShowingContent =
    Boolean(activeConversationId) ||
    (activeView === "friends" && isMobileFriendsActive);

  // ===== Handlers =====

  // Gửi tin nhắn (TEXT hoặc sticker IMAGE)
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

  // Phát tín hiệu đang soạn tin
  const handleTyping = (isTyping: boolean) => {
    if (!activeConversationId) return;
    emitTyping(activeConversationId, isTyping);
  };

  // Tải thêm tin nhắn cũ
  const handleLoadOlder = () => {
    if (!activeConversationId) return;
    fetchMessages(activeConversationId, true);
  };

  /** Bắt đầu hoặc mở lại cuộc trò chuyện 1-1 với người dùng */
  const handleStartChat = async (targetUserId: string) => {
    // Callback toggle mobile view (tránh lặp 3 dòng setState trong 2 nhánh)
    const focusChatView = () => {
      setActiveView("chat");
      setIsMobileFriendsActive(false);
    };

    const existingConv = conversations.find(
      (c) =>
        c.type === "DIRECT" &&
        c.participants.some((p) => p.id === targetUserId)
    );

    if (existingConv) {
      await selectConversation(existingConv.id);
      focusChatView();
      return;
    }

    try {
      const newConv = await createConversation({
        type: "DIRECT",
        participantIds: [targetUserId],
      });
      if (newConv) {
        await selectConversation(newConv.id);
        focusChatView();
      }
    } catch {
      toast.error("Không thể khởi tạo cuộc trò chuyện với người dùng này.", "Lỗi kết nối");
    }
  };

  /** Mở modal hồ sơ đầy đủ (tìm participant trong bộ nhớ, nạp mới từ API) */
  const handleOpenProfile = async (targetUserId: string) => {
    const convPartner = conversations
      .flatMap((c) => c.participants)
      .find((p) => p.id === targetUserId);

    const showProfile = (u: User) => {
      setProfileModalUser(u);
      setIsProfileModalOpen(true);
    };

    if (convPartner) showProfile(convPartner as User);

    try {
      const freshUser = await userService.getUserById(targetUserId);
      if (freshUser) showProfile(freshUser);
    } catch {
      if (!convPartner) {
        toast.error("Không thể tải thông tin hồ sơ người dùng này.", "Lỗi");
      }
    }
  };

  // Chọn hội thoại từ Sidebar (đóng mobile overlay)
  const handleSelectConversation = (id: string) => {
    setActiveView("chat");
    setIsMobileFriendsActive(false);
    void selectConversation(id);
  };

  // Mở Bạn bè từ Sidebar (Discord-style)
  const handleSelectFriendsView = () => {
    setActiveView("friends");
    setIsMobileFriendsActive(true);
    void selectConversation(null);
  };

  return {
    // Auth
    user,
    // Store data
    conversations,
    activeConversationId,
    isLoadingConversations,
    onlineUsers,
    // Derived
    activeConversation,
    activeMessages,
    activePagination,
    activeTypingList,
    partner,
    isPartnerOnline,
    partnerDisplayName,
    partnerIsBlocked,
    isMobileShowingContent,
    // UI state
    activeView,
    isModalOpen,
    isProfileOpen,
    isProfileModalOpen,
    profileModalUser,
    setIsModalOpen,
    setIsProfileOpen,
    setIsProfileModalOpen,
    // Handlers
    handleSendMessage,
    handleTyping,
    handleLoadOlder,
    handleStartChat,
    handleOpenProfile,
    handleSelectConversation,
    handleSelectFriendsView,
    handleCloseConversation: () => void selectConversation(null),
  };
}
