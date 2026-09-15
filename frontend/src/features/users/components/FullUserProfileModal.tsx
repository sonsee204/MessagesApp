import React, { useState, useEffect, useRef } from "react";
import {
  X,
  User as UserIcon,
  ShieldCheck,
} from "lucide-react";
import { User } from "../../../types/auth.types";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
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
 * Khối hero (banner + avatar + tên + username + badge) ở cột trái modal hồ sơ.
 * Tách thành child component để chuyển các nhánh điều kiện banner/avatar/role ra khỏi
 * hàm FullUserProfileModal (rule no-high-complexity-react-function).
 */
function ProfileHero({
  user,
  displayName,
  usernameHandle,
  isOnline,
}: {
  user: User;
  displayName: string;
  usernameHandle: string;
  isOnline: boolean;
}) {
  return (
    <>
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

      {/* Avatar đè lên Banner kèm chấm trạng thái kết nối */}
      <div className="-mt-14 px-5 relative z-10 flex items-end justify-between shrink-0">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full bg-uupm-surface border-[3px] border-uupm-line shadow-uupm-2 flex items-center justify-center overflow-hidden font-black text-3xl text-uupm-accent-text">
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

      {/* Nhãn Tên & Username */}
      <div className="px-5 pt-3 pb-1 shrink-0">
        <h2 className="text-xl font-black text-uupm-ink tracking-tight truncate">
          {displayName}
        </h2>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs font-bold text-uupm-ink-muted truncate">
            {usernameHandle}
          </span>
          <span
            className="w-4 h-4 rounded-full bg-uupm-accent text-uupm-accent-text text-[10px] font-black flex items-center justify-center border border-uupm-line shrink-0"
            title="Định danh người dùng"
          >
            #
          </span>

          {user.role === "ADMIN" && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-[2px] rounded-xs bg-uupm-warn-soft border border-uupm-line text-[9px] font-black text-uupm-warn-soft-ink">
              <ShieldCheck className="w-2.5 h-2.5" />
              <span>Admin</span>
            </span>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Khối thông tin chi tiết (Gia nhập, Dòng trạng thái, Ghi chú cá nhân).
 * Tách thành child component để chuyển nhánh isEditingNote ternary ra khỏi
 * hàm FullUserProfileModal (rule no-high-complexity-react-function).
 */
function ProfileInfoBlock({
  formattedJoinedDate,
  statusMessage,
  personalNote,
  isEditingNote,
  onNoteChange,
  onStartEditNote,
  onFinishEditNote,
}: {
  formattedJoinedDate: string;
  statusMessage?: string;
  personalNote: string;
  isEditingNote: boolean;
  onNoteChange: (v: string) => void;
  onStartEditNote: () => void;
  onFinishEditNote: () => void;
}) {
  return (
    <div className="px-5 py-3 border-t-2 border-uupm-line/20 space-y-3 mt-1 text-xs">
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-uupm-ink-muted block mb-0.5">
          Gia Nhập Từ
        </span>
        <p className="font-bold text-uupm-ink">{formattedJoinedDate}</p>
      </div>

      {statusMessage && (
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-uupm-ink-muted block mb-0.5">
            Dòng trạng thái
          </span>
          <p className="p-2 rounded-xs bg-uupm-surface border border-uupm-line/30 italic font-semibold text-uupm-ink-soft">
            &ldquo;{statusMessage}&rdquo;
          </p>
        </div>
      )}

      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-uupm-ink-muted block mb-0.5">
          Ghi chú (chỉ hiển thị cho bạn)
        </span>
        {isEditingNote ? (
          <input
            type="text"
            value={personalNote}
            onChange={(e) => onNoteChange(e.target.value)}
            onBlur={onFinishEditNote}
            onKeyDown={(e) => e.key === "Enter" && onFinishEditNote()}
            placeholder="Nhập ghi chú cho người này..."
            aria-label="Ghi chú cá nhân cho người dùng này"
            autoFocus
            className="w-full px-2 py-1 bg-uupm-surface border border-uupm-line rounded-xs text-xs font-semibold text-uupm-ink outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={onStartEditNote}
            // Thay style all:"unset" (đè sạch class) bằng class rõ ràng: giữ
            // w-full/truncate/block/text-left + focus-visible, thêm appearance-none
            // để trông như chữ mà vẫn nhận vòng focus bàn phím.
            className="italic text-xs font-semibold text-uupm-ink-muted hover:text-uupm-ink cursor-pointer truncate block w-full text-left appearance-none bg-transparent border-0 p-0 text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uupm-accent"
            title="Nhấp để sửa ghi chú"
          >
            {personalNote || "Nhấp để thêm ghi chú"}
          </button>
        )}
      </div>
    </div>
  );
}

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

  const dialogRef = useRef<HTMLDialogElement>(null);
  // native <dialog>.showModal() đã trap focus + Escape đóng (rule prefer-html-dialog)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const displayName = user.displayName || user.username;
  const usernameHandle = `@${user.username}`;

  // Đóng modal hồ sơ và ĐÓNG LUÔN các dialog con đang mở.
  // Dialog con là top-layer riêng nên đóng cha KHÔNG tự đóng con ⇒ phải reset
  // state của con tại đây, nếu không chúng sẽ mồ côi trên màn hình.
  const handleClose = () => {
    setIsUnfriendConfirmOpen(false);
    setIsSelfSettingsOpen(false);
    onClose();
  };

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
    // Pattern A: fixed inset-0 phủ viewport (không dùng w-screen/h-screen).
    // onClose={handleClose} đóng cả dialog con đang mở để không bị mồ côi.
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      aria-label={`Hồ sơ chi tiết của ${displayName}`}
      // fixed inset-0 + h-full w-full để THẮNG `width/height: fit-content` mặc định
      // của UA trên dialog:modal — nếu không dialog co lại bằng nội dung, dính góc
      // trên-trái và "đè lên main" mà không phủ toàn màn hình (bug trong ảnh).
      className="fixed inset-0 m-0 h-full w-full max-h-none max-w-none p-4 flex items-center justify-center bg-transparent backdrop:bg-black/60 backdrop:backdrop-blur-sm select-none"
    >
      {/* Backdrop: nút trong suốt phủ vùng padding — click ra ngoài khung => đóng.
          tabIndex={-1} để nút không lọt vào thứ tự tab. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Đóng hồ sơ"
        className="absolute inset-0 w-full h-full cursor-default bg-transparent border-0 p-0 m-0"
        onClick={handleClose}
      />
      {/* Khung chính Modal 2 cột: chỉ giữ hướng cuộn dọc trên mobile,
          desktop cuộn tự do (bỏ overflow-hidden gây xung đột với overflow-y). */}
      <div className="relative z-10 w-full max-w-4xl bg-uupm-surface border-[3px] border-uupm-line rounded-sm shadow-uupm-2 flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-150 max-h-[92dvh] overflow-y-auto md:overflow-visible">
        {/* Nút đóng góc trên bên phải */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
          title="Đóng hồ sơ"
          aria-label="Đóng cửa sổ hồ sơ"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ================= CỘT TRÁI: THẺ ĐỊNH DANH HỒ SƠ (Rộng ~380px) ================= */}
        <div className="w-full md:w-[380px] bg-uupm-page border-b-2 md:border-b-0 md:border-r-2 border-uupm-line flex flex-col shrink-0">
          {/* Khối hero (Banner + Avatar + Tên) — tách sang ProfileHero */}
          <ProfileHero
            user={user}
            displayName={displayName}
            usernameHandle={usernameHandle}
            isOnline={isOnline}
          />

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

          {/* Khối thông tin chi tiết — tách sang ProfileInfoBlock */}
          <ProfileInfoBlock
            formattedJoinedDate={formattedJoinedDate}
            statusMessage={user.statusMessage || undefined}
            personalNote={personalNote}
            isEditingNote={isEditingNote}
            onNoteChange={setPersonalNote}
            onStartEditNote={() => setIsEditingNote(true)}
            onFinishEditNote={() => setIsEditingNote(false)}
          />
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
            onClose={handleClose}
          />
        </div>
      </div>

      {/* Modal xác nhận Hủy kết bạn (dùng ConfirmDialog chung để triệt tiêu duplicate JSX) */}
      <ConfirmDialog
        isOpen={isUnfriendConfirmOpen}
        title="Hủy kết bạn"
        description={`Bạn có chắc chắn muốn hủy kết bạn với ${displayName} (${usernameHandle}) không?`}
        confirmLabel="Xác nhận hủy"
        isLoading={isSubmitting}
        onConfirm={handleConfirmRemoveFriend}
        onCancel={() => setIsUnfriendConfirmOpen(false)}
      />

      {/* Popup Cài đặt mở chồng lên khi bấm "Chỉnh sửa hồ sơ" trên chính hồ sơ của mình */}
      {isMe && currentUser && (
        <UserSettingsModal
          isOpen={isSelfSettingsOpen}
          onClose={() => setIsSelfSettingsOpen(false)}
          currentUser={currentUser}
        />
      )}
    </dialog>
  );
};
