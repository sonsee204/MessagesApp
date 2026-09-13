import React from "react";
import {
  X,
  User as UserIcon,
  Users,
  Sparkles,
  ShieldCheck,
  Award,
  ExternalLink,
  Flame,
  Star,
} from "lucide-react";
import { User } from "../../../types/auth.types";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../stores/toast.store";
import { cn } from "../../../lib/utils";

interface UserProfilePanelProps {
  user: User | null;
  isOnline?: boolean;
  onClose: () => void;
}

/**
 * Bảng hiển thị hồ sơ chi tiết đối phương bên phải (UserProfilePanel - Cột 3)
 * Phong cách Tactile Neo-Brutalist chuẩn UI/UX Pro Max:
 * - Đã tinh giản theo chỉ đạo: Lược bỏ máy chủ chung, bộ sưu tập game và ngày gia nhập
 * - Ảnh bìa Banner Neo-Brutalist sắc nét kèm nút đóng nhanh
 * - Avatar lớn 80x80 viền 3px #2d3748 đè lên banner với chấm tròn trực tuyến
 * - Tên hiển thị, @username, dải huy hiệu danh dự độc quyền
 * - Thẻ Bạn chung và Khung ghi chú / Tiểu sử cá nhân
 * - Nút "Xem hồ sơ đầy đủ" xúc giác lún cơ học
 */
export const UserProfilePanel: React.FC<UserProfilePanelProps> = ({
  user,
  isOnline = false,
  onClose,
}) => {
  if (!user) return null;

  const displayName = user.displayName || user.username;
  const usernameHandle = `@${user.username}`;
  const bioText = user.bio || "vaoday ngoiban oi 🎮";

  return (
    <div className="w-80 xl:w-[320px] h-full bg-[#f8fafc] border-l-2 border-[#2d3748] flex flex-col shrink-0 overflow-y-auto select-none transition-all duration-200 ease-out z-20">
      {/* 1. Khu vực Banner & Nút Đóng */}
      <div className="relative h-28 bg-gradient-to-r from-[#22c55e] via-[#add8e6] to-[#fef08a] border-b-2 border-[#2d3748] p-3 flex justify-end items-start shrink-0">
        {/* Họa tiết lưới / chấm Neo-Brutalist trang trí */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#2d3748_1px,transparent_1px)] [background-size:10px_10px] pointer-events-none" />

        {/* Nút đóng panel */}
        <button
          type="button"
          onClick={onClose}
          className="relative z-10 w-8 h-8 rounded-xs bg-white hover:bg-slate-100 border-2 border-[#2d3748] shadow-uupm-active flex items-center justify-center text-[#0f172a] cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
          title="Đóng hồ sơ"
          aria-label="Đóng hồ sơ người dùng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Avatar Lớn 80x80 đè Banner & Trạng thái Online */}
      <div className="px-5 -mt-12 relative z-10">
        <div className="relative inline-block">
          <div className="w-20 h-20 rounded-xs bg-[#add8e6] border-3 border-[#2d3748] shadow-uupm-2 flex items-center justify-center overflow-hidden font-black text-xl text-[#0f172a] bg-white">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon className="w-10 h-10 text-[#0f172a]" />
            )}
          </div>

          {/* Chấm tròn trạng thái Online lớn */}
          <span
            className={cn(
              "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#2d3748] shadow-sm",
              isOnline ? "bg-[#22c55e]" : "bg-slate-400"
            )}
            title={isOnline ? "Đang trực tuyến" : "Ngoại tuyến"}
          />
        </div>
      </div>

      {/* 3. Khung thông tin cá nhân chính */}
      <div className="p-5 space-y-4 flex-1">
        {/* Thẻ tên hiển thị & Username */}
        <div className="p-3.5 bg-white rounded-xs border-2 border-[#2d3748] shadow-uupm-active space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-base font-black text-[#0f172a] tracking-tight">
              {displayName}
            </h3>
            <span className="text-xs" title="Biểu tượng cá nhân">
              🌸
            </span>
          </div>

          <p className="text-xs font-bold text-slate-500">
            {usernameHandle}
            <span className="text-slate-400 font-semibold ml-1.5">• he/him</span>
          </p>

          {/* Dải huy hiệu danh dự kiểu Discord */}
          <div className="pt-2 flex items-center gap-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#add8e6] border-2 border-[#2d3748] shadow-uupm-active text-[10px] font-black text-[#0f172a]"
              title="Thành viên HypeSquad"
            >
              <Sparkles className="w-3 h-3 text-[#0f172a]" />
              <span>HypeSquad</span>
            </span>

            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#fef08a] border-2 border-[#2d3748] shadow-uupm-active text-[10px] font-black text-[#0f172a]"
              title="Người ủng hộ nhiệt tình"
            >
              <Flame className="w-3 h-3 text-orange-500" />
              <span>Nitro</span>
            </span>

            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#22c55e] border-2 border-[#2d3748] shadow-uupm-active text-[10px] font-black text-[#0f172a]"
              title="Đã xác thực bảo mật"
            >
              <ShieldCheck className="w-3 h-3 text-[#0f172a]" />
              <span>Xác minh</span>
            </span>
          </div>
        </div>

        {/* Thẻ Bạn chung */}
        <div className="p-3.5 bg-white rounded-xs border-2 border-[#2d3748] shadow-uupm-active">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#0f172a] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#22c55e]" />
              <span>Bạn Chung</span>
            </span>
            <span className="text-[11px] font-bold text-slate-500">4 người</span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="flex -space-x-2">
              <div className="w-7 h-7 rounded-full bg-[#fef08a] border-2 border-[#2d3748] flex items-center justify-center text-[10px] font-black">
                S
              </div>
              <div className="w-7 h-7 rounded-full bg-[#add8e6] border-2 border-[#2d3748] flex items-center justify-center text-[10px] font-black">
                H
              </div>
              <div className="w-7 h-7 rounded-full bg-[#22c55e] border-2 border-[#2d3748] flex items-center justify-center text-[10px] font-black">
                D
              </div>
            </div>
            <p className="text-xs font-bold text-slate-700 truncate">
              Sơn, Huy và 2 người khác
            </p>
          </div>
        </div>

        {/* Khung Tiểu sử / Ghi chú cá nhân */}
        <div className="p-3.5 bg-white rounded-xs border-2 border-[#2d3748] shadow-uupm-active space-y-1.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
            Tiểu sử & Ghi chú
          </span>
          <p className="text-xs font-semibold text-[#0f172a] leading-relaxed bg-[#f8fafc] p-2.5 rounded-xs border border-slate-200 italic">
            &ldquo;{bioText}&rdquo;
          </p>
        </div>

        {/* Khung Hoạt động gần đây */}
        <div className="p-3.5 bg-white rounded-xs border-2 border-[#2d3748] shadow-uupm-active">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1.5">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span>Trạng thái hoạt động</span>
          </span>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0f172a]">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>Sẵn sàng trò chuyện trực tiếp</span>
          </div>
        </div>
      </div>

      {/* 4. Nút Hành Động Ở Chân Panel */}
      <div className="p-4 border-t-2 border-[#2d3748] bg-white mt-auto">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() =>
            toast.info(
              `Tính năng xem trang cá nhân đầy đủ của ${displayName} đang được phát triển.`,
              "Hồ sơ người dùng"
            )
          }
          className="w-full justify-center text-xs font-black uppercase tracking-wide"
          rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
        >
          Xem Hồ Sơ Đầy Đủ
        </Button>
      </div>
    </div>
  );
};
