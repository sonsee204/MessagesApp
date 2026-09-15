import React, { useEffect, useRef, useState } from "react";
import { X, User as UserIcon, KeyRound, Palette, IdCard } from "lucide-react";
import { User } from "../../../types/auth.types";
import { ThemeToggle } from "../../../components/ui/ThemeToggle";
import { useThemeStore } from "../../../stores/theme.store";
import { UserProfileForm } from "./UserProfileForm";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { AccountInfoPanel } from "./AccountInfoPanel";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

// "account" là thông tin định danh chỉ đọc; "profile" là phần người dùng sửa được
type SettingsTab = "account" | "profile" | "security" | "appearance";

/**
 * Popup Cài đặt người dùng (tham khảo bố cục User Settings của Discord).
 * Gồm 3 phân mục: Hồ sơ, Mật khẩu & Bảo mật, Giao diện.
 * Toàn bộ nội dung từng phân mục được tách sang component riêng để component này
 * chỉ còn nhiệm vụ điều hướng tab, xử lý bàn phím và các trạng thái loading/empty/error.
 */
export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const theme = useThemeStore((state) => state.theme);

  // activeTab được reset tự nhiên qua key remount ở call site (ConversationSidebar)
  // — không cần effect reset thủ công (rule no-reset-all-state-on-prop-change).

  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  // Danh sách phân mục hiển thị ở cột điều hướng bên trái
  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "account", label: "Tài khoản", icon: <IdCard className="w-4 h-4" /> },
    { id: "profile", label: "Hồ sơ của tôi", icon: <UserIcon className="w-4 h-4" /> },
    { id: "security", label: "Mật khẩu & Bảo mật", icon: <KeyRound className="w-4 h-4" /> },
    { id: "appearance", label: "Giao diện", icon: <Palette className="w-4 h-4" /> },
  ];

  return (
    // Pattern B: không có m-0 ⇒ UA margin:auto căn giữa.
    // onClose={onClose} đảm bảo Esc đồng bộ state, KHÔNG cần handler thủ công.
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="Cài đặt người dùng"
      className="m-auto p-0 w-[90vw] max-w-4xl max-h-[90dvh] bg-uupm-surface border-2 border-uupm-line rounded-md shadow-uupm-1 overflow-hidden select-none flex flex-col backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
        {/* Header Modal */}
        <div className="px-6 py-4 bg-uupm-accent-soft border-b-2 border-uupm-line flex items-center justify-between shrink-0">
          <h3 className="text-lg font-black text-uupm-ink uppercase tracking-wide">Cài đặt người dùng</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uupm-accent active:translate-x-[1px] active:translate-y-[1px]"
            aria-label="Đóng hộp thoại cài đặt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thân Modal: cột điều hướng + vùng nội dung cuộn được */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          {/* Cột điều hướng phân mục (mobile: dải tab ngang, desktop: danh sách dọc rộng 240px) */}
          <nav
            aria-label="Danh mục cài đặt"
            className="shrink-0 border-b-2 sm:border-b-0 sm:border-r-2 border-uupm-line bg-uupm-page p-3 flex sm:flex-col gap-2 overflow-x-auto sm:overflow-x-visible sm:w-60"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xs border-2 text-sm font-black whitespace-nowrap cursor-pointer transition-[background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uupm-accent ${
                    isActive
                      ? "bg-uupm-accent-soft border-uupm-line text-uupm-ink shadow-uupm-active"
                      : "bg-uupm-surface border-transparent text-uupm-ink-muted hover:bg-uupm-surface-hover hover:text-uupm-ink"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Vùng nội dung của phân mục đang chọn */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6 sm:p-8 bg-uupm-surface">
            {activeTab === "account" && <AccountInfoPanel currentUser={currentUser} />}

            {activeTab === "profile" && <UserProfileForm currentUser={currentUser} />}

            {activeTab === "security" && <ChangePasswordForm />}

            {activeTab === "appearance" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wide text-uupm-ink">Chế độ hiển thị</h4>
                  <p className="mt-1 text-xs font-semibold text-uupm-ink-muted leading-relaxed">
                    Chuyển đổi giữa giao diện sáng và tối. Lựa chọn được ghi nhớ trên thiết bị này.
                  </p>
                </div>

                {/* Thẻ trạng thái theme hiện tại + nút chuyển đổi */}
                <div className="p-4 bg-uupm-page border-2 border-uupm-line rounded-xs shadow-uupm-active flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-uupm-ink">
                      Đang dùng: {theme === "dark" ? "Giao diện tối" : "Giao diện sáng"}
                    </p>
                    <p className="text-[11px] font-bold text-uupm-ink-muted mt-0.5">
                      Giao diện tối dịu mắt khi trò chuyện ban đêm
                    </p>
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            )}
          </div>
        </div>
    </dialog>
  );
};
