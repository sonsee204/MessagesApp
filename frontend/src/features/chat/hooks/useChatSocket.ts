import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket, connectSocket, disconnectSocket } from "../../../lib/socket";
import { useAuthStore } from "../../../stores/auth.store";
import { useChatStore } from "../stores/chat.store";
import { useNotificationStore } from "../../notifications/stores/notification.store";
import { NotificationItem } from "../../notifications/types/notification.types";
import { toast } from "../../../stores/toast.store";
import {
  Message,
  TypingEventPayload,
  UserStatusEventPayload,
  MessageRecalledEventPayload,
  MessagesReadEventPayload,
  MessageType,
} from "../../../types/chat.types";

/**
 * Custom Hook đồng bộ hóa toàn diện giữa Socket.IO Client và Zustand Chat Store
 * 1. Quản lý vòng đời kết nối Socket.IO theo trạng thái đăng nhập của người dùng
 * 2. Tự động tham gia (Join) và rời khỏi (Leave) phòng chat khi chuyển đổi cuộc hội thoại
 * 3. Lắng nghe các sự kiện thời gian thực từ Server: tin nhắn mới, đang soạn tin, trạng thái online
 * 4. Cung cấp các hàm phát sự kiện từ Client: phát tín hiệu soạn tin (kèm Debounce) và gửi tin nhắn
 */
export function useChatSocket() {
  const { isAuthenticated, accessToken } = useAuthStore();
  const {
    activeConversationId,
    addIncomingMessage,
    setUserTyping,
    setUserOnlineStatus,
    applyMessageRecalled,
    applyMessagesRead,
  } = useChatStore();

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const prevConversationIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Quản lý kết nối Socket.IO dựa trên trạng thái xác thực và Access Token
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocket();
      setIsConnected(false);
      return;
    }

    // Khởi tạo và kết nối Socket.IO
    connectSocket();
    const socket = getSocket();

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = (err: Error) => {
      console.warn("Lỗi kết nối Socket.IO:", err.message);
      setIsConnected(false);
    };

    // Lắng nghe các sự kiện kết nối
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    // Cập nhật trạng thái tức thời nếu socket đã kết nối sẵn
    if (socket.connected) {
      setIsConnected(true);
    }

    // 2. Lắng nghe các sự kiện dữ liệu thời gian thực từ máy chủ
    // A. Nhận tin nhắn mới từ phòng chat
    const handleNewMessage = (message: Message) => {
      addIncomingMessage(message);

      // Nếu nhận tin nhắn từ người khác trong khi đang xem phòng chat khác, phát thông báo Popup
      const currentActiveId = useChatStore.getState().activeConversationId;
      const currentUserId = useAuthStore.getState().user?.id;
      if (message.senderId !== currentUserId && message.conversationId !== currentActiveId) {
        const senderName = message.sender?.displayName || message.sender?.username || "Thành viên";
        toast.info(`${senderName}: ${message.content}`, "Tin nhắn mới");
      }
    };

    // B. Nhận sự kiện người khác đang soạn tin hoặc dừng soạn tin
    const handleUserTyping = (data: TypingEventPayload) => {
      setUserTyping(
        data.conversationId,
        { userId: data.userId, username: data.username },
        data.isTyping
      );
    };

    // C. Nhận sự kiện thay đổi trạng thái trực tuyến của bạn bè/thành viên
    const handleUserStatusChanged = (data: UserStatusEventPayload) => {
      setUserOnlineStatus(data.userId, data.isOnline);
    };

    // D. Nhận sự kiện một tin nhắn đã bị thu hồi
    const handleMessageRecalled = (data: MessageRecalledEventPayload) => {
      applyMessageRecalled(data.conversationId, data.messageId);
    };

    // E. Nhận sự kiện một thành viên đã đọc toàn bộ tin nhắn trong cuộc trò chuyện
    const handleMessagesRead = (data: MessagesReadEventPayload) => {
      applyMessagesRead(data.conversationId, data.userId);
    };

    // F. Nhận sự kiện thông báo mới tạo ra từ máy chủ (Real-Time Notification)
    const handleNotificationNew = (notification: NotificationItem) => {
      useNotificationStore.getState().addIncomingNotification(notification);
      toast.info(notification.content, notification.title || "Thông báo mới");
    };

    // G. Nhận sự kiện thông báo đã được đọc từ thiết bị khác để đồng bộ số lượng chưa đọc
    const handleNotificationRead = (payload: { notificationId?: string; all?: boolean }) => {
      useNotificationStore.getState().applyNotificationRead(payload);
    };

    socket.on("new_message", handleNewMessage);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_status_changed", handleUserStatusChanged);
    socket.on("message_recalled", handleMessageRecalled);
    socket.on("messages_read", handleMessagesRead);
    socket.on("notification:new", handleNotificationNew);
    socket.on("notification:read", handleNotificationRead);

    // Dọn dẹp listeners khi component unmount hoặc token thay đổi
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("new_message", handleNewMessage);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_status_changed", handleUserStatusChanged);
      socket.off("message_recalled", handleMessageRecalled);
      socket.off("messages_read", handleMessagesRead);
      socket.off("notification:new", handleNotificationNew);
      socket.off("notification:read", handleNotificationRead);
    };
  }, [
    isAuthenticated,
    accessToken,
    addIncomingMessage,
    setUserTyping,
    setUserOnlineStatus,
    applyMessageRecalled,
    applyMessagesRead,
  ]);

  // 3. Quản lý việc tham gia (Join) và rời khỏi (Leave) phòng chat khi đổi activeConversationId
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    const prevId = prevConversationIdRef.current;
    const currentId = activeConversationId;

    // Rời khỏi phòng chat trước đó nếu có
    if (prevId && prevId !== currentId) {
      socket.emit("leave_conversation", { conversationId: prevId });
    }

    // Tham gia vào phòng chat mới được chọn
    if (currentId) {
      socket.emit("join_conversation", { conversationId: currentId });
    }

    // Lưu lại ID hiện tại để so sánh cho lần chuyển phòng tiếp theo
    prevConversationIdRef.current = currentId;
  }, [activeConversationId, isConnected]);

  /**
   * 4. Phát tín hiệu đang soạn tin nhắn (Typing Indicator) kèm cơ chế Debounce tự động
   * Khi người dùng gõ phím: gửi typing_start
   * Sau 2.5 giây không gõ phím: tự động gửi typing_stop
   */
  const emitTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;

      if (isTyping) {
        // Phát sự kiện bắt đầu soạn tin
        socket.emit("typing_start", { conversationId });

        // Xóa bộ đếm thời gian cũ nếu người dùng vẫn đang tiếp tục gõ phím
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Tự động phát sự kiện dừng soạn tin sau 2.5 giây không có thao tác phím mới
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit("typing_stop", { conversationId });
        }, 2500);
      } else {
        // Dừng soạn tin lập tức (khi đã nhấn gửi hoặc xóa trắng ô nhập)
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        socket.emit("typing_stop", { conversationId });
      }
    },
    []
  );

  /**
   * 5. Gửi tin nhắn thời gian thực trực tiếp qua kết nối WebSocket Socket.IO
   */
  const emitSendMessage = useCallback(
    (conversationId: string, content: string, type: MessageType = "TEXT") => {
      const socket = getSocket();
      if (!socket || !socket.connected) return false;

      socket.emit("send_message", {
        conversationId,
        content,
        type,
      });

      return true;
    },
    []
  );

  return {
    isConnected,
    emitTyping,
    emitSendMessage,
  };
}
