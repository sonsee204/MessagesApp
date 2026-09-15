import React from "react";
import type { FriendItem as FriendEntry } from "../types/friend.types";
import { FriendItem } from "./FriendItem";

interface FriendListSectionProps {
  /** Nhãn tiêu đề nhóm (vd: "Trực tuyến — 3") */
  title: string;
  /** Danh sách bạn bè đã lọc hiển thị */
  friends: FriendEntry[];
  /** Trạng thái rỗng: khối JSX hiển thị khi danh sách trống */
  emptyState: React.ReactNode;
  onStartChat: (userId: string) => void;
  onOpenProfile: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onBlockUser: (userId: string) => void;
}

/**
 * Khu vực danh sách bạn bè (dùng chung cho tab "Trực tuyến" và "Tất cả").
 * Tách khỏi FriendsView để triệt tiêu duplicate JSX (tab online/all chỉ khác tiêu đề + empty state).
 */
export const FriendListSection: React.FC<FriendListSectionProps> = ({
  title,
  friends,
  emptyState,
  onStartChat,
  onOpenProfile,
  onRemoveFriend,
  onBlockUser,
}) => (
  <div className="flex-1 flex flex-col">
    <div className="text-xs font-black uppercase tracking-wider text-uupm-ink-muted mb-2">
      {title}
    </div>
    {friends.length === 0 ? (
      emptyState
    ) : (
      <div className="border-2 border-uupm-line rounded-xs bg-uupm-surface divide-y divide-uupm-line/20 shadow-uupm-2">
        {friends.map((f) => (
          <FriendItem
            key={f.friendshipId}
            friend={f}
            onStartChat={onStartChat}
            onOpenProfile={onOpenProfile}
            onRemoveFriend={onRemoveFriend}
            onBlockUser={onBlockUser}
          />
        ))}
      </div>
    )}
  </div>
);
