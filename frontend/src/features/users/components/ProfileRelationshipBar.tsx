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
      <>
        {/* Trạng thái lỗi: chỉ hiện Thử lại, không hiển thị nút hành động */}
        {statusError && !isLoadingStatus ? (
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
        ) : (
          <>
            {/* Nút quan hệ bạn bè đa trạng thái */}
            {relationshipStatus === "NONE" && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onSendFriendRequest}
                disabled={isLoadingStatus || isSubmitting}
                className="flex-1 min-w-0 justify-center text-xs font-black"
                leftIcon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <UserPlus className="w-3.5 h-3.5 shrink-0" />}
              >
                <span className="truncate">Thêm Bạn</span>
              </Button>
            )}

            {relationshipStatus === "PENDING_SENT" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSubmitting}
                title="Nhấp để hủy lời mời kết bạn đã gửi"
                className="flex-1 min-w-0 justify-center text-xs font-black hover:text-uupm-danger hover:border-uupm-danger transition-colors cursor-pointer"
                leftIcon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
              >
                <span className="truncate">Hủy lời mời</span>
              </Button>
            )}

            {relationshipStatus === "PENDING_RECEIVED" && (
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
            )}

            {relationshipStatus === "FRIENDS" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsUnfriendConfirmOpen(true)}
                className="flex-1 min-w-0 justify-center text-xs font-black bg-uupm-accent-soft text-uupm-accent-text hover:bg-uupm-danger/10 hover:text-uupm-danger-text hover:border-uupm-danger transition-colors cursor-pointer"
                title="Nhấp để mở xác nhận hủy kết bạn"
                leftIcon={<UserCheck className="w-3.5 h-3.5 shrink-0" />}
              >
                <span className="truncate">Bạn bè</span>
              </Button>
            )}

            {/* Đang bị đối phương chặn: nhãn không bấm được */}
            {relationshipStatus === "BLOCKED" && !blockedByMe && (
              <span
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xs border-2 border-uupm-line bg-uupm-page text-xs font-black text-uupm-ink-muted cursor-not-allowed select-none"
                title="Người dùng này đã chặn bạn. Bạn không thể bỏ chặn từ phía mình."
                aria-disabled="true"
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Bạn đã bị chặn</span>
              </span>
            )}

            {relationshipStatus === "BLOCKED" && blockedByMe && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={onToggleBlock}
                disabled={isSubmitting}
                className="flex-1 min-w-0 justify-center text-xs font-black"
                leftIcon={<ShieldAlert className="w-3.5 h-3.5 shrink-0" />}
              >
                <span className="truncate">Đã chặn</span>
              </Button>
            )}

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

              {/* Dropdown danh sách tùy chọn phụ */}
              {isMenuOpen && (
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
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsUnfriendConfirmOpen(true);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs font-bold text-uupm-danger-text hover:bg-uupm-danger/10 flex items-center gap-2 cursor-pointer border-t border-uupm-line/20"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>Hủy kết bạn</span>
                    </button>
                  )}

                  {/* Chỉ cho phép bỏ chặn khi CHÍNH MÌNH là bên đã chặn */}
                  <button
                    type="button"
                    onClick={relationshipStatus === "BLOCKED" && !blockedByMe ? undefined : onToggleBlock}
                    disabled={relationshipStatus === "BLOCKED" && !blockedByMe}
                    aria-disabled={relationshipStatus === "BLOCKED" && !blockedByMe}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-xs font-bold flex items-center gap-2 border-t border-uupm-line/20",
                      relationshipStatus === "BLOCKED" && !blockedByMe
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
              )}
            </div>
          </>
        )}
      </>
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
