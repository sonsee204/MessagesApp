import React, { useState, useEffect } from "react";
import {
  X,
  User as UserIcon,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { User } from "../../../types/auth.types";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../stores/toast.store";
import { useAuthStore } from "../../../stores/auth.store";
import { useChatStore } from "../../chat/stores/chat.store";
import { cn } from "../../../lib/utils";
import { UserSettingsModal } from "./UserSettingsModal";
import { ProfileTabs } from "./ProfileTabs";
import { ProfileRelationshipBar } from "./ProfileRelationshipBar";
import { useProfileRelationship } from "../hooks/useProfileRelationship";

// Formatter ngày tham gia (tiếng Việt) — tạo 1 lần ở module scope (rule js-hoist-intl).
const JOINED_DATE_FMT = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface FullUserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  isOnline?: boolean;
}

type ProfileTab = "activity" | "mutual_friends" | "mutual_servers";

/**
 * Modal hiển thị hồ sơ người dùng đầy đủ (Full User Profile Modal)
 * Thiết kế chuẩn 2 cột theo phong cách Discord kết hợp Tactile Neo-Brutalist:
 * - Cột trái (42%): Thẻ Profile Hero với Banner, Avatar lớn đè mép, Tên, Trạng thái, Nút kết bạn/chat, Thông tin ngày gia nhập
 * - Cột phải (58%): Phân mục Tabs: Hoạt động & Giới thiệu, Bạn chung, Hội thoại & Nhóm chung
 * - Hỗ trợ đầy đủ tương tác phím Esc, click backdrop để đóng, và thao tác kết bạn 2 chiều
 */
export const FullUserProfileModal: React.FC<FullUserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  isOnline = false,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const conversations = useChatStore((state) => state.conversations);
  const selectConversation = useChatStore((state) => state.selectConversation);

  const isMe = currentUser?.id === user?.id;

  // Toàn bộ logic nghiệp vụ quan hệ bạn bè đã được tách sang hook useProfileRelationship
  const {
    relationshipStatus,
    blockedByMe,
    isLoadingStatus,
    statusError,
    setStatusReloadKey,
    isSubmitting,
    handleSendFriendRequest,
    handleAcceptFriendRequest,
    handleRejectFriendRequest,
    handleConfirmRemoveFriend,
    handleCancelFriendRequest,
    handleToggleBlock,
  } = useProfileRelationship({ isOpen, isMe, userId: user?.id });

  // Trạng thái tab đang chọn bên cột phải
  const [activeTab, setActiveTab] = useState<ProfileTab>("activity");
  // Menu mở rộng hành động (More actions)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  // Trạng thái mở modal xác nhận hủy kết bạn
  const [isUnfriendConfirmOpen, setIsUnfriendConfirmOpen] = useState<boolean>(false);
  // Ghi chú cá nhân cục bộ
  const [personalNote, setPersonalNote] = useState<string>("");
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);
  // Popup Cài đặt người dùng mở từ nút "Chỉnh sửa hồ sơ" khi xem chính mình (giống Discord)
  const [isSelfSettingsOpen, setIsSelfSettingsOpen] = useState<boolean>(false);

  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const displayName = user.displayName || user.username;
  const usernameHandle = `@${user.username}`;

  // Định dạng ngày tham gia tiếng Việt
  const formattedJoinedDate = user.createdAt
    ? JOINED_DATE_FMT.format(new Date(user.createdAt))
    : "Chưa xác định";

  // Lọc các cuộc hội thoại chung giữa người dùng hiện tại và người này
  const mutualConversations = conversations.filter((c) =>
    c.participants.some((p) => p.id === user.id)
  );

  // Xử lý chuyển nhanh đến cuộc hội thoại với người này
  const handleStartChat = () => {
    if (mutualConversations.length > 0) {
      void selectConversation(mutualConversations[0].id);
      onClose();
      toast.success(`Đã mở cuộc trò chuyện với ${displayName}`, "Trò chuyện");
    } else {
      toast.info(
        `Hãy bắt đầu gửi tin nhắn đầu tiên cho ${displayName} qua danh bạ`,
        "Cuộc trò chuyện mới"
      );
      onClose();
    }
  };

  // Sao chép ID người dùng vào clipboard
  const handleCopyId = () => {
    if (user.id) {
      void navigator.clipboard.writeText(user.id);
      toast.success("Đã sao chép ID người dùng vào bộ nhớ tạm", "Sao chép thành công");
      setIsMenuOpen(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Hồ sơ chi tiết của ${displayName}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Khung chính Modal 2 cột theo phong cách Discord được phóng to rộng rãi */}
      <div className="w-full max-w-4xl bg-uupm-surface border-3 border-uupm-line rounded-sm shadow-uupm-2 overflow-hidden flex flex-col md:flex-row relative animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto md:overflow-y-visible">
        {/* Nút đóng góc trên bên phải */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
          title="Đóng hồ sơ"
          aria-label="Đóng cửa sổ hồ sơ"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ================= CỘT TRÁI: THẺ ĐỊNH DANH HỒ SƠ (Rộng ~380px) ================= */}
        <div className="w-full md:w-[380px] bg-uupm-page border-b-2 md:border-b-0 md:border-r-2 border-uupm-line flex flex-col shrink-0">
          {/* Ảnh bìa (Banner) phóng to tỉ lệ chuẩn */}
          <div className="relative h-36 md:h-44 bg-uupm-accent-soft border-b-2 border-uupm-line overflow-hidden shrink-0">
            {user.bannerUrl ? (
              <img
                src={user.bannerUrl}
                alt={`Ảnh bìa của ${displayName}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-uupm-accent via-uupm-accent-soft to-uupm-warn-soft">
                {/* Lưới chấm Neo-Brutalist trang trí */}
                <div className="w-full h-full opacity-15 bg-[radial-gradient(hsl(var(--uupm-ink))_1px,transparent_1px)] [background-size:8px_8px]" />
              </div>
            )}
          </div>

          {/* Avatar đè lên Banner kèm chấm trạng thái kết nối (shrink-0: giữ nguyên chiều cao,
              chống cột flex co nén avatar gây đè chữ tên người dùng) */}
          <div className="-mt-14 px-5 relative z-10 flex items-end justify-between shrink-0">
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-full bg-uupm-surface border-3 border-uupm-line shadow-uupm-2 flex items-center justify-center overflow-hidden font-black text-3xl text-uupm-accent-text">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-12 h-12 text-uupm-ink" />
                )}
              </div>
              {/* Chấm tròn trạng thái Online lớn kiểu Discord */}
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full border-2 border-uupm-line shadow-sm",
                  isOnline ? "bg-uupm-accent" : "bg-uupm-ink-muted"
                )}
                title={isOnline ? "Đang trực tuyến" : "Ngoại tuyến"}
              />
            </div>
          </div>

          {/* Nhãn Tên & Username (shrink-0 chống co nén dưới avatar khi khung modal chật) */}
          <div className="px-5 pt-3 pb-1 shrink-0">
            <h2 className="text-xl font-black text-uupm-ink tracking-tight truncate">
              {displayName}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs font-bold text-uupm-ink-muted truncate">
                {usernameHandle}
              </span>
              {/* Huy hiệu dấu # định danh Discord */}
              <span
                className="w-4 h-4 rounded-full bg-uupm-accent text-uupm-accent-text text-[10px] font-black flex items-center justify-center border border-uupm-line shrink-0"
                title="Định danh người dùng"
              >
                #
              </span>

              {user.role === "ADMIN" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-xs bg-uupm-warn-soft border border-uupm-line text-[9px] font-black text-uupm-warn-soft-ink">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>Admin</span>
                </span>
              )}
            </div>
          </div>

          {/* Dải nút hành động chính (Thêm bạn, Nhắn tin, Menu) */}
          <ProfileRelationshipBar
            isMe={isMe}
            relationshipStatus={relationshipStatus}
            statusError={statusError}
            isLoadingStatus={isLoadingStatus}
            isSubmitting={isSubmitting}
            blockedByMe={blockedByMe}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            setStatusReloadKey={setStatusReloadKey}
            setIsUnfriendConfirmOpen={setIsUnfriendConfirmOpen}
            onSendFriendRequest={handleSendFriendRequest}
            onAccept={handleAcceptFriendRequest}
            onReject={handleRejectFriendRequest}
            onCancel={handleCancelFriendRequest}
            onStartChat={handleStartChat}
            onToggleBlock={handleToggleBlock}
            onCopyId={handleCopyId}
            onClickEditProfile={() => setIsSelfSettingsOpen(true)}
          />

          {/* Khối thông tin chi tiết cố định (Gia nhập, Dòng trạng thái, Ghi chú) */}
          <div className="px-5 py-3 border-t-2 border-uupm-line/20 space-y-3 mt-1 text-xs">
            {/* Mốc thời gian gia nhập */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-uupm-ink-muted block mb-0.5">
                Gia Nhập Từ
              </span>
              <p className="font-bold text-uupm-ink">{formattedJoinedDate}</p>
            </div>

            {/* Dòng trạng thái thực tế */}
            {user.statusMessage && (
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-uupm-ink-muted block mb-0.5">
                  Dòng trạng thái
                </span>
                <p className="p-2 rounded-xs bg-uupm-surface border border-uupm-line/30 italic font-semibold text-uupm-ink-soft">
                  &ldquo;{user.statusMessage}&rdquo;
                </p>
              </div>
            )}

            {/* Khung ghi chú cá nhân (chỉ hiển thị cho bạn - giống hệt Discord) */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-uupm-ink-muted block mb-0.5">
                Ghi chú (chỉ hiển thị cho bạn)
              </span>
              {isEditingNote ? (
                <input
                  type="text"
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  onBlur={() => setIsEditingNote(false)}
                  onKeyDown={(e) => e.key === "Enter" && setIsEditingNote(false)}
                  placeholder="Nhập ghi chú cho người này..."
                  aria-label="Ghi chú cá nhân cho người dùng này"
                  autoFocus
                  className="w-full px-2 py-1 bg-uupm-surface border border-uupm-line rounded-xs text-xs font-semibold text-uupm-ink outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingNote(true)}
                  style={{ all: "unset" }}
                  className="italic text-xs font-semibold text-uupm-ink-muted hover:text-uupm-ink cursor-pointer truncate block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uupm-accent"
                  title="Nhấp để sửa ghi chú"
                >
                  {personalNote || "Nhấp để thêm ghi chú"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ================= CỘT PHẢI: PHÂN MỤC TABS NỘI DUNG (~60%) ================= */}
        <div className="flex-1 bg-uupm-surface p-6 flex flex-col min-h-[440px] md:min-h-[480px]">
          <ProfileTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            user={user}
            isOnline={isOnline}
            relationshipStatus={relationshipStatus}
            mutualConversations={mutualConversations}
            onSelectConversation={(id) => void selectConversation(id)}
            onClose={onClose}
          />
        </div>
      </div>

      {/* Modal xác nhận Hủy kết bạn */}
      {isUnfriendConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận hủy kết bạn"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none"
        >
          <div className="w-full max-w-sm bg-uupm-surface border-3 border-uupm-line rounded-xs shadow-uupm-2 p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-uupm-danger-text mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-black text-base text-uupm-ink">Hủy kết bạn</h3>
            </div>
            <p className="text-xs text-uupm-ink-soft font-medium leading-relaxed mb-5">
              Bạn có chắc chắn muốn hủy kết bạn với <strong className="text-uupm-ink font-black">{displayName}</strong> ({usernameHandle}) không?
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsUnfriendConfirmOpen(false)}
                disabled={isSubmitting}
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleConfirmRemoveFriend}
                disabled={isSubmitting}
                leftIcon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
              >
                Xác nhận hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Cài đặt mở chồng lên khi bấm "Chỉnh sửa hồ sơ" trên chính hồ sơ của mình */}
      {isMe && currentUser && (
        <UserSettingsModal
          isOpen={isSelfSettingsOpen}
          onClose={() => setIsSelfSettingsOpen(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
