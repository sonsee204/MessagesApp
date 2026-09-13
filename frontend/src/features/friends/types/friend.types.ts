/**
 * Định nghĩa kiểu dữ liệu cho module Quản lý Bạn bè (Friend Subsystem)
 */

/**
 * Trạng thái quan hệ hai chiều giữa người dùng hiện tại và đối phương
 * - NONE: Không có quan hệ gì
 * - BLOCKED: Đang có quan hệ chặn (một trong 2 người đã chặn người kia)
 * - FRIENDS: Đang là bạn bè chính thức
 * - PENDING_SENT: Người dùng hiện tại đã gửi lời mời và đang chờ đối phương phản hồi
 * - PENDING_RECEIVED: Đối phương đã gửi lời mời cho người dùng hiện tại
 */
export type RelationshipStatus =
  | "NONE"
  | "BLOCKED"
  | "FRIENDS"
  | "PENDING_SENT"
  | "PENDING_RECEIVED";

/**
 * Dữ liệu phản hồi chi tiết về trạng thái quan hệ 2 chiều
 */
export interface RelationshipStatusResponse {
  targetUserId: string;
  status: RelationshipStatus;
  requestId?: string;
  /**
   * Chiều của quan hệ chặn (chỉ có ý nghĩa khi status === "BLOCKED"):
   * - true: chính người dùng hiện tại đã chặn đối phương -> được phép bỏ chặn
   * - false: đối phương chặn người dùng hiện tại -> không thể bỏ chặn từ phía mình
   */
  blockedByMe?: boolean;
}

/**
 * Thông tin người dùng rút gọn trong danh sách bạn bè
 */
export interface FriendUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
}

/**
 * Một mục bạn bè trong danh sách trả về từ API /friends
 */
export interface FriendItem {
  friendshipId: string;
  friendSince: string;
  user: FriendUser;
}

/**
 * Người dùng liên quan trong lời mời kết bạn (sender hoặc receiver được populate)
 */
export interface FriendRequestUser {
  _id?: string;
  id?: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
}

/**
 * Một bản ghi lời mời kết bạn trả về từ API /friends/requests/...
 */
export interface FriendRequestItem {
  _id: string;
  id?: string;
  senderId: string | FriendRequestUser;
  receiverId: string | FriendRequestUser;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED";
  note?: string;
  createdAt: string;
  respondedAt?: string;
}

/**
 * Một mục người dùng bị chặn trả về từ API /friends/blocks
 */
export interface BlockedUserItem {
  _id: string;
  id?: string;
  blockerId: string;
  blockedId:
    | string
    | {
        _id?: string;
        id?: string;
        username: string;
        displayName: string;
        avatarUrl?: string | null;
      };
  createdAt: string;
}

/**
 * Các tab hiển thị trên màn hình quản lý Bạn bè kiểu Discord
 * - online: Danh sách bạn bè đang trực tuyến
 * - all: Tất cả bạn bè
 * - pending: Lời mời đang chờ phản hồi (nhận được và đã gửi)
 * - blocked: Danh sách người dùng bị chặn
 * - add: Giao diện gửi lời mời kết bạn mới
 */
export type FriendsTab = "online" | "all" | "pending" | "blocked" | "add";

/**
 * Cấu trúc phân trang danh sách chuẩn từ backend
 */
export interface PaginatedData<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Tùy chọn lọc và phân trang danh sách bạn bè
 */
export interface FriendQueryOptions {
  q?: string;
  online?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Tùy chọn phân trang cơ bản
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}
