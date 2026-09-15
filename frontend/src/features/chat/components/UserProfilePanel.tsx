import React, { useEffect, useState } from "react";
import {
  X,
  User as UserIcon,
  Calendar,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { User } from "../../../types/auth.types";
import { Button } from "../../../components/ui/Button";
import { userService } from "../../users/services/user.service";
import { FullUserProfileModal } from "../../users/components/FullUserProfileModal";
import { cn } from "../../../lib/utils";

// Formatter ngày tham gia tài khoản (tiếng Việt) — tạo 1 lần ở module scope
// thay vì dựng lại mỗi lần format (rule js-hoist-intl).
const JOINED_DATE_FMT = new Intl.DateTimeFormat("vi-VN", {
  month: "long",
  year: "numeric",
});

interface UserProfilePanelProps {
  user: User | null;
  isOnline?: boolean;
  onClose: () => void;
}

/**
 * Bảng hiển thị hồ sơ chi tiết đối phương bên phải (UserProfilePanel - Cột 3)
 * Phong cách Tactile Neo-Brutalist chuẩn UI/UX Pro Max:
 * - Tự động tải dữ liệu thực tế mới nhất từ máy chủ qua getUserById
 * - Đồng bộ ảnh bìa thực tế (user.bannerUrl) hoặc nền gradient mặc định
 * - Avatar lớn 80x80 đè lên banner kèm chấm trạng thái trực tuyến
 * - Tên hiển thị, @username, dòng trạng thái thực tế (statusMessage)
 * - Khung tiểu sử cá nhân thực tế (user.bio)
 * - Khung ngày tham gia hệ thống (user.createdAt)
 * - Nút hành động xúc giác cơ học
 */
export const UserProfilePanel: React.FC<UserProfilePanelProps> = ({
  user,
  isOnline = false,
  onClose,
}) => {
  // Khởi tạo profileData từ prop user ban đầu; fetch bên dưới sẽ ghi đè nếu API trả dữ liệu mới hơn.
  const [profileData, setProfileData] = useState<User | null>(user);
  // Trạng thái mở modal xem hồ sơ đầy đủ 2 cột kiểu Discord
  const [isFullProfileOpen, setIsFullProfileOpen] = useState<boolean>(false);

  // Tải dữ liệu mới nhất từ API mỗi khi id đổi (nguồn dữ liệu chính).
  // Bỏ mirror effect prop→state (rule no-mirror-prop-effect): dữ liệu prop chỉ dùng làm
  // fallback khi fetch lỗi, không cần sync vào state mỗi render.
  useEffect(() => {
    if (!user?.id) {
      setProfileData(user);
      return;
    }
    // Gán prop ngay để UI hiển thị tức thì (không chờ network), sau đó fetch ghi đè.
    setProfileData(user);
    userService
      .getUserById(user.id)
      .then((freshUser) => {
        if (freshUser) {
          setProfileData(freshUser);
        }
      })
      .catch(() => {
        // Bỏ qua lỗi và tiếp tục dùng dữ liệu sẵn có từ props
      });
  }, [user?.id]);

  const activeUser = profileData || user;
  if (!activeUser) return null;

  const displayName = activeUser.displayName || activeUser.username;
  const usernameHandle = `@${activeUser.username}`;

  // Định dạng ngày đăng ký tài khoản sang tiếng Việt thân thiện
  const formattedJoinedDate = activeUser.createdAt
    ? JOINED_DATE_FMT.format(new Date(activeUser.createdAt))
    : "Tháng 9, 2026";

  return (
    <div className="w-80 xl:w-[320px] h-full bg-uupm-page border-l-2 border-uupm-line flex flex-col shrink-0 select-none transition-all duration-200 ease-out z-20">
      {/* Thân danh sách cuộn mượt (Banner, Avatar và Thông tin cá nhân) */}
      <div className="flex-1 overflow-y-auto">
        {/* 1. Khu vực Banner thực & Nút Đóng */}
        <div className="relative h-28 border-b-2 border-uupm-line p-3 flex justify-end items-start shrink-0 overflow-hidden bg-uupm-accent-soft">
          {activeUser.bannerUrl ? (
            <img
              src={activeUser.bannerUrl}
              alt={`Ảnh bìa của ${displayName}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-uupm-accent via-uupm-accent-soft to-uupm-warn-soft">
              {/* Họa tiết lưới Neo-Brutalist trang trí khi chưa có ảnh bìa */}
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(hsl(var(--uupm-ink))_1px,transparent_1px)] [background-size:10px_10px] pointer-events-none" />
            </div>
          )}

          {/* Nút đóng panel */}
          <button
            type="button"
            onClick={onClose}
            className="relative z-10 w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
            title="Đóng hồ sơ"
            aria-label="Đóng hồ sơ người dùng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Avatar Lớn 80x80 đè Banner & Trạng thái Online */}
        <div className="px-5 -mt-12 relative z-10">
          <div className="relative inline-block">
            <div className="w-20 h-20 rounded-xs bg-uupm-surface border-3 border-uupm-line shadow-uupm-2 flex items-center justify-center overflow-hidden font-black text-xl text-uupm-accent-text">
              {activeUser.avatarUrl ? (
                <img
                  src={activeUser.avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-10 h-10 text-uupm-ink" />
              )}
            </div>

            {/* Chấm tròn trạng thái Online lớn */}
            <span
              className={cn(
                "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-uupm-line shadow-sm",
                isOnline ? "bg-uupm-accent" : "bg-uupm-ink-muted"
              )}
              title={isOnline ? "Đang trực tuyến" : "Ngoại tuyến"}
            />
          </div>
        </div>

        {/* 3. Khung thông tin cá nhân chính */}
        <div className="p-5 space-y-4">
          {/* Thẻ tên hiển thị, Username & Dòng trạng thái thực */}
          <div className="p-3.5 bg-uupm-surface rounded-xs border-2 border-uupm-line shadow-uupm-active space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-base font-black text-uupm-ink tracking-tight truncate">
                {displayName}
              </h3>
            </div>

            <p className="text-xs font-bold text-uupm-ink-muted truncate">
              {usernameHandle}
            </p>

            {/* Dòng trạng thái hoạt động thực tế nếu người dùng có cài đặt */}
            {activeUser.statusMessage && (
              <p className="pt-1.5 text-xs font-semibold text-uupm-ink-soft border-t border-uupm-line/30 italic leading-relaxed">
                &ldquo;{activeUser.statusMessage}&rdquo;
              </p>
            )}

            {/* Dải huy hiệu định danh thực tế */}
            <div className="pt-2 flex items-center gap-1.5 flex-wrap">
              {/* Huy hiệu trạng thái kết nối */}
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-xs border-2 border-uupm-line shadow-uupm-active text-[10px] font-black",
                  isOnline
                    ? "bg-uupm-accent-soft text-uupm-accent-text"
                    : "bg-uupm-page text-uupm-ink-muted"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isOnline ? "bg-uupm-accent" : "bg-uupm-ink-muted"
                  )}
                />
                <span>{isOnline ? "Trực tuyến" : "Ngoại tuyến"}</span>
              </span>

              {/* Huy hiệu phân quyền Quản trị viên (nếu có) */}
              {activeUser.role === "ADMIN" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-uupm-warn-soft border-2 border-uupm-line shadow-uupm-active text-[10px] font-black text-uupm-warn-soft-ink">
                  <ShieldCheck className="w-3 h-3 text-uupm-warn-soft-ink" />
                  <span>Quản trị viên</span>
                </span>
              )}
            </div>
          </div>

          {/* Khung Tiểu sử cá nhân */}
          <div className="p-3.5 bg-uupm-surface rounded-xs border-2 border-uupm-line shadow-uupm-active space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-uupm-ink-muted block">
              Tiểu sử
            </span>
            <p className="text-xs font-semibold text-uupm-ink leading-relaxed bg-uupm-page p-2.5 rounded-xs border border-uupm-line/40 italic">
              {activeUser.bio ? `“${activeUser.bio}”` : "Chưa có lời giới thiệu nào."}
            </p>
          </div>

          {/* Khung Thông tin tài khoản & Ngày tham gia */}
          <div className="p-3.5 bg-uupm-surface rounded-xs border-2 border-uupm-line shadow-uupm-active space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-uupm-ink-muted block">
              Thông tin tài khoản
            </span>
            <div className="flex items-center gap-2 text-xs font-bold text-uupm-ink">
              <Calendar className="w-3.5 h-3.5 text-uupm-accent" />
              <span>Tham gia từ {formattedJoinedDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Nút Hành Động Ở Chân Panel (Cố định h-[84px] đồng bộ đường kẻ ngang thẳng hàng với MessageInput) */}
      <div className="h-[84px] px-4 border-t-2 border-uupm-line bg-uupm-surface shrink-0 flex items-center">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => setIsFullProfileOpen(true)}
          className="w-full justify-center text-xs font-black uppercase tracking-wide"
          rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
        >
          Xem Hồ Sơ Đầy Đủ
        </Button>
      </div>

      {/* Modal hiển thị toàn bộ hồ sơ chi tiết chuẩn phong cách Discord */}
      <FullUserProfileModal
        isOpen={isFullProfileOpen}
        onClose={() => setIsFullProfileOpen(false)}
        user={activeUser}
        isOnline={isOnline}
      />
    </div>
  );
};
