import React, { useState, useEffect } from "react";
import {
  X,
  User as UserIcon,
  MessageSquare,
  UserPlus,
  UserCheck,
  UserMinus,
  Check,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Users,
  Sparkles,
  MessageCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { User } from "../../../types/auth.types";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../stores/toast.store";
import { useAuthStore } from "../../../stores/auth.store";
import { useChatStore } from "../../chat/stores/chat.store";
import { friendService, RelationshipStatus } from "../services/friend.service";
import { cn } from "../../../lib/utils";

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

  // Trạng thái tab đang chọn bên cột phải
  const [activeTab, setActiveTab] = useState<ProfileTab>("activity");
  // Trạng thái quan hệ bạn bè 2 chiều với người dùng này
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>("NONE");
  const [pendingRequestId, setPendingRequestId] = useState<string | undefined>(undefined);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // Menu mở rộng hành động (More actions)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  // Trạng thái mở modal xác nhận hủy kết bạn
  const [isUnfriendConfirmOpen, setIsUnfriendConfirmOpen] = useState<boolean>(false);
  // Ghi chú cá nhân cục bộ
  const [personalNote, setPersonalNote] = useState<string>("");
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);

  const isMe = currentUser?.id === user?.id;

  // Lấy trạng thái quan hệ bạn bè và mã lời mời khi mở modal hoặc khi user thay đổi
  useEffect(() => {
    if (!isOpen || !user?.id || isMe) return;

    let isMounted = true;
    setIsLoadingStatus(true);

    friendService
      .getRelationshipInfo(user.id)
      .then((res) => {
        if (isMounted) {
          setRelationshipStatus(res.status);
          setPendingRequestId(res.requestId);
        }
      })
      .catch(() => {
        if (isMounted) {
          setRelationshipStatus("NONE");
          setPendingRequestId(undefined);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingStatus(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id, isMe]);

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
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(user.createdAt))
    : "Chưa xác định";

  // Lọc các cuộc hội thoại chung giữa người dùng hiện tại và người này
  const mutualConversations = conversations.filter((c) =>
    c.participants.some((p) => p.id === user.id)
  );

  // Xử lý gửi lời mời kết bạn (chống spam click và tự động đồng bộ khi gặp 409 Conflict)
  const handleSendFriendRequest = async () => {
    if (!user.id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await friendService.sendFriendRequest(user.id);
      setRelationshipStatus("PENDING_SENT");
      toast.success(`Đã gửi lời mời kết bạn tới ${displayName}`, "Lời mời kết bạn");
      // Tải lại thông tin để cập nhật requestId mới tạo
      const info = await friendService.getRelationshipInfo(user.id);
      setPendingRequestId(info.requestId);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Không thể gửi lời mời kết bạn";
      // Xử lý tình huống đối phương hoặc bản thân đã có lời mời (HTTP 409 Conflict)
      if (errorMsg.includes("đã gửi lời mời") || errorMsg.includes("409")) {
        const info = await friendService.getRelationshipInfo(user.id);
        setRelationshipStatus(info.status);
        setPendingRequestId(info.requestId);
        toast.info(errorMsg, "Thông báo quan hệ");
      } else {
        toast.error(errorMsg, "Thao tác thất bại");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý chấp nhận lời mời kết bạn nhận được
  const handleAcceptFriendRequest = async () => {
    if (!user.id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let reqId = pendingRequestId;
      if (!reqId) {
        const info = await friendService.getRelationshipInfo(user.id);
        reqId = info.requestId;
      }
      if (reqId) {
        await friendService.acceptFriendRequest(reqId);
        setRelationshipStatus("FRIENDS");
        setPendingRequestId(undefined);
        toast.success(`Đã chấp nhận lời mời kết bạn của ${displayName}`, "Kết bạn thành công");
      } else {
        toast.error("Không tìm thấy mã lời mời kết bạn", "Thao tác thất bại");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Không thể chấp nhận lời mời kết bạn",
        "Thao tác thất bại"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý từ chối lời mời kết bạn nhận được
  const handleRejectFriendRequest = async () => {
    if (!user.id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let reqId = pendingRequestId;
      if (!reqId) {
        const info = await friendService.getRelationshipInfo(user.id);
        reqId = info.requestId;
      }
      if (reqId) {
        await friendService.rejectFriendRequest(reqId);
        setRelationshipStatus("NONE");
        setPendingRequestId(undefined);
        toast.info(`Đã từ chối lời mời kết bạn của ${displayName}`, "Từ chối lời mời");
      } else {
        setRelationshipStatus("NONE");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Không thể từ chối lời mời kết bạn",
        "Thao tác thất bại"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý hủy kết bạn sau khi xác nhận trong modal
  const handleConfirmRemoveFriend = async () => {
    if (!user.id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await friendService.removeFriend(user.id);
      setRelationshipStatus("NONE");
      setIsUnfriendConfirmOpen(false);
      setIsMenuOpen(false);
      toast.info(`Đã hủy kết bạn với ${displayName}`, "Hủy kết bạn");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Không thể hủy kết bạn",
        "Thao tác thất bại"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý hủy lời mời kết bạn đã gửi đi
  const handleCancelFriendRequest = async () => {
    if (!user.id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let reqId = pendingRequestId;
      if (!reqId) {
        const info = await friendService.getRelationshipInfo(user.id);
        reqId = info.requestId;
      }
      if (reqId) {
        await friendService.cancelFriendRequest(reqId);
        setRelationshipStatus("NONE");
        setPendingRequestId(undefined);
        toast.info(`Đã hủy lời mời kết bạn tới ${displayName}`, "Hủy lời mời");
      } else {
        setRelationshipStatus("NONE");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Không thể hủy lời mời kết bạn",
        "Thao tác thất bại"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý chặn / bỏ chặn người dùng
  const handleToggleBlock = async () => {
    if (!user.id) return;
    try {
      if (relationshipStatus === "BLOCKED") {
        await friendService.unblockUser(user.id);
        setRelationshipStatus("NONE");
        toast.success(`Đã bỏ chặn ${displayName}`, "Bỏ chặn thành công");
      } else {
        await friendService.blockUser(user.id);
        setRelationshipStatus("BLOCKED");
        toast.warning(`Đã chặn ${displayName}`, "Đã chặn người dùng");
      }
      setIsMenuOpen(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Thao tác thất bại",
        "Lỗi quan hệ"
      );
    }
  };

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
      {/* Khung chính Modal 2 cột theo phong cách Discord */}
      <div className="w-full max-w-2xl bg-uupm-surface border-3 border-uupm-line rounded-sm shadow-uupm-2 overflow-hidden flex flex-col md:flex-row relative animate-in fade-in zoom-in-95 duration-150">
        {/* Nút đóng góc trên bên phải */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-xs bg-uupm-surface hover:bg-uupm-surface-hover border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-ink cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
          title="Đóng hồ sơ"
          aria-label="Đóng cửa sổ hồ sơ"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ================= CỘT TRÁI: THẺ ĐỊNH DANH HỒ SƠ (~42%) ================= */}
        <div className="w-full md:w-[42%] bg-uupm-page border-b-2 md:border-b-0 md:border-r-2 border-uupm-line flex flex-col shrink-0">
          {/* Ảnh bìa (Banner) */}
          <div className="relative h-28 bg-uupm-accent-soft border-b-2 border-uupm-line overflow-hidden shrink-0">
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
          <div className="-mt-12 px-5 relative z-10 flex items-end justify-between">
            <div className="relative inline-block">
              <div className="w-20 h-20 rounded-full bg-uupm-surface border-3 border-uupm-line shadow-uupm-2 flex items-center justify-center overflow-hidden font-black text-2xl text-uupm-accent-text">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-10 h-10 text-uupm-ink" />
                )}
              </div>
              {/* Chấm tròn trạng thái Online lớn kiểu Discord */}
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-uupm-line shadow-sm",
                  isOnline ? "bg-uupm-accent" : "bg-uupm-ink-muted"
                )}
                title={isOnline ? "Đang trực tuyến" : "Ngoại tuyến"}
              />
            </div>
          </div>

          {/* Nhãn Tên & Username */}
          <div className="px-5 pt-3 pb-1">
            <h2 className="text-lg font-black text-uupm-ink tracking-tight truncate">
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
          <div className="px-5 py-2.5 flex items-center gap-2">
            {!isMe ? (
              <>
                {/* Nút quan hệ bạn bè đa trạng thái */}
                {relationshipStatus === "NONE" && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleSendFriendRequest}
                    disabled={isLoadingStatus || isSubmitting}
                    className="flex-1 justify-center text-xs font-black"
                    leftIcon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  >
                    Thêm Bạn
                  </Button>
                )}

                {relationshipStatus === "PENDING_SENT" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelFriendRequest}
                    disabled={isSubmitting}
                    title="Nhấp để hủy lời mời kết bạn đã gửi"
                    className="flex-1 justify-center text-xs font-black hover:text-uupm-danger hover:border-uupm-danger transition-colors cursor-pointer"
                    leftIcon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  >
                    Hủy lời mời
                  </Button>
                )}

                {relationshipStatus === "PENDING_RECEIVED" && (
                  <div className="flex-1 flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleAcceptFriendRequest}
                      disabled={isSubmitting}
                      className="flex-1 justify-center text-xs font-black"
                      leftIcon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    >
                      Đồng ý
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRejectFriendRequest}
                      disabled={isSubmitting}
                      className="flex-1 justify-center text-xs font-black hover:text-uupm-danger hover:border-uupm-danger cursor-pointer"
                      leftIcon={<X className="w-3.5 h-3.5" />}
                    >
                      Từ chối
                    </Button>
                  </div>
                )}

                {relationshipStatus === "FRIENDS" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsUnfriendConfirmOpen(true)}
                    className="flex-1 justify-center text-xs font-black bg-uupm-accent-soft text-uupm-accent-text hover:bg-uupm-danger/10 hover:text-uupm-danger-text hover:border-uupm-danger transition-colors cursor-pointer"
                    title="Nhấp để mở xác nhận hủy kết bạn"
                    leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                  >
                    Bạn bè
                  </Button>
                )}

                {relationshipStatus === "BLOCKED" && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={handleToggleBlock}
                    disabled={isSubmitting}
                    className="flex-1 justify-center text-xs font-black"
                    leftIcon={<ShieldAlert className="w-3.5 h-3.5" />}
                  >
                    Đã chặn
                  </Button>
                )}

                {/* Nút nhắn tin trực tiếp */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStartChat}
                  className="px-2.5"
                  title="Nhắn tin"
                  aria-label="Gửi tin nhắn"
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>

                {/* Nút menu tùy chọn mở rộng */}
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="px-2"
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
                        onClick={handleCopyId}
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

                      <button
                        type="button"
                        onClick={handleToggleBlock}
                        className="w-full px-3 py-1.5 text-left text-xs font-bold text-uupm-danger-text hover:bg-uupm-danger/10 flex items-center gap-2 cursor-pointer border-t border-uupm-line/20"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{relationshipStatus === "BLOCKED" ? "Bỏ chặn" : "Chặn người dùng"}</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full py-1 text-center text-xs font-black text-uupm-accent-text bg-uupm-accent-soft rounded-xs border border-uupm-line">
                Hồ sơ của bạn
              </div>
            )}
          </div>

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
                  autoFocus
                  className="w-full px-2 py-1 bg-uupm-surface border border-uupm-line rounded-xs text-xs font-semibold text-uupm-ink outline-none"
                />
              ) : (
                <p
                  onClick={() => setIsEditingNote(true)}
                  className="italic text-xs font-semibold text-uupm-ink-muted hover:text-uupm-ink cursor-pointer truncate"
                  title="Nhấp để sửa ghi chú"
                >
                  {personalNote || "Nhấp để thêm ghi chú"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ================= CỘT PHẢI: PHÂN MỤC TABS NỘI DUNG (~58%) ================= */}
        <div className="flex-1 bg-uupm-surface p-5 flex flex-col min-h-[360px]">
          {/* Thanh chuyển tab trên đỉnh */}
          <div className="flex items-center gap-6 border-b-2 border-uupm-line/20 pb-2 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={cn(
                "text-xs font-black uppercase tracking-wider transition-colors pb-1 cursor-pointer relative",
                activeTab === "activity"
                  ? "text-uupm-ink after:absolute after:bottom-[-9px] after:left-0 after:right-0 after:h-[2.5px] after:bg-uupm-accent after:rounded-full"
                  : "text-uupm-ink-muted hover:text-uupm-ink"
              )}
            >
              Hoạt động
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("mutual_friends")}
              className={cn(
                "text-xs font-black uppercase tracking-wider transition-colors pb-1 cursor-pointer relative",
                activeTab === "mutual_friends"
                  ? "text-uupm-ink after:absolute after:bottom-[-9px] after:left-0 after:right-0 after:h-[2.5px] after:bg-uupm-accent after:rounded-full"
                  : "text-uupm-ink-muted hover:text-uupm-ink"
              )}
            >
              Bạn Chung
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("mutual_servers")}
              className={cn(
                "text-xs font-black uppercase tracking-wider transition-colors pb-1 cursor-pointer relative",
                activeTab === "mutual_servers"
                  ? "text-uupm-ink after:absolute after:bottom-[-9px] after:left-0 after:right-0 after:h-[2.5px] after:bg-uupm-accent after:rounded-full"
                  : "text-uupm-ink-muted hover:text-uupm-ink"
              )}
            >
              {mutualConversations.length} Hội Thoại Chung
            </button>
          </div>

          {/* Nội dung Tab 1: Hoạt động & Tiểu sử */}
          {activeTab === "activity" && (
            <div className="space-y-4 flex-1">
              {/* Thẻ tiểu sử cá nhân */}
              <div className="p-3.5 bg-uupm-page border-2 border-uupm-line rounded-xs shadow-uupm-active space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-uupm-ink-muted block">
                  Tiểu sử cá nhân
                </span>
                <p className="text-xs font-semibold text-uupm-ink leading-relaxed whitespace-pre-wrap">
                  {user.bio ? user.bio : "Chưa có lời giới thiệu nào được cài đặt."}
                </p>
              </div>

              {/* Thẻ trạng thái phiên hiện tại */}
              <div className="p-3.5 bg-uupm-page border-2 border-uupm-line rounded-xs shadow-uupm-active space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-uupm-ink-muted block">
                  Trạng thái kết nối
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-2.5 h-2.5 rounded-full border border-uupm-line",
                      isOnline ? "bg-uupm-accent" : "bg-uupm-ink-muted"
                    )}
                  />
                  <span className="text-xs font-bold text-uupm-ink">
                    {isOnline ? "Đang trực tuyến trên ứng dụng" : "Hiện đang ngoại tuyến"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Nội dung Tab 2: Bạn Chung */}
          {activeTab === "mutual_friends" && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line shadow-uupm-active flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-uupm-ink" />
              </div>
              <h4 className="text-xs font-black text-uupm-ink uppercase tracking-wide">
                Bạn bè chung
              </h4>
              <p className="text-xs font-semibold text-uupm-ink-muted mt-1 max-w-xs">
                {relationshipStatus === "FRIENDS"
                  ? "Hai bạn đã là bạn bè trực tiếp của nhau!"
                  : "Chưa có người bạn chung nào được tìm thấy giữa hai tài khoản."}
              </p>
            </div>
          )}

          {/* Nội dung Tab 3: Hội thoại & Nhóm chung */}
          {activeTab === "mutual_servers" && (
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[260px] pr-1">
              {mutualConversations.length > 0 ? (
                mutualConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => {
                      void selectConversation(conv.id);
                      onClose();
                    }}
                    className="p-2.5 bg-uupm-page hover:bg-uupm-surface-hover border-2 border-uupm-line rounded-xs shadow-uupm-active flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xs bg-uupm-accent border-2 border-uupm-line flex items-center justify-center shrink-0">
                        <MessageCircle className="w-4 h-4 text-uupm-ink" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-uupm-ink truncate">
                          {conv.title || "Cuộc trò chuyện trực tiếp"}
                        </h4>
                        <p className="text-[10px] font-semibold text-uupm-ink-muted truncate">
                          {conv.type === "DIRECT" ? "Trò chuyện 1-1" : "Nhóm trò chuyện"}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[10px] py-1 px-2 shrink-0 font-bold"
                    >
                      Mở chat
                    </Button>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center my-auto">
                  <div className="w-12 h-12 rounded-xs bg-uupm-page border-2 border-uupm-line shadow-uupm-active flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-uupm-ink-muted" />
                  </div>
                  <h4 className="text-xs font-black text-uupm-ink uppercase tracking-wide">
                    Chưa có hội thoại chung
                  </h4>
                  <p className="text-xs font-semibold text-uupm-ink-muted mt-1 max-w-xs">
                    Hãy bấm nút Nhắn tin ở cột bên trái để bắt đầu cuộc hội thoại đầu tiên!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal xác nhận Hủy kết bạn */}
      {isUnfriendConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
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
    </div>
  );
};
