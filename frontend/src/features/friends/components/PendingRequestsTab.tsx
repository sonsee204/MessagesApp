import React from "react";
import { useFriendStore } from "../stores/friend.store";
import { FriendRequestItem } from "./FriendRequestItem";

interface PendingRequestsTabProps {
  onOpenProfile: (userId: string) => void;
}

/**
 * Tab "Đang chờ" của màn hình Bạn bè: 2 nhóm lời mời (nhận được & đã gửi).
 * Tách khỏi FriendsView để giảm độ dài và độ phức tạp JSX của component cha.
 * Tự đọc dữ liệu/hành động từ useFriendStore (headless store) thay vì nhận qua props.
 */
export const PendingRequestsTab: React.FC<PendingRequestsTabProps> = ({ onOpenProfile }) => {
  const {
    receivedRequests,
    sentRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
  } = useFriendStore();

  return (
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
  );
};
