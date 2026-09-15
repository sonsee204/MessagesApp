import React from "react";
import { Users, Sparkles, MessageCircle } from "lucide-react";
import { User } from "../../../types/auth.types";
import { RelationshipStatus } from "../services/friend.service";
import { cn } from "../../../lib/utils";

type ProfileTab = "activity" | "mutual_friends" | "mutual_servers";

interface ProfileTabsProps {
  activeTab: ProfileTab;
  setActiveTab: (tab: ProfileTab) => void;
  user: User;
  isOnline: boolean;
  relationshipStatus: RelationshipStatus;
  mutualConversations: { id: string; title?: string | null; type?: string }[];
  onSelectConversation: (id: string) => void;
  onClose: () => void;
}

// Định nghĩa các tab để tránh lặp cấu hình className dài dòng (rule no-duplicate-jsx).
const TAB_ITEMS: { key: ProfileTab; label: (count: number) => string }[] = [
  { key: "activity", label: () => "Hoạt động" },
  { key: "mutual_friends", label: () => "Bạn Chung" },
  {
    key: "mutual_servers",
    label: (count) => `${count} Hội Thoại Chung`,
  },
];

/**
 * Khối Tabs cột phải của FullUserProfileModal:
 * - Thanh chuyển tab (Hoạt động / Bạn Chung / Hội thoại Chung)
 * - 3 nội dung tương ứng: Tiểu sử & trạng thái, Bạn chung, Danh sách hội thoại chung
 * Tách khỏi modal cha để giảm độ phức tạp hàm (rule no-high-complexity-react-function).
 */
export const ProfileTabs: React.FC<ProfileTabsProps> = ({
  activeTab,
  setActiveTab,
  user,
  isOnline,
  relationshipStatus,
  mutualConversations,
  onSelectConversation,
  onClose,
}) => {
  // Class chung cho từng nút tab, highlight theo tab đang chọn.
  const tabButtonClass = (tab: ProfileTab) =>
    cn(
      "text-xs font-black uppercase tracking-wider transition-colors pb-1 cursor-pointer relative",
      activeTab === tab
        ? "text-uupm-ink after:absolute after:bottom-[-9px] after:left-0 after:right-0 after:h-[2.5px] after:bg-uupm-accent after:rounded-full"
        : "text-uupm-ink-muted hover:text-uupm-ink"
    );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Thanh chuyển tab trên đỉnh */}
      <div className="flex items-center gap-6 border-b-2 border-uupm-line/20 pb-2 mb-4">
        {TAB_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveTab(item.key)}
            className={tabButtonClass(item.key)}
          >
            {item.label(mutualConversations.length)}
          </button>
        ))}
      </div>

      {/* Nội dung Tab 1: Hoạt động & Tiểu sử */}
      {activeTab === "activity" && (
        <div className="space-y-4 flex-1">
          {/* Thẻ tiểu sử cá nhân */}
          <div className="p-3.5 bg-uupm-page border-2 border-uupm-line rounded-xs shadow-uupm-active space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-uupm-ink-muted block">
              Tiểu sử cá nhân
            </span>
            <p className="text-xs font-semibold text-uupm-ink leading-relaxed whitespace-pre-wrap">
              {user.bio ? user.bio : "Chưa có lời giới thiệu nào được cài đặt."}
            </p>
          </div>

          {/* Thẻ trạng thái phiên hiện tại */}
          <div className="p-3.5 bg-uupm-page border-2 border-uupm-line rounded-xs shadow-uupm-active space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-uupm-ink-muted block">
              Trạng thái kết nối
            </span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "w-2.5 h-2.5 rounded-full border border-uupm-line",
                  isOnline ? "bg-uupm-accent" : "bg-uupm-ink-muted"
                )}
              />
              <span className="text-xs font-bold text-uupm-ink">
                {isOnline ? "Đang trực tuyến trên ứng dụng" : "Hiện đang ngoại tuyến"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Nội dung Tab 2: Bạn Chung */}
      {activeTab === "mutual_friends" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line shadow-uupm-active flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-uupm-ink" />
          </div>
          <h4 className="text-xs font-black text-uupm-ink uppercase tracking-wide">
            Bạn bè chung
          </h4>
          <p className="text-xs font-semibold text-uupm-ink-muted mt-1 max-w-xs">
            {relationshipStatus === "FRIENDS"
              ? "Hai bạn đã là bạn bè trực tiếp của nhau!"
              : "Chưa có người bạn chung nào được tìm thấy giữa hai tài khoản."}
          </p>
        </div>
      )}

      {/* Nội dung Tab 3: Hội thoại & Nhóm chung */}
      {activeTab === "mutual_servers" && (
        <div className="flex-1 space-y-2 overflow-y-auto max-h-[260px] pr-1">
          {mutualConversations.length > 0 ? (
            mutualConversations.map((conv) => (
              <button
                type="button"
                key={conv.id}
                onClick={() => {
                  onSelectConversation(conv.id);
                  onClose();
                }}
                className="p-2.5 bg-uupm-page hover:bg-uupm-surface-hover border-2 border-uupm-line rounded-xs shadow-uupm-active flex items-center justify-between cursor-pointer transition-colors w-full text-left bg-transparent border-0 p-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uupm-accent"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xs bg-uupm-accent border-2 border-uupm-line flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4 text-uupm-ink" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-uupm-ink truncate">
                      {conv.title || "Cuộc trò chuyện trực tiếp"}
                    </h4>
                    <p className="text-[10px] font-semibold text-uupm-ink-muted truncate">
                      {conv.type === "DIRECT" ? "Trò chuyện 1-1" : "Nhóm trò chuyện"}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] py-1 px-2 shrink-0 font-bold border-2 border-uupm-line rounded-xs bg-uupm-surface text-uupm-ink-muted">
                  Mở chat
                </span>
              </button>
            ))
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center my-auto">
              <div className="w-12 h-12 rounded-xs bg-uupm-page border-2 border-uupm-line shadow-uupm-active flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-uupm-ink-muted" />
              </div>
              <h4 className="text-xs font-black text-uupm-ink uppercase tracking-wide">
                Chưa có hội thoại chung
              </h4>
              <p className="text-xs font-semibold text-uupm-ink-muted mt-1 max-w-xs">
                Hãy bấm nút Nhắn tin ở cột bên trái để bắt đầu cuộc hội thoại đầu tiên!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
