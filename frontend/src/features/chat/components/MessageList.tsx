import React, { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { Message } from "../../../types/chat.types";
import { DiscordMessageItem } from "./DiscordMessageItem";
import { Button } from "../../../components/ui/Button";

interface MessageListProps {
  messages: Message[];
  currentUserId?: string;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadOlder?: () => void;
}

/**
 * Danh sách hiển thị dòng thời gian tin nhắn kiểu Discord (MessageList)
 * Thiết kế Tactile Neo-Brutalist chuẩn UI/UX Pro Max:
 * - Bố cục Stream Layout: Toàn bộ tin nhắn trải dài theo thứ tự thời gian
 * - Tự động gom nhóm tin liên tiếp (Compact Grouping) trong vòng 5 phút cùng người gửi
 * - Dải phân cách ngày ở trung tâm với 2 đường kẻ ngang viền 2px #2d3748
 * - Tự động cuộn xuống đáy khi có tin mới & giữ nguyên vị trí khi tải tin cũ
 */
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  hasMore = false,
  isLoadingMore = false,
  onLoadOlder,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  // 1. Tự động cuộn xuống đáy khi nhận tin nhắn mới
  useEffect(() => {
    if (isInitialLoadRef.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      isInitialLoadRef.current = false;
      return;
    }

    // Nếu người dùng đang ở gần đáy (trong khoảng 150px), tự động cuộn xuống khi có tin mới
    const container = containerRef.current;
    if (container) {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  // 2. Bảo tồn vị trí cuộn khi tải thêm tin nhắn cũ ở đỉnh danh sách
  const handleLoadOlder = () => {
    if (containerRef.current) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
    }
    onLoadOlder?.();
  };

  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && containerRef.current) {
      const heightDifference = containerRef.current.scrollHeight - prevScrollHeightRef.current;
      containerRef.current.scrollTop += heightDifference;
      prevScrollHeightRef.current = 0;
    }
  }, [messages.length]);

  // Hàm định dạng ngày phân cách phong cách Discord (vd: 23 Tháng Sáu 2026)
  const formatDateDivider = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) return "Hôm nay";

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return "Hôm qua";

    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-2 md:px-4 py-4 bg-white select-text"
    >
      {/* Container cân đối trọng tâm hiển thị khi ẩn/hiện Cột 3 */}
      <div className="w-full max-w-5xl xl:max-w-6xl mx-auto flex flex-col justify-end min-h-full space-y-0.5">
        {/* Nút tải thêm tin nhắn cũ ở đỉnh danh sách */}
        {hasMore && (
          <div className="flex justify-center py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={isLoadingMore}
              onClick={handleLoadOlder}
              className="text-xs py-1.5 px-4"
            >
              {isLoadingMore ? "Đang tải..." : "Tải thêm tin nhắn cũ"}
            </Button>
          </div>
        )}

        {/* Màn hình hiển thị khi chưa có tin nhắn nào trong hội thoại */}
        {messages.length === 0 && !isLoadingMore && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none my-auto">
            <div className="w-14 h-14 rounded-xs bg-[#add8e6] border-2 border-[#2d3748] shadow-uupm-2 flex items-center justify-center mb-4">
              <MessageSquare className="w-7 h-7 text-[#0f172a]" />
            </div>
            <h3 className="text-base font-black text-[#0f172a]">Chưa có tin nhắn nào</h3>
            <p className="text-xs font-semibold text-slate-500 mt-1 max-w-xs">
              Hãy bắt đầu cuộc trò chuyện bằng cách gửi một lời chào thân thiện bên dưới!
            </p>
          </div>
        )}

        {/* Hiển thị danh sách tin nhắn dạng Stream */}
        {messages.map((message, index) => {
          // Kiểm tra xem có cần hiển thị thanh phân cách ngày tháng không
          const currentDate = new Date(message.createdAt).toDateString();
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const prevDate = prevMessage ? new Date(prevMessage.createdAt).toDateString() : null;
          const showDateDivider = currentDate !== prevDate;

          // Kiểm tra gom nhóm tin nhắn liên tiếp (Compact Grouping):
          // Cùng một người gửi, cách nhau dưới 5 phút (300,000 ms), và cùng ngày
          let isCompact = false;
          if (!showDateDivider && prevMessage && prevMessage.senderId === message.senderId) {
            const timeDiff =
              new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime();
            if (timeDiff < 5 * 60 * 1000) {
              isCompact = true;
            }
          }

          // Kiểm tra xem có phải tin sự kiện cuộc gọi không
          const isCallLog =
            message.type === "SYSTEM" ||
            message.content.includes("bắt đầu cuộc gọi") ||
            message.content.includes("cuộc gọi thoại");

          return (
            <React.Fragment key={message.id}>
              {/* Dải phân cách ngày tháng trung tâm kiểu Discord kèm đường kẻ ngang */}
              {showDateDivider && (
                <div className="relative flex items-center justify-center my-6 select-none">
                  {/* Đường kẻ ngang 2px viền #2d3748 */}
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-[#2d3748]/20" />
                  </div>
                  {/* Viên thuốc ngày tháng nổi bật */}
                  <span className="relative px-3 py-1 rounded-xs bg-[#f8fafc] border-2 border-[#2d3748] shadow-uupm-active text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    {formatDateDivider(message.createdAt)}
                  </span>
                </div>
              )}

              {/* Dòng tin nhắn kiểu Discord */}
              <DiscordMessageItem
                message={message}
                currentUserId={currentUserId}
                isCompact={isCompact}
                isCallLog={isCallLog}
              />
            </React.Fragment>
          );
        })}

        {/* Điểm neo để tự động cuộn xuống cuối danh sách */}
        <div ref={bottomRef} className="h-2" />
      </div>
    </div>
  );
};
