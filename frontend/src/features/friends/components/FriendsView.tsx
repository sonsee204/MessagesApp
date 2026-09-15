import React, { useEffect, useState, useMemo } from "react";
import {
  Users,
  Search,
  UserX,
  UserCheck,
  UserPlus,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { useFriendStore } from "../stores/friend.store";
import { FriendItem } from "./FriendItem";
import { FriendRequestItem } from "./FriendRequestItem";
import { BlockedUserItem } from "./BlockedUserItem";
import { AddFriendTab } from "./AddFriendTab";
import { Button } from "../../../components/ui/Button";
import { ThemeToggle } from "../../../components/ui/ThemeToggle";

export interface FriendsViewProps {
  onStartChat: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
  onBack?: () => void;
}

/**
 * Màn hình trung tâm quản lý Bạn bè theo phong cách Discord chuẩn Tactile Neo-Brutalist
 */
export const FriendsView: React.FC<FriendsViewProps> = ({
  onStartChat,
  onOpenProfile,
  onBack,
}) => {
  const {
    friends,
    receivedRequests,
    sentRequests,
    blockedUsers,
    activeTab,
    isLoading,
    error,
    searchQuery,
    setActiveTab,
    setSearchQuery,
    fetchAll,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,
  } = useFriendStore();

  // Hộp thoại xác nhận Hủy kết bạn
  const [unfriendConfirmId, setUnfriendConfirmId] = useState<string | null>(null);
  // Hộp thoại xác nhận Chặn người dùng
  const [blockConfirmId, setBlockConfirmId] = useState<string | null>(null);

  // Tải toàn bộ dữ liệu bạn bè khi màn hình được khởi tạo
  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Lọc danh sách bạn bè trực tuyến
  const onlineFriends = useMemo(() => {
    return friends.filter((f) => f.user.isOnline);
  }, [friends]);

  // Lọc bạn bè theo từ khóa tìm kiếm
  const filteredFriends = useMemo(() => {
    const list = activeTab === "online" ? onlineFriends : friends;
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (f) =>
        f.user.displayName.toLowerCase().includes(q) ||
        f.user.username.toLowerCase().includes(q)
    );
  }, [activeTab, onlineFriends, friends, searchQuery]);

  // Lọc người dùng bị chặn theo từ khóa
  const filteredBlockedUsers = useMemo(() => {
    if (!searchQuery.trim()) return blockedUsers;
    const q = searchQuery.toLowerCase().trim();
    return blockedUsers.filter((b) => {
      if (typeof b.blockedId === "object" && b.blockedId !== null) {
        return (
          b.blockedId.displayName?.toLowerCase().includes(q) ||
          b.blockedId.username?.toLowerCase().includes(q)
        );
      }
      return false;
    });
  }, [blockedUsers, searchQuery]);

  // Thực thi hủy kết bạn sau khi xác nhận
  const handleConfirmRemoveFriend = async () => {
    if (!unfriendConfirmId) return;
    try {
      await removeFriend(unfriendConfirmId);
    } finally {
      setUnfriendConfirmId(null);
    }
  };

  // Thực thi chặn sau khi xác nhận
  const handleConfirmBlockUser = async () => {
    if (!blockConfirmId) return;
    try {
      await blockUser(blockConfirmId);
    } finally {
      setBlockConfirmId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-uupm-surface overflow-hidden">
      {/* ================= HEADER: TAB NAVIGATION DISCORD ================= */}
      <header className="h-14 border-b-2 border-uupm-line px-4 flex items-center justify-between shrink-0 bg-uupm-surface z-10 gap-2">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          {/* Nút quay lại trên màn hình di động */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden w-8 h-8 rounded-xs border-2 border-uupm-line bg-uupm-surface hover:bg-uupm-surface-hover flex items-center justify-center text-uupm-ink mr-1 shrink-0 cursor-pointer shadow-uupm-active active:translate-x-[1px] active:translate-y-[1px]"
              title="Quay lại danh sách"
              aria-label="Quay lại danh sách"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {/* Nhãn chính */}
          <div className="flex items-center gap-2 pr-2 text-uupm-ink font-black shrink-0">
            <Users className="w-5 h-5" />
            <span className="text-sm uppercase tracking-wider hidden md:inline">Bạn Bè</span>
          </div>

          {/* Phân cách dọc */}
          <div className="h-5 w-[2px] bg-uupm-line/20 shrink-0 hidden sm:block" />

          {/* Tab: Trực tuyến */}
          <button
            type="button"
            onClick={() => setActiveTab("online")}
            className={`px-3 py-1 rounded-xs text-xs font-black shrink-0 cursor-pointer transition-[background-color,box-shadow,transform] flex items-center gap-1.5 ${
              activeTab === "online"
                ? "bg-uupm-page border-2 border-uupm-line shadow-uupm-active text-uupm-ink"
                : "text-uupm-ink-muted hover:text-uupm-ink hover:bg-uupm-surface-hover"
            }`}
          >
            <span>Trực tuyến</span>
            <span className="text-[10px] opacity-75 font-bold">({onlineFriends.length})</span>
          </button>

          {/* Tab: Tất cả */}
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1 rounded-xs text-xs font-black shrink-0 cursor-pointer transition-[background-color,box-shadow,transform] flex items-center gap-1.5 ${
              activeTab === "all"
                ? "bg-uupm-page border-2 border-uupm-line shadow-uupm-active text-uupm-ink"
                : "text-uupm-ink-muted hover:text-uupm-ink hover:bg-uupm-surface-hover"
            }`}
          >
            <span>Tất cả</span>
            <span className="text-[10px] opacity-75 font-bold">({friends.length})</span>
          </button>

          {/* Tab: Đang chờ */}
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1 rounded-xs text-xs font-black shrink-0 cursor-pointer transition-[background-color,box-shadow,transform] flex items-center gap-1.5 ${
              activeTab === "pending"
                ? "bg-uupm-page border-2 border-uupm-line shadow-uupm-active text-uupm-ink"
                : "text-uupm-ink-muted hover:text-uupm-ink hover:bg-uupm-surface-hover"
            }`}
          >
            <span>Đang chờ</span>
            {receivedRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-uupm-danger text-uupm-danger-ink text-[10px] font-black">
                {receivedRequests.length}
              </span>
            )}
          </button>

          {/* Tab: Đã chặn */}
          <button
            type="button"
            onClick={() => setActiveTab("blocked")}
            className={`px-3 py-1 rounded-xs text-xs font-black shrink-0 cursor-pointer transition-[background-color,box-shadow,transform] flex items-center gap-1.5 ${
              activeTab === "blocked"
                ? "bg-uupm-page border-2 border-uupm-line shadow-uupm-active text-uupm-ink"
                : "text-uupm-ink-muted hover:text-uupm-ink hover:bg-uupm-surface-hover"
            }`}
          >
            <span>Đã chặn</span>
            <span className="text-[10px] opacity-75 font-bold">({blockedUsers.length})</span>
          </button>

          {/* Tab: Thêm bạn (Màu xanh Accent nổi bật) */}
          <button
            type="button"
            onClick={() => setActiveTab("add")}
            className={`px-3 py-1 rounded-xs text-xs font-black shrink-0 cursor-pointer transition-[background-color,box-shadow,transform] flex items-center gap-1.5 border-2 ${
              activeTab === "add"
                ? "bg-uupm-accent text-uupm-accent-text border-uupm-line shadow-uupm-active"
                : "bg-uupm-accent/20 text-uupm-accent-text border-transparent hover:border-uupm-line hover:bg-uupm-accent/40"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Thêm Bạn</span>
          </button>
        </div>

        {/* Phía bên phải: nút đổi Theme sáng/tối đồng bộ với ChatHeader */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
        </div>
      </header>

      {/* ================= NỘI DUNG CHÍNH (BODY) ================= */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Tab Thêm bạn */}
        {activeTab === "add" ? (
          <AddFriendTab />
        ) : (
          <div className="p-4 sm:p-6 flex-1 flex flex-col max-w-4xl w-full mx-auto">
            {/* Thanh tìm kiếm nhanh */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-uupm-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bạn bè..."
                aria-label="Tìm kiếm bạn bè"
                className="w-full bg-uupm-page border-2 border-uupm-line rounded-xs pl-9 pr-3 py-2 text-xs font-bold text-uupm-ink placeholder:text-uupm-ink-muted focus:border-uupm-accent shadow-uupm-active outline-none transition-colors"
              />
            </div>

            {/* Trạng thái 3: Lỗi tải dữ liệu (Error + nút Thử lại) */}
            {!isLoading && error && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-uupm-danger/40 rounded-xs my-auto bg-uupm-danger/5">
                <AlertTriangle className="w-12 h-12 text-uupm-danger-text mb-3 stroke-[1.5]" />
                <p className="text-sm font-black text-uupm-ink">
                  Không thể tải dữ liệu bạn bè
                </p>
                <p className="text-xs text-uupm-ink-muted mt-1 font-medium max-w-sm">
                  {error}
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void fetchAll()}
                  className="mt-4"
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                >
                  Thử lại
                </Button>
              </div>
            )}

            {/* Trạng thái 1: Đang tải dữ liệu (Loading Skeleton) */}
            {isLoading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xs border-2 border-uupm-line/20 bg-uupm-page/50 animate-pulse"
                  >
                    <div className="w-10 h-10 rounded-full bg-uupm-surface-strong" />
                    <div className="flex-1 space-y-2">
                      <div className="w-32 h-3.5 bg-uupm-surface-strong rounded-xs" />
                      <div className="w-20 h-2.5 bg-uupm-surface-strong rounded-xs" />
                    </div>
                    <div className="w-8 h-8 rounded-xs bg-uupm-surface-strong" />
                  </div>
                ))}
              </div>
            ) : null}

            {/* Trạng thái 2 & 4: Danh sách dữ liệu cho từng tab */}
            {!isLoading && !error && activeTab ==="online" && (
              <div className="flex-1 flex flex-col">
                <div className="text-xs font-black uppercase tracking-wider text-uupm-ink-muted mb-2">
                  Trực tuyến — {filteredFriends.length}
                </div>
                {filteredFriends.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-uupm-line/30 rounded-xs my-auto">
                    <UserCheck className="w-12 h-12 text-uupm-ink-muted mb-3 stroke-[1.5]" />
                    <p className="text-sm font-black text-uupm-ink">
                      Không có bạn bè nào đang trực tuyến
                    </p>
                    <p className="text-xs text-uupm-ink-muted mt-1 font-medium">
                      Khi bạn bè của bạn đăng nhập, họ sẽ xuất hiện tại đây.
                    </p>
                  </div>
                ) : (
                  <div className="border-2 border-uupm-line rounded-xs bg-uupm-surface divide-y divide-uupm-line/20 shadow-uupm-2">
                    {filteredFriends.map((f) => (
                      <FriendItem
                        key={f.friendshipId}
                        friend={f}
                        onStartChat={onStartChat}
                        onOpenProfile={onOpenProfile}
                        onRemoveFriend={(id) => setUnfriendConfirmId(id)}
                        onBlockUser={(id) => setBlockConfirmId(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isLoading && !error && activeTab ==="all" && (
              <div className="flex-1 flex flex-col">
                <div className="text-xs font-black uppercase tracking-wider text-uupm-ink-muted mb-2">
                  Tất cả bạn bè — {filteredFriends.length}
                </div>
                {filteredFriends.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-uupm-line/30 rounded-xs my-auto">
                    <Users className="w-12 h-12 text-uupm-ink-muted mb-3 stroke-[1.5]" />
                    <p className="text-sm font-black text-uupm-ink">Chưa có bạn bè nào</p>
                    <p className="text-xs text-uupm-ink-muted mt-1 font-medium">
                      Hãy chuyển sang tab "Thêm Bạn" để kết nối với những người dùng khác!
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveTab("add")}
                      className="mt-4"
                      leftIcon={<UserPlus className="w-4 h-4" />}
                    >
                      Thêm bạn ngay
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-uupm-line rounded-xs bg-uupm-surface divide-y divide-uupm-line/20 shadow-uupm-2">
                    {filteredFriends.map((f) => (
                      <FriendItem
                        key={f.friendshipId}
                        friend={f}
                        onStartChat={onStartChat}
                        onOpenProfile={onOpenProfile}
                        onRemoveFriend={(id) => setUnfriendConfirmId(id)}
                        onBlockUser={(id) => setBlockConfirmId(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isLoading && !error && activeTab ==="pending" && (
              <div className="space-y-6">
                {/* Nhóm 1: Lời mời nhận được */}
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-uupm-ink-muted mb-2">
                    Lời mời nhận được — {receivedRequests.length}
                  </div>
                  {receivedRequests.length === 0 ? (
                    <div className="p-4 border-2 border-dashed border-uupm-line/20 rounded-xs text-center text-xs text-uupm-ink-muted font-bold">
                      Không có lời mời kết bạn nào nhận được.
                    </div>
                  ) : (
                    <div className="border-2 border-uupm-line rounded-xs bg-uupm-surface divide-y divide-uupm-line/20 shadow-uupm-2">
                      {receivedRequests.map((r) => (
                        <FriendRequestItem
                          key={r._id || r.id}
                          request={r}
                          type="received"
                          onAccept={acceptFriendRequest}
                          onReject={rejectFriendRequest}
                          onOpenProfile={onOpenProfile}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Nhóm 2: Lời mời đã gửi */}
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-uupm-ink-muted mb-2">
                    Lời mời đã gửi — {sentRequests.length}
                  </div>
                  {sentRequests.length === 0 ? (
                    <div className="p-4 border-2 border-dashed border-uupm-line/20 rounded-xs text-center text-xs text-uupm-ink-muted font-bold">
                      Không có lời mời kết bạn nào đang chờ duyệt.
                    </div>
                  ) : (
                    <div className="border-2 border-uupm-line rounded-xs bg-uupm-surface divide-y divide-uupm-line/20 shadow-uupm-2">
                      {sentRequests.map((r) => (
                        <FriendRequestItem
                          key={r._id || r.id}
                          request={r}
                          type="sent"
                          onCancel={cancelFriendRequest}
                          onOpenProfile={onOpenProfile}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isLoading && !error && activeTab ==="blocked" && (
              <div className="flex-1 flex flex-col">
                <div className="text-xs font-black uppercase tracking-wider text-uupm-ink-muted mb-2">
                  Người dùng bị chặn — {filteredBlockedUsers.length}
                </div>
                {filteredBlockedUsers.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-uupm-line/30 rounded-xs my-auto">
                    <UserX className="w-12 h-12 text-uupm-ink-muted mb-3 stroke-[1.5]" />
                    <p className="text-sm font-black text-uupm-ink">
                      Không có người dùng nào bị chặn
                    </p>
                    <p className="text-xs text-uupm-ink-muted mt-1 font-medium">
                      Danh sách những người dùng bạn đã chặn sẽ xuất hiện tại đây.
                    </p>
                  </div>
                ) : (
                  <div className="border-2 border-uupm-line rounded-xs bg-uupm-surface divide-y divide-uupm-line/20 shadow-uupm-2">
                    {filteredBlockedUsers.map((b) => (
                      <BlockedUserItem
                        key={b._id || b.id}
                        block={b}
                        onUnblock={unblockUser}
                        onOpenProfile={onOpenProfile}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= MODAL XÁC NHẬN HỦY KẾT BẠN ================= */}
      {unfriendConfirmId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận hủy kết bạn"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
        >
          <div className="w-full max-w-sm bg-uupm-surface border-3 border-uupm-line rounded-xs shadow-uupm-2 p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-uupm-danger-text mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-black text-base text-uupm-ink">Hủy kết bạn</h3>
            </div>
            <p className="text-xs text-uupm-ink-soft font-medium leading-relaxed mb-5">
              Bạn có chắc chắn muốn hủy kết bạn với người dùng này không? Hành động này sẽ xóa quan hệ bạn bè giữa hai người.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUnfriendConfirmId(null)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleConfirmRemoveFriend}
              >
                Xác nhận hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL XÁC NHẬN CHẶN NGƯỜI DÙNG ================= */}
      {blockConfirmId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận chặn người dùng"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
        >
          <div className="w-full max-w-sm bg-uupm-surface border-3 border-uupm-line rounded-xs shadow-uupm-2 p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-uupm-danger-text mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-black text-base text-uupm-ink">Chặn người dùng</h3>
            </div>
            <p className="text-xs text-uupm-ink-soft font-medium leading-relaxed mb-5">
              Người dùng này sẽ bị hủy kết bạn và không thể gửi tin nhắn hoặc lời mời kết bạn cho bạn nữa.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBlockConfirmId(null)}
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleConfirmBlockUser}
              >
                Chặn người dùng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
