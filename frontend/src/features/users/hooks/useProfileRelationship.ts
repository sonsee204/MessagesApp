import { useState, useEffect, useRef } from "react";
import { useFriendStore } from "../../friends/stores/friend.store";
import { friendService, RelationshipStatus } from "../services/friend.service";
import { toast } from "../../../stores/toast.store";

interface UseProfileRelationshipArgs {
  isOpen: boolean;
  isMe: boolean;
  userId?: string;
}

/**
 * Hook quản lý trạng thái và toàn bộ thao tác GHI quan hệ bạn bè của FullUserProfileModal.
 * Tách khỏi component cha để giảm độ phức tạp hàm (rule no-high-complexity-react-function)
 * và tuân thủ headless pattern: UI chỉ nhận state + callback, không chứa logic nghiệp vụ.
 */
export function useProfileRelationship({ isOpen, isMe, userId }: UseProfileRelationshipArgs) {
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>("NONE");
  const [blockedByMe, setBlockedByMe] = useState<boolean>(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusReloadKey, setStatusReloadKey] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Mã lời mời đang chờ chỉ đọc/ghi trong handler async → useRef, không re-render.
  const pendingRequestIdRef = useRef<string | undefined>(undefined);

  // Tải trạng thái quan hệ 2 chiều khi mở modal hoặc đổi user (lượt ĐỌC duy nhất qua service).
  useEffect(() => {
    if (!isOpen || !userId || isMe) return;

    let isMounted = true;
    setIsLoadingStatus(true);
    setStatusError(null);

    friendService
      .getRelationshipInfo(userId)
      .then((res) => {
        if (!isMounted) return;
        setRelationshipStatus(res.status);
        pendingRequestIdRef.current = res.requestId;
        setBlockedByMe(res.blockedByMe ?? false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setRelationshipStatus("NONE");
        pendingRequestIdRef.current = undefined;
        setBlockedByMe(false);
        setStatusError(
          err instanceof Error ? err.message : "Không thể tải trạng thái quan hệ bạn bè."
        );
      })
      .finally(() => {
        if (isMounted) setIsLoadingStatus(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, isMe, statusReloadKey]);

  const sendFriendRequest = useFriendStore((state) => state.sendFriendRequest);
  const acceptFriendRequest = useFriendStore((state) => state.acceptFriendRequest);
  const rejectFriendRequest = useFriendStore((state) => state.rejectFriendRequest);
  const cancelFriendRequest = useFriendStore((state) => state.cancelFriendRequest);
  const removeFriend = useFriendStore((state) => state.removeFriend);
  const blockUser = useFriendStore((state) => state.blockUser);
  const unblockUser = useFriendStore((state) => state.unblockUser);

  // Đồng bộ lại trạng thái thực tế từ máy chủ khi gặp lỗi 409 Conflict.
  const refetchRelationship = async () => {
    if (!userId) return;
    const info = await friendService.getRelationshipInfo(userId);
    setRelationshipStatus(info.status);
    pendingRequestIdRef.current = info.requestId;
    setBlockedByMe(info.blockedByMe ?? false);
  };

  const handleSendFriendRequest = async () => {
    if (!userId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await sendFriendRequest(userId);
      setRelationshipStatus("PENDING_SENT");
      await refetchRelationship();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Không thể gửi lời mời kết bạn";
      // 409 Conflict: đối phương hoặc bản thân đã có lời mời → đồng bộ trạng thái thực tế.
      if (errorMsg.includes("đã gửi lời mời") || errorMsg.includes("409")) {
        try {
          await refetchRelationship();
        } catch {
          // Giữ nguyên trạng thái hiện tại nếu tra cứu lại thất bại
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!userId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let reqId = pendingRequestIdRef.current;
      if (!reqId) reqId = (await friendService.getRelationshipInfo(userId)).requestId;
      if (reqId) {
        await acceptFriendRequest(reqId);
        setRelationshipStatus("FRIENDS");
        pendingRequestIdRef.current = undefined;
      } else {
        toast.error("Không tìm thấy mã lời mời kết bạn", "Thao tác thất bại");
      }
    } catch {
      // Store đã hiển thị toast lỗi tương ứng
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectFriendRequest = async () => {
    if (!userId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let reqId = pendingRequestIdRef.current;
      if (!reqId) reqId = (await friendService.getRelationshipInfo(userId)).requestId;
      if (reqId) {
        await rejectFriendRequest(reqId);
      }
      setRelationshipStatus("NONE");
      pendingRequestIdRef.current = undefined;
    } catch {
      // Store đã hiển thị toast lỗi tương ứng
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRemoveFriend = async () => {
    if (!userId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await removeFriend(userId);
      setRelationshipStatus("NONE");
    } catch {
      // Store đã hiển thị toast lỗi tương ứng
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelFriendRequest = async () => {
    if (!userId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let reqId = pendingRequestIdRef.current;
      if (!reqId) reqId = (await friendService.getRelationshipInfo(userId)).requestId;
      if (reqId) {
        await cancelFriendRequest(reqId);
      }
      setRelationshipStatus("NONE");
      pendingRequestIdRef.current = undefined;
    } catch {
      // Store đã hiển thị toast lỗi tương ứng
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!userId) return;
    try {
      if (relationshipStatus === "BLOCKED") {
        await unblockUser(userId);
        setRelationshipStatus("NONE");
        setBlockedByMe(false);
      } else {
        await blockUser(userId);
        setRelationshipStatus("BLOCKED");
        setBlockedByMe(true);
      }
    } catch {
      // Store đã hiển thị toast lỗi tương ứng
    }
  };

  return {
    relationshipStatus,
    blockedByMe,
    isLoadingStatus,
    statusError,
    statusReloadKey,
    setStatusReloadKey,
    isSubmitting,
    handleSendFriendRequest,
    handleAcceptFriendRequest,
    handleRejectFriendRequest,
    handleConfirmRemoveFriend,
    handleCancelFriendRequest,
    handleToggleBlock,
  };
}
