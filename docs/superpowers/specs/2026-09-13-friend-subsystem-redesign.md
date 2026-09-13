# Đặc tả Thiết kế Hệ thống Quản lý Bạn bè Toàn diện (Friend Subsystem Design Spec)

> **Mã tài liệu**: `2026-09-13-friend-subsystem-redesign`  
> **Trạng thái**: Đã phê duyệt (Approved)  
> **Tác giả**: Claude Code  
> **Công nghệ**: Express.js, TypeScript, MongoDB (Mongoose Transactions), Socket.IO, React, Zustand, Tailwind CSS  

---

## 1. Mục tiêu & Bối cảnh (Goals & Context)

Hệ thống bạn bè là một trong những trụ cột cốt lõi của ứng dụng nhắn tin `appmessaging`. Tài liệu này chuẩn hóa toàn bộ vòng đời tương tác hai chiều giữa hai người dùng bất kỳ:
- **Thêm bạn (Add Friend)**: Gửi lời mời kết bạn kèm lời nhắn, chống trùng lặp, chống tự gửi và chống gửi khi đã bị chặn.
- **Đồng ý (Accept)**: Chấp nhận kết bạn thực thi nguyên tử trong MongoDB Transaction, tạo bản ghi bạn bè đối xứng và bắn thông báo thời gian thực qua Socket.IO.
- **Từ chối (Reject)**: Từ chối lời mời kết bạn nhận được và cập nhật trạng thái bản ghi.
- **Hủy lời mời (Cancel)**: Người gửi chủ động thu hồi lời mời đã gửi đi khi đối phương chưa phản hồi.
- **Hủy kết bạn (Unfriend)**: Xóa quan hệ bạn bè 2 chiều với cơ chế xác nhận an toàn, khôi phục trạng thái về người lạ (`NONE`).
- **Chặn & Bỏ chặn (Block / Unblock)**: Chặn người dùng với MongoDB Transaction (tự động xóa bạn bè, hủy lời mời đang chờ và vô hiệu hóa nhắn tin), hỗ trợ danh sách quản lý người bị chặn và bỏ chặn.
- **Trải nghiệm người dùng kiểu Discord**: Màn hình Trung tâm Bạn bè (`FriendsView.tsx`) toàn diện với các tab Trực tuyến, Tất cả, Đang chờ, Đã chặn và Thêm bạn; kết hợp các nút thao tác nhanh trên Popup Hồ sơ cá nhân (`FullUserProfileModal.tsx`) và Popover Thông báo (`NotificationListModal.tsx`).

---

## 2. Máy trạng thái Quan hệ Hai Chiều (Relationship State Machine)

Hai người dùng $(A, B)$ luôn tồn tại ở **1 và chỉ 1** trạng thái quan hệ duy nhất tại một thời điểm:

```
                  ┌────────────── [Chặn / Block] ───────────────┐
                  │                                             ▼
             ┌─────────┐   A gửi lời mời   ┌──────────────┐   ┌─────────┐
             │         │ ────────────────> │ PENDING_SENT │   │         │
             │  NONE   │                   └──────────────┘   │ BLOCKED │
             │ (Người  │ <── A hủy lời mời ───────┘           │ (Bị     │
             │   lạ)   │                                      │  chặn)  │
             │         │ <── B từ chối ───────────┐           │         │
             └─────────┘                          │           └─────────┘
                  ▲    ▲ B gửi lời mời     ┌──────────────┐     ▲
                  │    └────────────────── │PENDING_RECV'D│     │
                  │                        └──────────────┘     │
                  │                               │             │
                  │                        B chấp nhận          │
                  │                               ▼             │
                  │        A/B hủy bạn      ┌─────────┐         │
                  └──────────────────────── │ FRIENDS │ ────────┘
                                            └─────────┘
```

### Các chuyển đổi trạng thái (State Transitions):
1. `NONE` ➔ `PENDING_SENT` (với A) / `PENDING_RECEIVED` (với B): Khi A gọi `POST /api/friends/requests`.
2. `PENDING_SENT` ➔ `NONE`: Khi A gọi `DELETE /api/friends/requests/:id/cancel`.
3. `PENDING_RECEIVED` ➔ `NONE`: Khi B gọi `POST /api/friends/requests/:id/reject`.
4. `PENDING_RECEIVED` ➔ `FRIENDS`: Khi B gọi `POST /api/friends/requests/:id/accept`. Kích hoạt Transaction: đổi trạng thái request thành `ACCEPTED` và tạo quan hệ `Friendship`.
5. `FRIENDS` ➔ `NONE`: Khi A hoặc B gọi `DELETE /api/friends/:targetUserId`. Xóa bản ghi `Friendship`.
6. Bất kỳ trạng thái nào ➔ `BLOCKED`: Khi một bên gọi `POST /api/friends/blocks/:targetUserId`. Kích hoạt Transaction: tạo `Block`, xóa `Friendship` (nếu có), hủy toàn bộ lời mời đang chờ giữa hai người.
7. `BLOCKED` ➔ `NONE`: Khi người chặn gọi `DELETE /api/friends/blocks/:targetUserId`.

---

## 3. Kiến Trúc Backend (API & Real-time Socket.IO)

### 3.1. Danh mục REST Endpoints (`/api/friends`)

Mọi endpoint đều yêu cầu Middleware xác thực `requireAuth` và kiểm tra Zod Schema hợp lệ:

1. `POST /api/friends/requests`
   - **Mục đích**: Gửi lời mời kết bạn mới.
   - **Body**: `{ receiverId: string, note?: string }`.
   - **Xử lý**: Kiểm tra không tự gửi, receiver tồn tại, chưa bị chặn, chưa là bạn, chưa có request pending.
   - **Phản hồi**: `201 Created` kèm bản ghi `friendRequest`.
   - **Socket**: Gửi sự kiện `friend:request_received` tới room `user:${receiverId}`.
2. `POST /api/friends/requests/:requestId/accept`
   - **Mục đích**: Chấp nhận lời mời kết bạn.
   - **Params**: `requestId` (24-hex ObjectId).
   - **Xử lý**: Kiểm tra quyền nhận, trạng thái `PENDING`. Dùng MongoDB Transaction cập nhật `ACCEPTED` và tạo `Friendship`.
   - **Phản hồi**: `200 OK` kèm thông tin bạn bè mới.
   - **Socket**: Gửi sự kiện `friend:request_accepted` tới room `user:${senderId}`.
3. `POST /api/friends/requests/:requestId/reject`
   - **Mục đích**: Từ chối lời mời kết bạn nhận được.
   - **Params**: `requestId` (24-hex ObjectId).
   - **Xử lý**: Cập nhật trạng thái lời mời sang `REJECTED`.
   - **Phản hồi**: `200 OK`.
   - **Socket**: Gửi sự kiện `friend:request_rejected` tới room `user:${senderId}`.
4. `DELETE /api/friends/requests/:requestId/cancel`
   - **Mục đích**: Người gửi hủy lời mời đã gửi đi.
   - **Params**: `requestId` (24-hex ObjectId).
   - **Xử lý**: Cập nhật trạng thái lời mời sang `CANCELED`.
   - **Phản hồi**: `200 OK`.
   - **Socket**: Gửi sự kiện `friend:request_canceled` tới room `user:${receiverId}`.
5. `DELETE /api/friends/:targetUserId`
   - **Mục đích**: Hủy quan hệ bạn bè (Unfriend).
   - **Params**: `targetUserId` (24-hex ObjectId).
   - **Xử lý**: Kiểm tra đang là bạn bè, xóa bản ghi trong bảng `friends`.
   - **Phản hồi**: `200 OK`.
   - **Socket**: Gửi sự kiện `friend:removed` tới room `user:${targetUserId}`.
6. `POST /api/friends/blocks/:targetUserId`
   - **Mục đích**: Chặn một người dùng.
   - **Params**: `targetUserId` (24-hex ObjectId).
   - **Xử lý**: Transaction tạo `Block`, xóa `Friendship`, hủy các request pending 2 chiều.
   - **Phản hồi**: `201 Created`.
   - **Socket**: Gửi sự kiện `friend:blocked` tới room `user:${targetUserId}`.
7. `DELETE /api/friends/blocks/:targetUserId`
   - **Mục đích**: Bỏ chặn người dùng.
   - **Params**: `targetUserId` (24-hex ObjectId).
   - **Xử lý**: Xóa bản ghi trong bảng `blocks`.
   - **Phản hồi**: `200 OK`.
8. `GET /api/friends/status/:targetUserId`
   - **Mục đích**: Tra cứu trạng thái quan hệ 2 chiều chi tiết (`status`, `requestId`).
   - **Phản hồi**: `200 OK` `{ targetUserId, status, requestId? }`.
9. `GET /api/friends`
   - **Mục đích**: Lấy danh sách bạn bè (hỗ trợ tìm kiếm từ khóa `q`, lọc `online`, phân trang).
10. `GET /api/friends/requests/received`
    - **Mục đích**: Lấy danh sách lời mời nhận được đang chờ duyệt.
11. `GET /api/friends/requests/sent`
    - **Mục đích**: Lấy danh sách lời mời đã gửi đi đang chờ đối phương duyệt.
12. `GET /api/friends/blocks`
    - **Mục đích**: Lấy danh sách những người dùng bị người này chặn.

---

## 4. Kiến Trúc Frontend (Store & Components)

### 4.1. Zustand Store chuyên trách (`friend.store.ts`)
Tập trung hóa toàn bộ dữ liệu và logic xử lý bạn bè:
- **State**:
  - `friends: User[]`: Danh sách bạn bè hiện tại.
  - `receivedRequests: FriendRequestItem[]`: Danh sách lời mời nhận được.
  - `sentRequests: FriendRequestItem[]`: Danh sách lời mời đã gửi.
  - `blockedUsers: BlockedUserItem[]`: Danh sách người bị chặn.
  - `activeTab: "online" | "all" | "pending" | "blocked" | "add"`: Tab đang kích hoạt.
  - `isLoading: boolean`: Trạng thái tải dữ liệu.
- **Actions**:
  - `fetchFriends()`, `fetchReceivedRequests()`, `fetchSentRequests()`, `fetchBlockedUsers()`.
  - `sendFriendRequest(targetUserId, note?)`.
  - `acceptFriendRequest(requestId)`.
  - `rejectFriendRequest(requestId)`.
  - `cancelFriendRequest(requestId)`.
  - `removeFriend(targetUserId)`.
  - `blockUser(targetUserId)`, `unblockUser(targetUserId)`.
  - `setActiveTab(tab)`.
- **Socket Listeners**: Tự động đăng ký lắng nghe các sự kiện socket từ backend để cập nhật danh sách tức thì.

### 4.2. Thành phần giao diện (UI Components)

1. **`FriendsView.tsx` (Màn hình Trung tâm Bạn bè)**:
   - Được gắn vào khung hiển thị chính khi người dùng chọn tab "Bạn bè" trên thanh Sidebar.
   - **Header**: Tab navigation xúc giác kiểu Discord (Trực tuyến, Tất cả, Đang chờ, Đã chặn, Thêm bạn màu xanh nổi bật).
   - **Tab Trực tuyến / Tất cả**:
     - Thanh tìm kiếm bạn bè nhanh.
     - Danh sách bạn bè với ảnh đại diện, tên, trạng thái, nút "Nhắn tin" và menu 3 chấm (Hủy bạn bè, Chặn).
   - **Tab Đang chờ**:
     - Nhóm lời mời nhận được (có 2 nút Đồng ý / Từ chối).
     - Nhóm lời mời đã gửi (có nút Hủy lời mời).
   - **Tab Đã chặn**:
     - Danh sách người bị chặn kèm nút Bỏ chặn.
   - **Tab Thêm bạn**:
     - Ô nhập username đối phương và lời nhắn, nút gửi yêu cầu với phản hồi trực quan.
2. **Cập nhật `FullUserProfileModal.tsx`**:
   - Khi `PENDING_RECEIVED`: Hiển thị cả 2 nút **"Chấp nhận"** và **"Từ chối"**.
   - Khi `FRIENDS`: Menu 3 chấm có thêm nút **"Hủy kết bạn"** kèm hộp thoại xác nhận (Confirm Dialog).
3. **Cập nhật `NotificationListModal.tsx`**:
   - Khi hiển thị thông báo loại `FRIEND_REQUEST_RECEIVED`: Cung cấp 2 nút bấm thao tác nhanh **"Chấp nhận"** và **"Từ chối"** trực tiếp trên hàng thông báo.
4. **Cập nhật `ChatLayout.tsx` & `ConversationSidebar.tsx`**:
   - Điều hướng mượt mà giữa Chế độ xem Cuộc trò chuyện (`activeConversationId`) và Chế độ xem Bạn bè (`FriendsView`).

---

## 5. Chiến lược Kiểm thử & Đảm bảo Chất lượng (Testing Strategy)

1. **Backend Integration Tests (`tests/friend.test.ts`)**:
   - Kiểm tra trọn vẹn luồng gửi, hủy, từ chối, chấp nhận, hủy bạn bè, chặn và bỏ chặn.
   - Kiểm tra ràng buộc Transaction: Chặn phải tự động hủy bạn và hủy request pending.
   - Đảm bảo 100% test suites hiện tại và mới đều đạt `PASS`.
2. **Frontend Build & Logic Verification**:
   - Đảm bảo `tsc -b && vite build` hoàn thành không có bất kỳ lỗi kiểu dữ liệu nào.
   - Kiểm tra tính xúc giác Neo-Brutalist, khả năng tương thích chủ đề Sáng/Tối và độ tương phản WCAG.
