import React from "react";
import { User as UserIcon, Trash2 } from "lucide-react";
import { User } from "../../../types/auth.types";
import { ImageUploadButton } from "./ImageUploadButton";
import { Button } from "../../../components/ui/Button";

interface ProfileBannerProps {
  currentUser: User;
  isUploading?: boolean;
  onBannerSelected: (file: File) => void;
  onBannerCleared: () => void;
}

/**
 * Khối nhận diện đầu tab "Hồ sơ của tôi", bố cục theo kiểu Discord:
 * ảnh bìa nằm ngang phía trên, ảnh đại diện lớn đè lên mép dưới, tên và
 * dòng trạng thái nằm bên dưới.
 *
 * Thuần trình bày: nhận dữ liệu và callback từ form cha, không gọi API.
 */
export const ProfileBanner: React.FC<ProfileBannerProps> = ({
  currentUser,
  isUploading = false,
  onBannerSelected,
  onBannerCleared,
}) => {
  return (
    // Bọc toàn bộ thành 1 card định danh đồng nhất, có viền nổi và bóng đổ Neo-Brutalist tạo điểm nhấn
    <div className="w-full bg-uupm-page border-2 border-uupm-line rounded-sm shadow-uupm-2 overflow-hidden">
      {/* Ảnh bìa. Dùng aspect-[3/1] thay vì chiều cao cứng để không vỡ bố cục trên màn hình hẹp. */}
      <div className="relative w-full aspect-[3/1] bg-uupm-accent-soft border-b-2 border-uupm-line overflow-hidden">
        {currentUser.bannerUrl ? (
          <img
            src={currentUser.bannerUrl}
            alt="Ảnh bìa trang hồ sơ"
            className="w-full h-full object-cover"
          />
        ) : (
          // Chưa có ảnh bìa: dùng nền token accent-soft, không hardcode mã màu
          <div className="w-full h-full" />
        )}

        {/* Cụm nút quản lý ảnh bìa, đặt đè lên góc phải ảnh bìa */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <ImageUploadButton
            label="Đổi ảnh bìa"
            ariaLabel="Tải lên ảnh bìa mới"
            isUploading={isUploading}
            onFileSelected={onBannerSelected}
          />
          {currentUser.bannerUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              disabled={isUploading}
              aria-disabled={isUploading}
              aria-label="Xoá ảnh bìa, quay về nền mặc định"
              onClick={onBannerCleared}
            >
              Xoá
            </Button>
          )}
        </div>
      </div>

      {/* Thân thẻ hồ sơ: avatar lớn đè mép banner kèm hộp thông tin danh tính active */}
      <div className="px-5 pb-5 pt-0">
        {/* relative z-10 tạo stacking context đưa avatar nổi lên trên ảnh bìa */}
        <div className="relative z-10 w-20 h-20 -mt-10 rounded-xs bg-uupm-surface border-2 border-uupm-line shadow-uupm-2 flex items-center justify-center overflow-hidden">
          {currentUser.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={`Ảnh đại diện của ${currentUser.displayName || currentUser.username}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <UserIcon className="w-9 h-9 text-uupm-ink" />
          )}
        </div>

        {/* Khung thông tin cá nhân nổi bật với huy hiệu trạng thái hoạt động */}
        <div className="mt-3 p-3.5 bg-uupm-surface border-2 border-uupm-line rounded-xs shadow-uupm-active space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-black text-uupm-ink tracking-tight truncate">
              {currentUser.displayName || currentUser.username}
            </h4>
            {/* Huy hiệu trạng thái active tạo điểm nhấn sinh động */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line shadow-uupm-active text-[10px] font-black text-uupm-accent-text"
              title="Đang hoạt động"
            >
              <span className="w-2 h-2 rounded-full bg-uupm-accent border border-uupm-line" />
              <span>Đang hoạt động</span>
            </span>
          </div>

          <p className="text-xs font-bold text-uupm-ink-muted truncate">@{currentUser.username}</p>

          {currentUser.statusMessage && (
            <div className="pt-2 mt-2 border-t-2 border-uupm-line/20 text-xs font-semibold text-uupm-ink-soft italic">
              &ldquo;{currentUser.statusMessage}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
