import React from "react";
import { Users, UserPlus, ArrowLeft } from "lucide-react";
import type { FriendsTab } from "../types/friend.types";
import { ThemeToggle } from "../../../components/ui/ThemeToggle";

// Cấu hình thanh tab để tránh lặp className dài dòng (rule no-duplicate-jsx).
const NAV_TABS: { key: FriendsTab; label: string; highlight?: boolean }[] = [
  { key: "online", label: "Trực tuyến" },
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Đang chờ" },
  { key: "blocked", label: "Đã chặn" },
  { key: "add", label: "Thêm Bạn", highlight: true },
];

interface FriendsHeaderProps {
  activeTab: FriendsTab;
  /** Số lượng badge hiển thị trên mỗi tab: online/all/pending/blocked */
  counts: Record<FriendsTab, number>;
  onSelectTab: (tab: FriendsTab) => void;
  onBack?: () => void;
}

/**
 * Header điều hướng tab của màn hình Bạn bè (chuẩn Discord).
 * Tách khỏi FriendsView để giảm JSX nesting và độ dài component cha.
 */
export const FriendsHeader: React.FC<FriendsHeaderProps> = ({
  activeTab,
  counts,
  onSelectTab,
  onBack,
}) => (
  <header className="h-14 border-b-2 border-uupm-line px-4 flex items-center justify-between shrink-0 bg-uupm-surface z-10 gap-2">
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
      {/* Nút quay lại trên màn hình di động */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="md:hidden w-8 h-8 rounded-xs border-2 border-uupm-line bg-uupm-surface hover:bg-uupm-surface-hover flex items-center justify-center text-uupm-ink mr-1 shrink-0 cursor-pointer shadow-uupm-active active:translate-x-[1px] active:translate-y-[1px]"
          title="Quay lại danh sách"
          aria-label="Quay lại danh sách"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}

      {/* Nhãn chính */}
      <div className="flex items-center gap-2 pr-2 text-uupm-ink font-black shrink-0">
        <Users className="w-5 h-5" />
        <span className="text-sm uppercase tracking-wider hidden md:inline">Bạn Bè</span>
      </div>

      {/* Phân cách dọc */}
      <div className="h-5 w-[2px] bg-uupm-line/20 shrink-0 hidden sm:block" />

      {/* Các tab: được render từ NAV_TABS config, tránh lặp JSX */}
      {NAV_TABS.map((tab) => {
        const count = counts[tab.key] ?? 0;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelectTab(tab.key)}
            className={`px-3 py-1 rounded-xs text-xs font-black shrink-0 cursor-pointer transition-[background-color,box-shadow,transform] flex items-center gap-1.5 ${
              tab.highlight
                ? `border-2 ${
                    activeTab === tab.key
                      ? "bg-uupm-accent text-uupm-accent-text border-uupm-line shadow-uupm-active"
                      : "bg-uupm-accent/20 text-uupm-accent-text border-transparent hover:border-uupm-line hover:bg-uupm-accent/40"
                  }`
                : activeTab === tab.key
                  ? "bg-uupm-page border-2 border-uupm-line shadow-uupm-active text-uupm-ink"
                  : "text-uupm-ink-muted hover:text-uupm-ink hover:bg-uupm-surface-hover"
            }`}
          >
            {tab.highlight && <UserPlus className="w-3.5 h-3.5" />}
            <span>{tab.label}</span>
            {/* Badge số lượng: pending hiển thị badge đỏ nếu > 0, các tab khác hiện count thường */}
            {tab.key === "pending" && count > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-uupm-danger text-uupm-danger-ink text-[10px] font-black">{count}</span>
            ) : !tab.highlight && (
              <span className="text-[10px] opacity-75 font-bold">({count})</span>
            )}
          </button>
        );
      })}
    </div>

    {/* Phía bên phải: nút đổi Theme sáng/tối đồng bộ với ChatHeader */}
    <div className="flex items-center gap-2 shrink-0">
      <ThemeToggle />
    </div>
  </header>
);
