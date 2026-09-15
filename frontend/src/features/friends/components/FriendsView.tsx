import React, { useEffect, useState, useMemo } from "react";
import {
  Users,
  Search,
  UserX,
  UserCheck,
  UserPlus,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useFriendStore } from "../stores/friend.store";
import type { FriendItem, BlockedUserItem as BlockedUserItemType } from "../types/friend.types";
import { BlockedUserItem } from "./BlockedUserItem";
import { AddFriendTab } from "./AddFriendTab";
import { FriendListSection } from "./FriendListSection";
import { PendingRequestsTab } from "./PendingRequestsTab";
import { FriendsHeader } from "./FriendsHeader";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

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
    blockedUsers,
    activeTab,
    isLoading,
    error,
    searchQuery,
    setActiveTab,
    setSearchQuery,
    fetchAll,
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
      <FriendsHeader
        activeTab={activeTab}
        counts={{
          online: onlineFriends.length,
          all: friends.length,
          pending: receivedRequests.length,
          blocked: blockedUsers.length,
          add: 0,
        }}
        onSelectTab={setActiveTab}
        onBack={onBack}
      />

      {/* ================= NỘI DUNG CHÍNH (BODY) ================= */}
      <FriendsBody
        activeTab={activeTab}
        isLoading={isLoading}
        error={error}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredFriends={filteredFriends}
        filteredBlockedUsers={filteredBlockedUsers}
        onStartChat={onStartChat}
        onOpenProfile={onOpenProfile}
        onSelectTab={setActiveTab}
        onFetchAll={fetchAll}
        onRemoveFriend={(id) => setUnfriendConfirmId(id)}
        onBlockUser={(id) => setBlockConfirmId(id)}
        onUnblockUser={unblockUser}
      />

      {/* ================= MODAL XÁC NHẬN HỦY KẾT BẠN ================= */}
      <ConfirmDialog
        isOpen={Boolean(unfriendConfirmId)}
        title="Hủy kết bạn"
        description="Bạn có chắc chắn muốn hủy kết bạn với người dùng này không? Hành động này sẽ xóa quan hệ bạn bè giữa hai người."
        confirmLabel="Xác nhận hủy"
        onConfirm={handleConfirmRemoveFriend}
        onCancel={() => setUnfriendConfirmId(null)}
      />

      {/* ================= MODAL XÁC NHẬN CHẶN NGƯỜI DÙNG ================= */}
      <ConfirmDialog
        isOpen={Boolean(blockConfirmId)}
        title="Chặn người dùng"
        description="Người dùng này sẽ bị hủy kết bạn và không thể gửi tin nhắn hoặc lời mời kết bạn cho bạn nữa."
        confirmLabel="Chặn người dùng"
        onConfirm={handleConfirmBlockUser}
        onCancel={() => setBlockConfirmId(null)}
      />
    </div>
  );
};

/**
 * Khối nội dung chính của FriendsView (thanh tìm kiếm + 4-5 trạng thái/tab).
 * Tách thành child component để chuyển toàn bộ các nhánh điều kiện render ra khỏi
 * hàm FriendsView (rule no-high-complexity-react-function).
 */
type FriendsTab = "online" | "all" | "pending" | "blocked" | "add";

function FriendsBody(props: {
  activeTab: FriendsTab;
  isLoading: boolean;
  error?: string | null;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filteredFriends: FriendItem[];
  filteredBlockedUsers: BlockedUserItemType[];
  onStartChat: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
  onSelectTab: (tab: FriendsTab) => void;
  onFetchAll: () => void;
  onRemoveFriend: (id: string) => void;
  onBlockUser: (id: string) => void;
  onUnblockUser: (id: string) => void;
}) {
  const { activeTab, isLoading, error, searchQuery, setSearchQuery } = props;

  // Tab Thêm bạn không dùng body danh sách chung.
  // Bọc trong khung cuộn: cha là overflow-hidden nên nếu trả về trực tiếp,
  // danh sách kết quả dài sẽ bị cắt và không cuộn tới được.
  if (activeTab === "add") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AddFriendTab />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
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
        {error && !isLoading ? <FriendsErrorState error={error} onRetry={props.onFetchAll} /> : null}

        {/* Trạng thái 1: Đang tải dữ liệu (Loading Skeleton) */}
        {isLoading ? <FriendsLoadingSkeleton /> : null}

        {/* Trạng thái 2 & 4: Danh sách dữ liệu cho từng tab */}
        {!isLoading && !error ? <FriendsTabContent {...props} /> : null}
      </div>
    </div>
  );
}

/** Khối skeleton loading (4 dòng giả lập) — tách để giảm nhánh trong FriendsBody. */
function FriendsLoadingSkeleton() {
  return (
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
  );
}

/** Khối trạng thái lỗi + nút Thử lại — tách để giảm nhánh trong FriendsBody. */
function FriendsErrorState({
  error,
  onRetry,
}: {
  error?: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-uupm-danger/40 rounded-xs my-auto bg-uupm-danger/5">
      <AlertTriangle className="w-12 h-12 text-uupm-danger-text mb-3 stroke-[1.5]" />
      <p className="text-sm font-black text-uupm-ink">Không thể tải dữ liệu bạn bè</p>
      <p className="text-xs text-uupm-ink-muted mt-1 font-medium max-w-sm">{error}</p>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => void onRetry()}
        className="mt-4"
        leftIcon={<RefreshCw className="w-4 h-4" />}
      >
        Thử lại
      </Button>
    </div>
  );
}

/**
 * Nội dung danh sách theo từng tab (online / all / pending / blocked).
 * FriendsBody đã lọc isLoading/error ra ngoài nên hàm này chỉ còn rẽ nhánh theo tab.
 */
function FriendsTabContent({
  activeTab,
  filteredFriends,
  filteredBlockedUsers,
  onStartChat,
  onOpenProfile,
  onSelectTab,
  onRemoveFriend,
  onBlockUser,
  onUnblockUser,
}: {
  activeTab: FriendsTab;
  filteredFriends: FriendItem[];
  filteredBlockedUsers: BlockedUserItemType[];
  onStartChat: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
  onSelectTab: (tab: FriendsTab) => void;
  onRemoveFriend: (id: string) => void;
  onBlockUser: (id: string) => void;
  onUnblockUser: (id: string) => void;
}) {
  if (activeTab === "online") {
    return (
      <FriendListSection
        title={`Trực tuyến — ${filteredFriends.length}`}
        friends={filteredFriends}
        onStartChat={onStartChat}
        onOpenProfile={onOpenProfile}
        onRemoveFriend={onRemoveFriend}
        onBlockUser={onBlockUser}
        emptyState={
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-uupm-line/30 rounded-xs my-auto">
            <UserCheck className="w-12 h-12 text-uupm-ink-muted mb-3 stroke-[1.5]" />
            <p className="text-sm font-black text-uupm-ink">
              Không có bạn bè nào đang trực tuyến
            </p>
            <p className="text-xs text-uupm-ink-muted mt-1 font-medium">
              Khi bạn bè của bạn đăng nhập, họ sẽ xuất hiện tại đây.
            </p>
          </div>
        }
      />
    );
  }

  if (activeTab === "all") {
    return (
      <FriendListSection
        title={`Tất cả bạn bè — ${filteredFriends.length}`}
        friends={filteredFriends}
        onStartChat={onStartChat}
        onOpenProfile={onOpenProfile}
        onRemoveFriend={onRemoveFriend}
        onBlockUser={onBlockUser}
        emptyState={
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
              onClick={() => onSelectTab("add")}
              className="mt-4"
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              Thêm bạn ngay
            </Button>
          </div>
        }
      />
    );
  }

  if (activeTab === "pending") {
    return <PendingRequestsTab onOpenProfile={onOpenProfile} />;
  }

  // activeTab === "blocked"
  return (
    <div className="flex-1 flex flex-col">
      <div className="text-xs font-black uppercase tracking-wider text-uupm-ink-muted mb-2">
        Người dùng bị chặn — {filteredBlockedUsers.length}
      </div>
      {filteredBlockedUsers.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-uupm-line/30 rounded-xs my-auto">
          <UserX className="w-12 h-12 text-uupm-ink-muted mb-3 stroke-[1.5]" />
          <p className="text-sm font-black text-uupm-ink">Không có người dùng nào bị chặn</p>
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
              onUnblock={onUnblockUser}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
