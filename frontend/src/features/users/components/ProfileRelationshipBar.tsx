import React from "react";
import {
  UserPlus,
  UserCheck,
  UserMinus,
  Check,
  X,
  MessageSquare,
  MoreHorizontal,
  ShieldAlert,
  Copy,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { RelationshipStatus } from "../services/friend.service";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";

interface ProfileRelationshipBarProps {
  isMe: boolean;
  relationshipStatus: RelationshipStatus;
  statusError: string | null;
  isLoadingStatus: boolean;
  isSubmitting: boolean;
  blockedByMe: boolean;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  setStatusReloadKey: React.Dispatch<React.SetStateAction<number>>;
  setIsUnfriendConfirmOpen: (open: boolean) => void;
  onSendFriendRequest: () => void;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  onStartChat: () => void;
  onToggleBlock: () => void;
  onCopyId: () => void;
  onClickEditProfile: () => void;
}

/**
 * Dropdown menu tùy chọn phụ (Sao chép ID / Hủy kết bạn / Chặn-Bỏ chặn).
 * Tách thành child component để giảm nhánh render trong ProfileRelationshipBar
 * (rule no-high-complexity-react-function).
 */
function ProfileDropdownMenu({
  relationshipStatus,
  blockedByMe,
  onCopyId,
  onUnfriend,
  onToggleBlock,
}: {
  relationshipStatus: RelationshipStatus;
  blockedByMe: boolean;
  onCopyId: () => void;
  onUnfriend: () => void;
  onToggleBlock: () => void;
}) {
  const isBlockedByOther = relationshipStatus === "BLOCKED" && !blockedByMe;

  return (
    <div className="absolute left-0 bottom-full mb-1.5 w-44 bg-uupm-surface border-2 border-uupm-line rounded-xs shadow-uupm-2 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
      <button
        type="button"
        onClick={onCopyId}
        className="w-full px-3 py-1.5 text-left text-xs font-bold text-uupm-ink hover:bg-uupm-surface-hover flex items-center gap-2 cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5 text-uupm-ink-muted" />
        <span>Sao chép ID</span>
      </button>

      {relationshipStatus === "FRIENDS" && (
        <button
          type="button"
          onClick={onUnfriend}
          className="w-full px-3 py-1.5 text-left text-xs font-bold text-uupm-danger-text hover:bg-uupm-danger/10 flex items-center gap-2 cursor-pointer border-t border-uupm-line/20"
        >
          <UserMinus className="w-3.5 h-3.5" />
          <span>Hủy kết bạn</span>
        </button>
      )}

      {/* Chỉ cho phép bỏ chặn khi CHÍNH MÌNH là bên đã chặn */}
      <button
        type="button"
        onClick={isBlockedByOther ? undefined : onToggleBlock}
        disabled={isBlockedByOther}
        aria-disabled={isBlockedByOther}
        className={cn(
          "w-full px-3 py-1.5 text-left text-xs font-bold flex items-center gap-2 border-t border-uupm-line/20",
          isBlockedByOther
            ? "text-uupm-ink-muted cursor-not-allowed opacity-60"
            : "text-uupm-danger-text hover:bg-uupm-danger/10 cursor-pointer"
        )}
      >
        <ShieldAlert className="w-3.5 h-3.5" />
        <span>
          {relationshipStatus === "BLOCKED"
            ? blockedByMe
              ? "Bỏ chặn"
              : "Bạn đã bị chặn"
            : "Chặn người dùng"}
        </span>
      </button>
    </div>
  );
}

/**
 * Sinh cấu hình nút hành động chính theo trạng thái quan hệ (trừ PENDING_RECEIVED xử lý riêng).
 * Pure helper module-scope: gom các nhánh status vào một lookup duy nhất để
 * RelationshipPrimaryAction chỉ render đúng 1 Button (rule no-high-complexity-react-function).
 */
function resolveRelationshipButtonConfig(
  status: RelationshipStatus,
  blockedByMe: boolean,
  isSubmitting: boolean,
  isLoadingStatus: boolean
): {
  variant: "primary" | "outline" | "danger";
  action: "send" | "cancel" | "unfriend" | "block";
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  title: string;
  className: string;
} | null {
  switch (status) {
    case "NONE":
      return {
        variant: "primary",
        action: "send",
        label: "Thêm Bạn",
        icon: isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <UserPlus className="w-3.5 h-3.5 shrink-0" />,
        disabled: isLoadingStatus || isSubmitting,
        title: "Nhấp để gửi lời mời kết bạn",
        className: "flex-1 min-w-0 justify-center text-xs font-black",
      };
    case "PENDING_SENT":
      return {
        variant: "outline",
        action: "cancel",
        label: "Hủy lời mời",
        icon: isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />,
        disabled: isSubmitting,
        title: "Nhấp để hủy lời mời kết bạn đã gửi",
        className: "flex-1 min-w-0 justify-center text-xs font-black hover:text-uupm-danger hover:border-uupm-danger transition-colors cursor-pointer",
      };
    case "FRIENDS":
      return {
        variant: "outline",
        action: "unfriend",
        label: "Bạn bè",
        icon: <UserCheck className="w-3.5 h-3.5 shrink-0" />,
        disabled: false,
        title: "Nhấp để mở xác nhận hủy kết bạn",
        className: "flex-1 min-w-0 justify-center text-xs font-black bg-uupm-accent-soft text-uupm-accent-text hover:bg-uupm-danger/10 hover:text-uupm-danger-text hover:border-uupm-danger transition-colors cursor-pointer",
      };
    case "BLOCKED":
      if (blockedByMe) {
        return {
          variant: "danger",
          action: "block",
          label: "Đã chặn",
          icon: <ShieldAlert className="w-3.5 h-3.5 shrink-0" />,
          disabled: isSubmitting,
          title: "Nhấp để bỏ chặn người dùng",
          className: "flex-1 min-w-0 justify-center text-xs font-black",
        };
      }
      return null;
    default:
      return null;
  }
}

/**
 * Nút hành động quan hệ chính theo trạng thái (Thêm Bạn / Hủy lời mời / Bạn bè / Đã chặn).
 * Dùng tra cứu cấu hình theo relationshipStatus để gom 5-6 nhánh JSX rời rạc
 * thành duy nhất một phần tử render (rule no-high-complexity-react-function).
 */
function RelationshipPrimaryAction({
  relationshipStatus,
  isSubmitting,
  isLoadingStatus,
  blockedByMe,
  onAccept,
  onReject,
  onSendFriendRequest,
  onCancel,
  onUnfriendClick,
  onToggleBlock,
}: {
  relationshipStatus: RelationshipStatus;
  isSubmitting: boolean;
  isLoadingStatus: boolean;
  blockedByMe: boolean;
  onAccept: () => void;
  onReject: () => void;
  onSendFriendRequest: () => void;
  onCancel: () => void;
  onUnfriendClick: () => void;
  onToggleBlock: () => void;
}) {
  // Cặp nút Đồng ý / Từ chối cho trạng thái PENDING_RECEIVED
  if (relationshipStatus === "PENDING_RECEIVED") {
    return (
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onAccept}
          disabled={isSubmitting}
          className="flex-1 min-w-0 justify-center text-xs font-black px-2.5"
          leftIcon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Check className="w-3.5 h-3.5 shrink-0" />}
        >
          <span className="truncate">Đồng ý</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReject}
          disabled={isSubmitting}
          className="flex-1 min-w-0 justify-center text-xs font-black hover:text-uupm-danger hover:border-uupm-danger cursor-pointer px-2.5"
          leftIcon={<X className="w-3.5 h-3.5 shrink-0" />}
        >
          <span className="truncate">Từ chối</span>
        </Button>
      </div>
    );
  }

  // Bị đối phương chặn: nhãn_disabled
  if (relationshipStatus === "BLOCKED" && !blockedByMe) {
    return (
      <span
        className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xs border-2 border-uupm-line bg-uupm-page text-xs font-black text-uupm-ink-muted cursor-not-allowed select-none"
        title="Người dùng này đã chặn bạn. Bạn không thể bỏ chặn từ phía mình."
        aria-disabled="true"
      >
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">Bạn đã bị chặn</span>
      </span>
    );
  }

  // Tra cứu cấu hình cho các trạng thái còn lại (NONE / PENDING_SENT / FRIENDS / BLOCKED+bởi mình)
  const config = resolveRelationshipButtonConfig(
    relationshipStatus,
    blockedByMe,
    isSubmitting,
    isLoadingStatus
  );
  const handlers: Record<string, () => void> = {
    send: onSendFriendRequest,
    cancel: onCancel,
    unfriend: onUnfriendClick,
    block: onToggleBlock,
  };

  if (!config) return null;

  return (
    <Button
      type="button"
      variant={config.variant}
      size="sm"
      onClick={handlers[config.action]}
      disabled={config.disabled}
      title={config.title}
      className={config.className}
      leftIcon={config.icon}
    >
      <span className="truncate">{config.label}</span>
    </Button>
  );
}

/**
 * Các nút hành động quan hệ bạn bè (chỉ khi không phải chính mình).
 * Tách thành child component để chuyển toàn bộ nhánh relationshipStatus
 * ra khỏi ProfileRelationshipBar (rule no-high-complexity-react-function).
 */
function ProfileRelationshipActions({
  relationshipStatus,
  statusError,
  isLoadingStatus,
  isSubmitting,
  blockedByMe,
  isMenuOpen,
  setIsMenuOpen,
  setStatusReloadKey,
  setIsUnfriendConfirmOpen,
  onSendFriendRequest,
  onAccept,
  onReject,
  onCancel,
  onStartChat,
  onToggleBlock,
  onCopyId,
}: Omit<ProfileRelationshipBarProps, "isMe" | "onClickEditProfile">) {
  // Trạng thái lỗi: chỉ hiện Thử lại
  if (statusError && !isLoadingStatus) {
    return (
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span
          className="flex-1 text-[11px] font-bold text-uupm-danger-text truncate"
          title={statusError}
        >
          Không tải được trạng thái quan hệ
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setStatusReloadKey((k) => k + 1)}
          className="shrink-0 justify-center text-xs font-black"
          leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Nút quan hệ bạn bè đa trạng thái — tách sang RelationshipPrimaryAction */}
      <RelationshipPrimaryAction
        relationshipStatus={relationshipStatus}
        isSubmitting={isSubmitting}
        isLoadingStatus={isLoadingStatus}
        blockedByMe={blockedByMe}
        onAccept={onAccept}
        onReject={onReject}
        onSendFriendRequest={onSendFriendRequest}
        onCancel={onCancel}
        onUnfriendClick={() => setIsUnfriendConfirmOpen(true)}
        onToggleBlock={onToggleBlock}
      />

      {/* Nút nhắn tin trực tiếp */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onStartChat}
        className="px-3 shrink-0"
        title="Nhắn tin"
        aria-label="Gửi tin nhắn"
      >
        <MessageSquare className="w-4 h-4" />
      </Button>

      {/* Nút menu tùy chọn mở rộng */}
      <div className="relative shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="px-2.5 shrink-0"
          title="Tùy chọn khác"
          aria-label="Mở tùy chọn"
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>

        {/* Dropdown danh sách tùy chọn phụ — tách sang ProfileDropdownMenu */}
        {isMenuOpen && (
          <ProfileDropdownMenu
            relationshipStatus={relationshipStatus}
            blockedByMe={blockedByMe}
            onCopyId={onCopyId}
            onUnfriend={() => {
              setIsMenuOpen(false);
              setIsUnfriendConfirmOpen(true);
            }}
            onToggleBlock={onToggleBlock}
          />
        )}
      </div>
    </>
  );
}

/**
 * Dải nút hành động chính trong FullUserProfileModal (Thêm bạn / Bạn bè / Nhắn tin / Menu).
 * Tách khỏi modal cha để giảm độ phức tạp hàm (rule no-high-complexity-react-function).
 */
export const ProfileRelationshipBar: React.FC<ProfileRelationshipBarProps> = ({
  isMe,
  relationshipStatus,
  statusError,
  isLoadingStatus,
  isSubmitting,
  blockedByMe,
  isMenuOpen,
  setIsMenuOpen,
  setStatusReloadKey,
  setIsUnfriendConfirmOpen,
  onSendFriendRequest,
  onAccept,
  onReject,
  onCancel,
  onStartChat,
  onToggleBlock,
  onCopyId,
  onClickEditProfile,
}) => (
  <div className="px-5 py-3 flex items-center gap-2 flex-wrap sm:flex-nowrap">
    {!isMe ? (
      <ProfileRelationshipActions
        relationshipStatus={relationshipStatus}
        statusError={statusError}
        isLoadingStatus={isLoadingStatus}
        isSubmitting={isSubmitting}
        blockedByMe={blockedByMe}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        setStatusReloadKey={setStatusReloadKey}
        setIsUnfriendConfirmOpen={setIsUnfriendConfirmOpen}
        onSendFriendRequest={onSendFriendRequest}
        onAccept={onAccept}
        onReject={onReject}
        onCancel={onCancel}
        onStartChat={onStartChat}
        onToggleBlock={onToggleBlock}
        onCopyId={onCopyId}
      />
    ) : (
      <div className="w-full">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClickEditProfile}
          className="w-full justify-center text-xs font-black"
        >
          Chỉnh sửa hồ sơ
        </Button>
      </div>
    )}
  </div>
);
