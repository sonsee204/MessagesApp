import React, { useState, useEffect } from "react";
import { X, Search, User as UserIcon, MessageSquarePlus, Loader2 } from "lucide-react";
import { User } from "../../../types/auth.types";
import { userService } from "../../users/services/user.service";
import { useChatStore } from "../stores/chat.store";
import { toast } from "../../../stores/toast.store";
import { formatApiError } from "../../../lib/error-formatter";
import { Button } from "../../../components/ui/Button";

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
}

/**
 * Hộp thoại tạo cuộc trò chuyện mới (NewConversationModal)
 * Phong cách Tactile Neo-Brutalist:
 * 1. Khung Modal bo góc md (24px), viền 2px #2d3748, bóng đổ shadow-uupm-1
 * 2. Ô tìm kiếm người dùng thời gian thực theo tên đăng nhập hoặc email
 * 3. Danh sách kết quả kèm nút "Bắt đầu chat" xúc giác
 * 4. Tự động chuyển thẳng đến phòng chat sau khi khởi tạo thành công
 */
export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<string | null>(null);

  const { createConversation, selectConversation } = useChatStore();

  // Tìm kiếm người dùng với cơ chế debounce 300ms
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const users = await userService.searchUsers(searchQuery);
        // Lọc bỏ chính mình ra khỏi kết quả tìm kiếm
        setSearchResults(users.filter((u) => u.id !== currentUserId));
      } catch (err) {
        console.error("Lỗi tìm kiếm người dùng:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isOpen, currentUserId]);

  // Khởi tạo cuộc trò chuyện 1-1 với người dùng được chọn
  const handleStartChat = async (targetUser: User) => {
    try {
      setIsCreating(targetUser.id);
      const conversation = await createConversation({
        type: "DIRECT",
        participantIds: [targetUser.id],
      });

      if (conversation) {
        await selectConversation(conversation.id);
        toast.success(
          `Đã bắt đầu cuộc trò chuyện với ${targetUser.displayName || targetUser.username}!`,
          "Cuộc trò chuyện mới"
        );
        onClose();
      }
    } catch (err) {
      toast.error(formatApiError(err, "Không thể tạo cuộc trò chuyện mới"), "Lỗi khởi tạo");
    } finally {
      setIsCreating(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Khung Hộp thoại Neo-brutalist */}
      <div className="w-full max-w-md bg-white border-2 border-[#2d3748] rounded-md shadow-uupm-1 overflow-hidden select-none">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-[#add8e6] border-b-2 border-[#2d3748] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-[#0f172a]" />
            <h3 className="text-base font-black text-[#0f172a] uppercase tracking-wide">
              Cuộc trò chuyện mới
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xs bg-white hover:bg-slate-100 border-2 border-[#2d3748] shadow-uupm-active flex items-center justify-center text-[#0f172a] cursor-pointer"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nội dung Modal */}
        <div className="p-6 space-y-4">
          {/* Ô nhập tìm kiếm */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo username hoặc email..."
              className="w-full pl-10 pr-4 py-2.5 text-sm font-semibold bg-[#f8fafc] rounded-xs border-2 border-[#2d3748] shadow-uupm-active focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Danh sách kết quả tìm kiếm */}
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {isSearching ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#22c55e]" />
                <span className="text-xs font-bold">Đang tìm kiếm người dùng...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((user) => (
                <div
                  key={user.id}
                  className="p-3 bg-white hover:bg-slate-50 border-2 border-[#2d3748] rounded-xs shadow-uupm-active flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xs bg-[#fef08a] border-2 border-[#2d3748] flex items-center justify-center font-black text-sm shrink-0">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.username}
                          className="w-full h-full object-cover rounded-xs"
                        />
                      ) : (
                        <UserIcon className="w-5 h-5 text-[#0f172a]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-[#0f172a] truncate">
                        {user.displayName || user.username}
                      </h4>
                      <p className="text-[11px] font-semibold text-slate-500 truncate">
                        @{user.username} • {user.email}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isCreating === user.id}
                    onClick={() => handleStartChat(user)}
                    className="shrink-0 text-xs py-1.5 px-3 min-h-[36px]"
                  >
                    Nhắn tin
                  </Button>
                </div>
              ))
            ) : searchQuery.trim() ? (
              <div className="py-8 text-center text-slate-500 text-xs font-bold">
                Không tìm thấy người dùng nào phù hợp với &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs font-bold">
                Nhập tên đăng nhập hoặc email để tìm kiếm bạn bè
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
