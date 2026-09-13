# Kế hoạch Triển khai Hệ thống Quản lý Bạn bè Toàn diện (Friend Management System Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rà soát, chuẩn hóa và xây dựng toàn diện hệ thống Quản lý Bạn bè (Friend Subsystem) fullstack kiểu Discord: Backend Socket.IO event emission cho toàn bộ vòng đời quan hệ 2 chiều, Zustand Store chuyên trách, Màn hình Trung tâm Bạn bè (`FriendsView.tsx`), nâng cấp Popup Hồ sơ (`FullUserProfileModal.tsx`) và Thông báo (`NotificationListModal.tsx`).

**Architecture:** Áp dụng kiến trúc phân tầng chuẩn (Layered Architecture): Backend Controller ──> Service ──> Repository với MongoDB Transactions cho Accept/Block và Socket.IO real-time emission (`emitToUser`). Frontend sử dụng Feature-based modularity (`features/friends/`), Zustand Store quản lý trạng thái thời gian thực, và các Atomic UI Components theo chuẩn Tactile Neo-Brutalist design tokens.

**Tech Stack:** Express.js, TypeScript, MongoDB (Mongoose Transactions), Socket.IO, Vitest, Supertest, React 19, Zustand, Tailwind CSS, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-09-13-friend-subsystem-redesign.md`

## Global Constraints
- **Repo boundary safety**: Root repository là `D:/`. Mọi thao tác git chỉ stage file trong `appmessaging/`. Kiểm tra bằng `git diff --cached --name-only | Select-String -NotMatch "^appmessaging/"` trước khi commit.
- **Chú thích Tiếng Việt bắt buộc**: Mọi file tạo mới hoặc chỉnh sửa (Backend Service, Controller, Routes, Tests, Frontend Types, Store, Components) đều phải có comment giải thích rõ mục đích và luồng nghiệp vụ.
- **Bảo toàn Test Coverage**: Toàn bộ 33 test suites hiện tại (237 tests) của backend phải tiếp tục đạt PASS. Bổ sung test mới cho các socket events.
- **Frontend Build**: Lệnh `tsc -b && vite build` phải hoàn thành với 0 lỗi kiểu dữ liệu (0 type errors).
- **Git Commit Attribution**: Mọi commit message phải kết thúc bằng:
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`

---

### Task 1: Backend Real-Time Socket.IO Dispatch in FriendService & Unit Tests

**Files:**
- Modify: `backend/src/services/friend.service.ts`
- Test: `backend/tests/services/friend.service.test.ts`

**Interfaces:**
- Consumes: `emitToUser(userId: string, event: string, payload: unknown)` from `backend/src/socket/index.ts`
- Produces: Socket events phát tới room `user:${targetUserId}`:
  - `friend:request_received`: `{ requestId, sender: senderUser, note }`
  - `friend:request_accepted`: `{ friendshipId, friend: friendUser, acceptedAt }`
  - `friend:request_rejected`: `{ requestId, receiverId }`
  - `friend:request_canceled`: `{ requestId, senderId }`
  - `friend:removed`: `{ userId }`
  - `friend:blocked`: `{ blockerId }`

- [ ] **Step 1: Write failing unit test for Socket.IO event emissions in FriendService**

Thêm các test cases vào `backend/tests/services/friend.service.test.ts` kiểm tra `emitToUser` được gọi với đúng `userId`, `event` và `payload` trong tất cả các phương thức: `sendFriendRequest`, `acceptFriendRequest`, `rejectFriendRequest`, `cancelFriendRequest`, `removeFriend`, `blockUser`.

```typescript
// backend/tests/services/friend.service.test.ts (trích đoạn bổ sung)
import * as socketModule from "../../src/socket";

// Mock hàm emitToUser
const emitToUserSpy = vi.spyOn(socketModule, "emitToUser").mockImplementation(() => {});

it("phát sự kiện friend:request_received khi gửi lời mời kết bạn thành công", async () => {
  // test logic
});

it("phát sự kiện friend:request_accepted cho cả 2 người khi chấp nhận kết bạn", async () => {
  // test logic
});

it("phát sự kiện friend:request_rejected khi từ chối lời mời kết bạn", async () => {
  // test logic
});

it("phát sự kiện friend:request_canceled khi người gửi hủy lời mời kết bạn", async () => {
  // test logic
});

it("phát sự kiện friend:removed khi hủy kết bạn", async () => {
  // test logic
});

it("phát sự kiện friend:blocked khi chặn người dùng", async () => {
  // test logic
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test backend/tests/services/friend.service.test.ts`
Expected: FAIL (Hàm `emitToUser` chưa được gọi trong `FriendService`)

- [ ] **Step 3: Implement Socket.IO emissions in FriendService**

Chỉnh sửa `backend/src/services/friend.service.ts`:
- Import `emitToUser` từ `../socket`.
- Trong `sendFriendRequest`: Phát `friend:request_received` tới `receiverId`.
- Trong `acceptFriendRequest`: Phát `friend:request_accepted` tới `senderIdStr` và `userId`.
- Trong `rejectFriendRequest`: Phát `friend:request_rejected` tới `request.senderId.toString()`.
- Trong `cancelFriendRequest`: Phát `friend:request_canceled` tới `request.receiverId.toString()`.
- Trong `removeFriend`: Phát `friend:removed` tới `targetUserId`.
- Trong `blockUser`: Phát `friend:blocked` tới `blockedId`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test backend/tests/services/friend.service.test.ts`
Expected: PASS

- [ ] **Step 5: Run all backend tests to ensure zero regressions**

Run: `npm test`
Expected: 33/33 test files PASS, 240+ tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C D:/ add appmessaging/backend/src/services/friend.service.ts appmessaging/backend/tests/services/friend.service.test.ts
git -C D:/ commit -m @'
feat(friend): implement real-time socket.io event emissions across friend lifecycle

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

---

### Task 2: Frontend Friend Types & Enhanced REST API Service Client

**Files:**
- Create: `frontend/src/features/friends/types/friend.types.ts`
- Create: `frontend/src/features/friends/services/friend.service.ts`
- Modify: `frontend/src/features/users/services/friend.service.ts` (re-export or keep backwards compatibility)

**Interfaces:**
- Produces: `FriendItem`, `FriendRequestItem`, `BlockedUserItem`, `FriendsTab`, `friendService` với đầy đủ các hàm:
  - `getFriends(options?: { q?: string; online?: boolean; page?: number; limit?: number })`
  - `getReceivedRequests(options?: { page?: number; limit?: number })`
  - `getSentRequests(options?: { page?: number; limit?: number })`
  - `getBlockedUsers(options?: { page?: number; limit?: number })`
  - `getRelationshipInfo(targetUserId: string)`
  - `getRelationshipStatus(targetUserId: string)`
  - `sendFriendRequest(receiverId: string, note?: string)`
  - `acceptFriendRequest(requestId: string)`
  - `rejectFriendRequest(requestId: string)`
  - `cancelFriendRequest(requestId: string)`
  - `blockUser(targetUserId: string)`
  - `unblockUser(targetUserId: string)`
  - `removeFriend(targetUserId: string)`

- [ ] **Step 1: Define TypeScript interfaces in `frontend/src/features/friends/types/friend.types.ts`**

Định nghĩa cấu trúc dữ liệu người bạn (`FriendItem`), lời mời kết bạn (`FriendRequestItem`), người bị chặn (`BlockedUserItem`), tab điều hướng (`FriendsTab`), và kiểu phân trang API.

- [ ] **Step 2: Implement REST API methods in `frontend/src/features/friends/services/friend.service.ts`**

Xây dựng client `friendService` kết nối tới các endpoint backend:
- `GET /friends`
- `GET /friends/requests/received`
- `GET /friends/requests/sent`
- `GET /friends/blocks`
- `POST /friends/requests`
- `POST /friends/requests/:id/accept`
- `POST /friends/requests/:id/reject`
- `DELETE /friends/requests/:id/cancel`
- `DELETE /friends/:targetUserId`
- `POST /friends/blocks/:targetUserId`
- `DELETE /friends/blocks/:targetUserId`
- `GET /friends/status/:targetUserId`

- [ ] **Step 3: Update `frontend/src/features/users/services/friend.service.ts` to re-export from `features/friends`**

Giữ tính tương thích ngược cho các component hiện có bằng cách re-export từ module mới.

- [ ] **Step 4: Verify frontend type checks**

Run: `npm --prefix ../frontend run build`
Expected: PASS (0 errors)

- [ ] **Step 5: Commit**

```bash
git -C D:/ add appmessaging/frontend/src/features/friends/types/friend.types.ts appmessaging/frontend/src/features/friends/services/friend.service.ts appmessaging/frontend/src/features/users/services/friend.service.ts
git -C D:/ commit -m @'
feat(frontend): create comprehensive friend types and rest api service client

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

---

### Task 3: Frontend Friend Zustand Store with Real-Time Socket Listeners

**Files:**
- Create: `frontend/src/features/friends/stores/friend.store.ts`

**Interfaces:**
- Consumes: `friendService`, `getSocket()` from `frontend/src/lib/socket.ts`, `toast` from `frontend/src/stores/toast.store.ts`
- Produces: Hook `useFriendStore` với:
  - State: `friends`, `receivedRequests`, `sentRequests`, `blockedUsers`, `activeTab`, `isLoading`, `searchQuery`.
  - Actions: `fetchFriends`, `fetchReceivedRequests`, `fetchSentRequests`, `fetchBlockedUsers`, `fetchAll`, `setActiveTab`, `setSearchQuery`, `sendFriendRequest`, `acceptFriendRequest`, `rejectFriendRequest`, `cancelFriendRequest`, `removeFriend`, `blockUser`, `unblockUser`.
  - Socket listeners tự động đồng bộ khi nhận sự kiện: `friend:request_received`, `friend:request_accepted`, `friend:request_rejected`, `friend:request_canceled`, `friend:removed`, `friend:blocked`.

- [ ] **Step 1: Implement `useFriendStore` with Zustand**

Xây dựng store quản lý toàn bộ dữ liệu bạn bè. Đảm bảo cập nhật optimistic UI hoặc refetch dữ liệu chính xác khi thực hiện thao tác.

- [ ] **Step 2: Wire Socket.IO listeners inside store initialization or hook**

Đăng ký lắng nghe các sự kiện socket để tự động cập nhật mảng state:
- `friend:request_received`: Thêm vào `receivedRequests`, hiển thị toast thông báo.
- `friend:request_accepted`: Thêm vào `friends`, xóa khỏi `sentRequests`, hiển thị toast thông báo.
- `friend:request_rejected`: Xóa khỏi `sentRequests`.
- `friend:request_canceled`: Xóa khỏi `receivedRequests`.
- `friend:removed`: Xóa người bạn khỏi mảng `friends`.
- `friend:blocked`: Cập nhật trạng thái bị chặn và xóa khỏi mảng bạn bè.

- [ ] **Step 3: Verify frontend type checks**

Run: `npm --prefix ../frontend run build`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit**

```bash
git -C D:/ add appmessaging/frontend/src/features/friends/stores/friend.store.ts
git -C D:/ commit -m @'
feat(frontend): implement zustand friend store with real-time socket.io event synchronization

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

---

### Task 4: UI Components for Friends View (`FriendsView.tsx` and sub-components)

**Files:**
- Create: `frontend/src/features/friends/components/FriendItem.tsx`
- Create: `frontend/src/features/friends/components/FriendRequestItem.tsx`
- Create: `frontend/src/features/friends/components/BlockedUserItem.tsx`
- Create: `frontend/src/features/friends/components/AddFriendTab.tsx`
- Create: `frontend/src/features/friends/components/FriendsView.tsx`

**Interfaces:**
- Consumes: `useFriendStore`, `useAuthStore`, `useChatStore`
- Produces: `<FriendsView onStartChat={(userId: string) => void} onOpenProfile={(userId: string) => void} />`

- [ ] **Step 1: Implement `FriendItem.tsx`**

Hiển thị một hàng người bạn theo chuẩn Neo-Brutalist:
- Avatar người dùng kèm chấm trạng thái Online (xanh lá) / Offline (xám).
- Tên hiển thị (font-black), username và statusMessage (nếu có).
- Nút "Nhắn tin" (MessageSquare) có tooltip và hiệu ứng hover/active.
- Nút 3 chấm mở Dropdown Menu: "Xem hồ sơ", "Hủy kết bạn" (Unfriend), "Chặn" (Block).

- [ ] **Step 2: Implement `FriendRequestItem.tsx`**

Hiển thị hàng lời mời kết bạn (dành cho cả lời mời nhận được và lời mời gửi đi):
- Nhận được: Có 2 nút "Chấp nhận" (Check, màu xanh accent) và "Từ chối" (X, màu trung tính/danger).
- Đã gửi: Có nhãn "Đang chờ đối phương phản hồi" và nút "Hủy lời mời" (X).

- [ ] **Step 3: Implement `BlockedUserItem.tsx`**

Hiển thị hàng người dùng bị chặn:
- Avatar, tên hiển thị, username.
- Nút "Bỏ chặn" (ShieldOff) viền đỏ nổi bật, chuyển thành trạng thái bình thường khi nhấn.

- [ ] **Step 4: Implement `AddFriendTab.tsx`**

Màn hình thêm bạn bè kiểu Discord:
- Tiêu đề "THÊM BẠN", phụ đề "Bạn có thể kết bạn bằng ID hoặc Tên người dùng".
- Ô nhập liệu kèm nút "Gửi lời mời kết bạn".
- Hiển thị thông báo kết quả tức thì (thành công / lỗi).

- [ ] **Step 5: Implement `FriendsView.tsx`**

Component chính tích hợp:
- **Header**: Tab Bar gồm:
  - Icon Bạn bè (`Users`).
  - Phân cách dọc.
  - Tab "Trực tuyến" (Online) kèm số lượng.
  - Tab "Tất cả" (All) kèm số lượng.
  - Tab "Đang chờ" (Pending) kèm badge số lượng lời mời nhận được.
  - Tab "Đã chặn" (Blocked) kèm số lượng.
  - Tab "Thêm bạn" (nổi bật với nền xanh `bg-uupm-accent` hoặc viền xúc giác).
- **Search Bar**: Ô tìm kiếm nhanh lọc danh sách theo tên hoặc username.
- **Body**: Render danh sách tương ứng với tab đang chọn, xử lý đủ 4 trạng thái: Loading (Skeleton), Empty (với icon minh họa đáng yêu), Error và Success.

- [ ] **Step 6: Verify frontend type checks and build**

Run: `npm --prefix ../frontend run build`
Expected: PASS (0 errors)

- [ ] **Step 7: Commit**

```bash
git -C D:/ add appmessaging/frontend/src/features/friends/components/
git -C D:/ commit -m @'
feat(frontend): create discord-style friends view and interactive tab components

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

---

### Task 5: Integrate FriendsView into ChatLayout & ConversationSidebar

**Files:**
- Modify: `frontend/src/features/chat/components/ConversationSidebar.tsx`
- Modify: `frontend/src/features/chat/components/ChatLayout.tsx`

**Interfaces:**
- Consumes: `<FriendsView />`, `useFriendStore`, `useChatStore`
- Produces: Điều hướng mượt mà giữa chế độ xem Hội thoại và chế độ xem Bạn bè

- [ ] **Step 1: Update `ConversationSidebar.tsx`**

Cập nhật nút "Bạn bè":
- Khi nhấp vào "Bạn bè", kích hoạt tab bạn bè và báo cho `ChatLayout` chuyển chế độ xem sang Friends View (`selectConversation(null)` và đặt `activeTab = "friends"`).
- Hiển thị badge số đếm lời mời kết bạn đang chờ (`pendingCount`) ngay trên icon Bạn bè nếu có lời mời chưa duyệt.

- [ ] **Step 2: Update `ChatLayout.tsx`**

Chỉnh sửa Cột 2 của `ChatLayout`:
- Thêm trạng thái `viewMode: "chat" | "friends"`.
- Khi `viewMode === "friends"` và `!activeConversationId`: Render component `<FriendsView />`.
- Truyền callback `onStartChat`: Tìm cuộc hội thoại DM sẵn có với bạn bè đó hoặc tạo mới qua `chatService.createDirectConversation(targetUserId)`, sau đó chuyển ngay sang chế độ chat.
- Truyền callback `onOpenProfile`: Mở `FullUserProfileModal` khi người dùng nhấn xem hồ sơ từ danh sách bạn bè.

- [ ] **Step 3: Verify frontend type checks and build**

Run: `npm --prefix ../frontend run build`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit**

```bash
git -C D:/ add appmessaging/frontend/src/features/chat/components/ConversationSidebar.tsx appmessaging/frontend/src/features/chat/components/ChatLayout.tsx
git -C D:/ commit -m @'
feat(chat): integrate friends view into chat layout and sidebar navigation

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

---

### Task 6: Upgrade FullUserProfileModal with Reject & Unfriend Actions

**Files:**
- Modify: `frontend/src/features/users/components/FullUserProfileModal.tsx`

**Interfaces:**
- Consumes: `friendService.rejectFriendRequest`, `friendService.removeFriend`
- Produces:
  - Khi `relationshipStatus === "PENDING_RECEIVED"`: Hiển thị 2 nút bấm cạnh nhau "Chấp nhận" và "Từ chối".
  - Khi `relationshipStatus === "FRIENDS"`: Menu 3 chấm MoreHorizontal có thêm tùy chọn "Hủy kết bạn" kèm Dialog xác nhận an toàn.

- [ ] **Step 1: Implement `handleRejectFriendRequest` in `FullUserProfileModal.tsx`**

Xây dựng hàm gọi `friendService.rejectFriendRequest(requestId)`, cập nhật `relationshipStatus = "NONE"` và hiển thị toast thông báo.

- [ ] **Step 2: Render Reject button beside Accept button**

Trong khối `relationshipStatus === "PENDING_RECEIVED"`, chia thành 2 nút:
- Nút "Chấp nhận" (variant `primary`, `leftIcon={<Check />}`)
- Nút "Từ chối" (variant `outline`, `leftIcon={<X />}`)

- [ ] **Step 3: Implement `handleRemoveFriend` with confirmation dialog**

Thêm trạng thái `isConfirmUnfriendOpen: boolean`.
Khi người dùng chọn "Hủy kết bạn" trong menu 3 chấm, hiển thị hộp thoại xác nhận:
"Bạn có chắc chắn muốn hủy kết bạn với [Tên]? Thao tác này sẽ xóa họ khỏi danh sách bạn bè của bạn."
Khi người dùng xác nhận, gọi `friendService.removeFriend(user.id)`, cập nhật `relationshipStatus = "NONE"` và hiển thị toast thành công.

- [ ] **Step 4: Verify frontend type checks and build**

Run: `npm --prefix ../frontend run build`
Expected: PASS (0 errors)

- [ ] **Step 5: Commit**

```bash
git -C D:/ add appmessaging/frontend/src/features/users/components/FullUserProfileModal.tsx
git -C D:/ commit -m @'
feat(user-profile): add reject friend request and unfriend confirmation dialog to profile modal

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

---

### Task 7: Enhance NotificationListModal with Inline Accept/Reject Actions

**Files:**
- Modify: `frontend/src/features/notifications/components/NotificationListModal.tsx`

**Interfaces:**
- Consumes: `friendService.acceptFriendRequest`, `friendService.rejectFriendRequest`, `useFriendStore`
- Produces: Nút thao tác nhanh trực tiếp trên thông báo có loại `FRIEND_REQUEST_RECEIVED`

- [ ] **Step 1: Add inline action buttons to NotificationItem**

Trong `NotificationItem`:
Khi `item.type === "FRIEND_REQUEST_RECEIVED"` và có `item.data?.friendRequestId`:
Render hàng nút hành động nhỏ:
- Nút "Đồng ý" (nền xanh accent, text đen, icon Check).
- Nút "Từ chối" (viền đen, hover đỏ, icon X).

- [ ] **Step 2: Wire click handlers**

Khi bấm "Đồng ý":
- Gọi `friendService.acceptFriendRequest(item.data.friendRequestId)`.
- Đánh dấu thông báo là đã đọc qua `onMarkAsRead(item._id)`.
- Cập nhật danh sách bạn bè qua `useFriendStore.getState().fetchAll()`.
- Hiển thị toast chúc mừng thành công.
Khi bấm "Từ chối":
- Gọi `friendService.rejectFriendRequest(item.data.friendRequestId)`.
- Đánh dấu thông báo là đã đọc qua `onMarkAsRead(item._id)`.
- Cập nhật danh sách lời mời qua `useFriendStore.getState().fetchReceivedRequests()`.
- Hiển thị toast thông báo đã từ chối.

- [ ] **Step 3: Verify frontend type checks and build**

Run: `npm --prefix ../frontend run build`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit**

```bash
git -C D:/ add appmessaging/frontend/src/features/notifications/components/NotificationListModal.tsx
git -C D:/ commit -m @'
feat(notification): add inline accept and reject buttons for friend request notifications

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```

---

### Task 8: Fullstack Verification & End-to-End System Audit

**Files:**
- Test: `backend/tests/friend.test.ts`
- Test: `backend/tests/services/friend.service.test.ts`

- [ ] **Step 1: Run complete backend test suite**

Run: `npm test`
Expected: 100% test files PASS (All 33+ test files, 240+ tests).

- [ ] **Step 2: Run complete frontend build**

Run: `npm --prefix ../frontend run build`
Expected: Build thành công trong thư mục `dist/` mà không có bất kỳ warning nghiêm trọng hay type error nào.

- [ ] **Step 3: Commit any final plan updates or cleanups**

```bash
git -C D:/ status appmessaging/
git -C D:/ commit -m @'
chore(friend): complete fullstack verification for friend management subsystem

Co-Authored-By: Claude Code <noreply@anthropic.com>
'@
```
