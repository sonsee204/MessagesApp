import React from "react";
import { useChatSocket } from "../hooks/useChatSocket";
import { useMediaUpload } from "../hooks/useMediaUpload";
import { useChatWorkspace } from "../hooks/useChatWorkspace";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatConversationPane } from "./ChatConversationPane";
import { UserProfilePanel } from "./UserProfilePanel";
import { WelcomeScreen } from "./WelcomeScreen";
import { NewConversationModal } from "./NewConversationModal";
import { FriendsView } from "../../friends/components/FriendsView";
import { FullUserProfileModal } from "../../users/components/FullUserProfileModal";
import { CallHistoryList } from "../../call/components/organisms/CallHistoryList";
import { useCallContext } from "../../call/hooks/CallProvider";
import type { CallType } from "../../call/types/call.types";

interface ChatLayoutProps {
  onLogout?: () => void;
}

/**
 * Bố cục Không gian làm việc Tin nhắn 3 Cột Tinh Giản phong cách Discord (ChatLayout)
 * Toàn bộ state điều hướng, derived data và handlers đã tách sang hook headless
 * useChatWorkspace — component này chỉ còn ghép JSX (Headless Pattern, frontend.md).
 * - Cột 1: ConversationSidebar (tìm kiếm, quick links, danh sách DM, User Control Deck)
 * - Cột 2: ChatConversationPane / FriendsView / WelcomeScreen
 * - Cột 3: UserProfilePanel (toggle được)
 */
export const ChatLayout: React.FC<ChatLayoutProps> = ({ onLogout }) => {
  // Kết nối Socket.IO thời gian thực
  const { emitTyping } = useChatSocket();

  // Controller headless của workspace chat
  const ws = useChatWorkspace(emitTyping);

  // Hook cuộc gọi toàn cục (CallProvider context)
  const { initiateCall } = useCallContext();

  // Callback bắt đầu cuộc gọi lại từ lịch sử cuộc gọi
  const handleCallFromHistory = (peerId: string, type: CallType) => {
    void initiateCall(peerId, type);
  };

  // Hàng đợi upload media dùng chung cho khung nhập + vùng kéo-thả (lift state).
  // Owner ở ChatLayout để MessageInput chỉ render; conversationId rỗng → hook không ký được.
  const media = useMediaUpload(ws.activeConversationId ?? "");

  return (
    <div className="w-full h-full flex-1 flex overflow-hidden bg-uupm-surface">
      {/* 1. CỘT 1: ConversationSidebar & User Control Deck (~280px-320px) */}
      <div
        className={`w-full md:w-72 lg:w-80 shrink-0 h-full ${
          ws.isMobileShowingContent ? "hidden md:flex" : "flex"
        }`}
      >
        <ConversationSidebar
          conversations={ws.conversations}
          activeConversationId={ws.activeConversationId}
          onlineUsers={ws.onlineUsers}
          currentUser={ws.user}
          isLoading={ws.isLoadingConversations}
          activeView={ws.activeView}
          onSelectConversation={(id) => {
            // Xoá queue media khi chuyển cuộc trò chuyện (owner ở ChatLayout).
            media.clear();
            ws.handleSelectConversation(id);
          }}
          onSelectFriendsView={ws.handleSelectFriendsView}
          onSelectCallsView={ws.handleSelectCallsView}
          onOpenNewChatModal={() => ws.setIsModalOpen(true)}
          onLogout={onLogout}
        />
      </div>

      {/* 2. CỘT 2: Khung Nội Dung Chính (Flex-1) */}
      <div
        className={`flex-1 flex flex-col h-full bg-uupm-surface min-w-0 ${
          !ws.isMobileShowingContent ? "hidden md:flex" : "flex"
        }`}
      >
        {ws.activeConversation ? (
          <ChatConversationPane
            conversation={ws.activeConversation}
            currentUserId={ws.user?.id}
            isPartnerOnline={ws.isPartnerOnline}
            partnerDisplayName={ws.partnerDisplayName}
            typingUsers={ws.activeTypingList}
            messages={ws.activeMessages}
            hasMore={ws.activePagination?.hasMore}
            isLoadingMore={ws.activePagination?.isLoading}
            partnerIsBlocked={ws.partnerIsBlocked}
            isProfileOpen={ws.isProfileOpen}
            onToggleProfile={() => ws.setIsProfileOpen((prev: boolean) => !prev)}
            onBack={ws.handleCloseConversation}
            onLoadOlder={ws.handleLoadOlder}
            onSendMessage={ws.handleSendMessage}
            onTyping={ws.handleTyping}
            media={media}
          />
        ) : ws.activeView === "friends" ? (
          /* Màn hình trung tâm Bạn bè kiểu Discord */
          <FriendsView
            onStartChat={ws.handleStartChat}
            onOpenProfile={ws.handleOpenProfile}
            onBack={() => ws.handleSelectConversation("")}
          />
        ) : ws.activeView === "calls" ? (
          /* Màn hình trung tâm Lịch sử Cuộc gọi */
          <div className="flex flex-col h-full min-w-0">
            <div className="h-14 px-4 border-b-2 border-uupm-line flex items-center shrink-0">
              <h2 className="text-sm font-black uppercase tracking-wider text-uupm-ink">
                Lịch sử cuộc gọi
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CallHistoryList onCallPeer={handleCallFromHistory} />
            </div>
          </div>
        ) : (
          /* Màn hình chào mừng khi chưa chọn cuộc trò chuyện nào */
          <WelcomeScreen onStartNewChat={() => ws.setIsModalOpen(true)} />
        )}
      </div>

      {/* 3. CỘT 3: Bảng Hồ Sơ Người Dùng (UserProfilePanel - Toggleable) */}
      {ws.activeConversation && ws.isProfileOpen && ws.partner && (
        <div className="hidden lg:flex shrink-0 h-full">
          <UserProfilePanel
            key={ws.partner.id}
            user={ws.partner}
            isOnline={ws.isPartnerOnline}
            onClose={() => ws.setIsProfileOpen(false)}
          />
        </div>
      )}

      {/* Hộp thoại tạo cuộc trò chuyện mới */}
      <NewConversationModal
        isOpen={ws.isModalOpen}
        onClose={() => ws.setIsModalOpen(false)}
        currentUserId={ws.user?.id}
      />

      {/* Modal hiển thị hồ sơ người dùng đầy đủ */}
      <FullUserProfileModal
        isOpen={ws.isProfileModalOpen}
        onClose={() => ws.setIsProfileModalOpen(false)}
        user={ws.profileModalUser}
        isOnline={ws.profileModalUser ? Boolean(ws.onlineUsers[ws.profileModalUser.id]) : false}
      />
    </div>
  );
};
