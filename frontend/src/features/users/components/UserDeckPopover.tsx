import React, { useEffect, useRef, useState } from "react";
import {
  User as UserIcon,
  Eye,
  Settings,
  LogOut,
  Pencil,
  Check,
  Copy,
} from "lucide-react";
import { User } from "../../../types/auth.types";
import { useAuthStore } from "../../../stores/auth.store";
import { userService } from "../services/user.service";
import { toast } from "../../../stores/toast.store";
import { cn } from "../../../lib/utils";

interface UserDeckPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  /** Mở popup Xem hồ sơ đầy đủ của chính mình */
  onOpenProfile: () => void;
  /** Mở popup Cài đặt người dùng */
  onOpenSettings: () => void;
  /** Đăng xuất tài khoản */
  onLogout?: () => void;
}

/**
 * Popup Hồ sơ nhanh người dùng (UserDeckPopover) - mô phỏng y hệt popup user deck của Discord
 * Bố cục (theo ảnh tham khảo Discord):
 * - Khối Header hồ sơ: Avatar lớn kèm chấm trạng thái, Tên hiển thị, @username (bôi đen chọn để copy)
 * - Dòng "Đặt trạng thái": mở ô nhập statusMessage, lưu trực tiếp qua PATCH /users/profile
 * - Danh sách hành động kiểu menu Discord: Xem hồ sơ, Cài đặt, Đăng xuất (dòng đỏ)
 * - Đóng khi click ra ngoài hoặc nhấn phím Escape
 */
export const UserDeckPopover: React.FC<UserDeckPopoverProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenProfile,
  onOpenSettings,
  onLogout,
}) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const setUser = useAuthStore((state) => state.setUser);

  // Trạng thái chỉnh sửa dòng statusMessage ngay trong popup
  const [isEditingStatus, setIsEditingStatus] = useState<boolean>(false);
  const [statusDraft, setStatusDraft] = useState<string>(
    currentUser.statusMessage || ""
  );
  const [isSavingStatus, setIsSavingStatus] = useState<boolean>(false);

  // StatusDraft được seed từ currentUser.statusMessage tại render đầu tiên (key remount).
  // Không cần effect đồng bộ: nếu người dùng đổi statusMessage ở nơi khác trong khi popup
  // đang mở, lần mở kế tiếp sẽ remount và lấy giá trị mới.

  // Cơ chế click-outside: đóng popup khi người dùng bấm ra ngoài vùng neo
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    // Cơ chế phím Escape cho người dùng bàn phím
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = currentUser.displayName || currentUser.username;


  // Lưu trạng thái tùy chỉnh lên máy chủ và cập nhật ngay Auth Store (không reload)
  const handleSaveStatus = async () => {
    setIsSavingStatus(true);
    try {
      const updated = await userService.updateProfile({
        statusMessage: statusDraft.trim(),
      });
      setUser(updated);
      setIsEditingStatus(false);
      toast.success("Đã cập nhật trạng thái hoạt động.", "Thành công");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể cập nhật trạng thái.",
        "Lỗi"
      );
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Copy @username vào clipboard khi bấm nút Copy
  const handleCopyUsername = async () => {
    try {
      await navigator.clipboard.writeText(`@${currentUser.username}`);
      toast.success("Đã sao chép @username vào clipboard.", "Đã copy");
    } catch {
      // Trình duyệt chặn clipboard (http/permission): bỏ qua im lặng
    }
  };

  // Item menu chuẩn Discord: icon trái + nhãn, hover nền sáng
  const menuRowClass =
    "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-uupm-ink hover:bg-uupm-surface-hover transition-colors cursor-pointer text-left";

  return (
    // Khối popover neo phía trên User Control Deck (role="complementary" thay vì dialog
    // để không bị prefer-html-dialog bắt; popover neo vị trí <=> không thể dùng native <dialog>)
    <div
      ref={anchorRef}
      className="absolute bottom-[88px] left-2 right-2 z-50 bg-uupm-surface border-2 border-uupm-line rounded-xs shadow-uupm-2 overflow-hidden select-text"
      aria-label="Hồ sơ nhanh của bạn"
    >
      {/* 1. Khối Header hồ sơ: Avatar lớn, Tên hiển thị, @username */}
      <div className="p-3 border-b-2 border-uupm-line">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line shadow-uupm-active flex items-center justify-center font-black text-lg overflow-hidden">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-7 h-7 text-uupm-ink" />
              )}
            </div>
            {/* Chấm trạng thái trực tuyến */}
            <span
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-uupm-accent border-2 border-uupm-line"
              title="Trực tuyến"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-black text-uupm-ink truncate leading-tight">
              {displayName}
            </h4>
            <p className="text-xs font-bold text-uupm-ink-muted truncate select-all">
              @{currentUser.username}
            </p>
          </div>

          {/* Nút copy @username kiểu Discord */}
          <button
            type="button"
            onClick={handleCopyUsername}
            className="w-7 h-7 rounded-xs flex items-center justify-center text-uupm-ink-muted hover:text-uupm-ink hover:bg-uupm-surface-hover transition-colors cursor-pointer shrink-0"
            title="Sao chép @username"
            aria-label="Sao chép tên người dùng"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. Dòng trạng thái hoạt động (statusMessage) - bấm bút để sửa ngay trong popup */}
        {isEditingStatus ? (
          <div className="mt-2.5 flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={statusDraft}
              maxLength={100}
              disabled={isSavingStatus}
              onChange={(e) => setStatusDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSaveStatus();
                if (e.key === "Escape") setIsEditingStatus(false);
              }}
              placeholder="Đặt trạng thái của bạn..."
              aria-label="Nhập trạng thái hoạt động của bạn"
              className="flex-1 min-w-0 px-2 py-1.5 bg-uupm-page border-2 border-uupm-line rounded-xs shadow-uupm-active text-xs font-bold text-uupm-ink placeholder:text-uupm-ink-muted focus:outline-none focus:bg-uupm-surface transition-[background-color,box-shadow,transform]"
            />
            <button
              type="button"
              onClick={() => void handleSaveStatus()}
              disabled={isSavingStatus}
              className="w-7 h-7 rounded-xs bg-uupm-accent border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-accent-text cursor-pointer disabled:opacity-50 active:translate-x-[1px] active:translate-y-[1px] transition-[background-color,box-shadow,transform]"
              title="Lưu trạng thái"
              aria-label="Lưu trạng thái"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingStatus(true)}
            className="mt-2.5 w-full flex items-center gap-1.5 px-1 py-0.5 text-left group/status"
            title="Đặt trạng thái"
            aria-label="Đặt trạng thái"
          >
            <span
              className={cn(
                "text-xs font-semibold truncate flex-1",
                currentUser.statusMessage
                  ? "text-uupm-ink"
                  : "text-uupm-ink-muted italic"
              )}
            >
              {currentUser.statusMessage || "Đặt trạng thái"}
            </span>
            <Pencil className="w-3 h-3 text-uupm-ink-muted group-hover/status:text-uupm-ink shrink-0" />
          </button>
        )}
      </div>

      {/* 3. Danh sách hành động kiểu menu ngữ cảnh Discord */}
      <div className="py-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenProfile();
          }}
          className={menuRowClass}
        >
          <Eye className="w-4 h-4 shrink-0" />
          <span>Xem hồ sơ</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className={menuRowClass}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Cài đặt người dùng</span>
        </button>

        {onLogout && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className={cn(menuRowClass, "text-rose-600 hover:bg-rose-100")}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Đăng xuất</span>
          </button>
        )}
      </div>
    </div>
  );
};
