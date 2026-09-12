# Thiết kế Kiến trúc & Chi tiết Kỹ thuật: Friend APIs

> **Ngày**: 2026-09-12  
> **Trạng thái**: Approved (Drafted from Brainstorming)  
> **Phạm vi**: Backend API Layer (`backend/src/`)  
> **Công nghệ**: Express.js + TypeScript + MongoDB (Mongoose) + Socket.IO + Zod

---

## 1. Mục tiêu và Phạm vi
Xây dựng hệ thống RESTful API hoàn chỉnh quản lý quan hệ bạn bè và tương tác thời gian thực:
1. **Lời mời kết bạn (`FriendRequest`)**: Gửi lời mời, chấp nhận, từ chối, hủy lời mời, xem danh sách lời mời đã gửi và nhận được (phân trang).
2. **Quan hệ bạn bè (`Friend`)**: Xem danh sách bạn bè (phân trang, lọc online, tìm kiếm tên), hủy kết bạn (`Unfriend`), kiểm tra trạng thái quan hệ giữa 2 người dùng.
3. **Chặn người dùng (`Block`)**: Chặn tài khoản, bỏ chặn, xem danh sách người dùng đã chặn.
4. **Thời gian thực (`Socket.IO`)**: Phát sự kiện tức thì tới phòng cá nhân `user:<userId>` khi có biến động về trạng thái bạn bè.

---

## 2. Kiến Trúc Phân Tầng (Layered Architecture)

Tuân thủ nghiêm ngặt chuẩn kiến trúc tại `rules/backend.md`:

```
[HTTP Request] / [Socket.IO Event]
          │
          ▼
   [Auth Middleware (requireAuth)]
          │
          ▼
 [Validation Middleware (validate(ZodSchema))]
          │
          ▼
    [FriendController]  <── Trích xuất params/query/body/req.user, trả response chuẩn
          │
          ▼
     [FriendService]    <── Logic nghiệp vụ, kiểm tra chặn, điều phối Transactions & Socket
          │
          ▼
  [Repositories]       <── Truy xuất DB qua Mongoose Models
  ├── FriendRequestRepository
  ├── FriendRepository
  └── BlockRepository
```

### 2.1. Tầng Repository
- `friend-request.repository.ts`:
  - `create(data)`: Tạo lời mời mới.
  - `findById(id)`: Lấy chi tiết lời mời.
  - `findPending(senderId, receiverId)`: Tìm lời mời đang chờ giữa 2 người.
  - `updateStatus(id, status, respondedAt, session?)`: Cập nhật trạng thái lời mời.
  - `findReceived(receiverId, { page, limit })`: Lấy danh sách lời mời nhận được (populate `senderId`).
  - `findSent(senderId, { page, limit })`: Lấy danh sách lời mời đã gửi (populate `receiverId`).
  - `cancelPendingBetween(user1, user2, session?)`: Hủy mọi lời mời pending giữa 2 user.
- `friend.repository.ts`:
  - `createFriendship(userA, userB, friendRequestId?, session?)`: Tạo quan hệ bạn bè 2 chiều.
  - `isFriend(user1, user2)`: Kiểm tra 2 user đã là bạn bè chưa (dùng `normalizeFriendIds`).
  - `removeFriendship(user1, user2, session?)`: Xóa quan hệ bạn bè giữa 2 người.
  - `findFriends(userId, { page, limit, search, onlineOnly })`: Truy vấn danh sách bạn bè kết hợp `$lookup` sang `users` để phân trang và tìm kiếm.
  - `countFriends(userId)`: Đếm tổng số bạn bè.
- `block.repository.ts`:
  - `createBlock(blockerId, blockedId, session?)`: Chặn người dùng.
  - `removeBlock(blockerId, blockedId)`: Bỏ chặn người dùng.
  - `isBlocked(user1, user2)`: Kiểm tra xem có bất kỳ chiều chặn nào giữa 2 người không (`user1` chặn `user2` HOẶC `user2` chặn `user1`).
  - `isBlockedBy(blockerId, blockedId)`: Kiểm tra cụ thể xem `blockerId` có chặn `blockedId` không.
  - `findBlockedUsers(blockerId, { page, limit })`: Lấy danh sách người dùng bị chặn (populate `blockedId`).

### 2.2. Tầng Service (`friend.service.ts`)
Độc lập với `req`/`res`, nhận typed DTOs và trả về domain data:
- `sendFriendRequest(senderId, receiverId, note)`
- `acceptFriendRequest(userId, requestId)`: Sử dụng `mongoose.startSession()` và `withTransaction()`.
- `rejectFriendRequest(userId, requestId)`
- `cancelFriendRequest(userId, requestId)`
- `getReceivedRequests(userId, pagination)`
- `getSentRequests(userId, pagination)`
- `getFriends(userId, query)`
- `removeFriend(userId, targetUserId)`
- `getRelationshipStatus(userId, targetUserId)`
- `blockUser(blockerId, blockedId)`: Sử dụng Transaction để chặn, xóa bạn bè nếu có, và hủy lời mời pending.
- `unblockUser(blockerId, blockedId)`
- `getBlockedUsers(blockerId, pagination)`

### 2.3. Tầng Controller (`friend.controller.ts`)
Tiếp nhận HTTP request, áp dụng HTTP status code chuẩn:
- `200 OK`: Truy vấn danh sách, cập nhật, chấp nhận, từ chối, bỏ chặn thành công.
- `201 Created`: Gửi lời mời kết bạn, chặn người dùng thành công.
- `204 No Content`: Không dùng, luôn trả về JSON nhất quán `{ success: true, data: ... }`.
- `400 Bad Request`: Lỗi validation (tự kết bạn với chính mình, param ID sai định dạng).
- `401 Unauthorized`: Chưa đăng nhập hoặc token không hợp lệ.
- `403 Forbidden`: Bị chặn không thể tương tác, hoặc không có quyền thao tác trên lời mời của người khác.
- `404 Not Found`: Không tìm thấy lời mời kết bạn hoặc người dùng mục tiêu.
- `409 Conflict`: Đã là bạn bè hoặc đang có lời mời kết bạn chờ xử lý.

---

## 3. Chi Tiết Endpoints API (`/api/friends`)

Tất cả các endpoint đều yêu cầu Header: `Authorization: Bearer <access_token>`.

### 3.1. Lời Mời Kết Bạn (Friend Requests)

#### `POST /api/friends/requests`
- **Mô tả**: Gửi lời mời kết bạn đến người dùng khác.
- **Request Body**:
  ```json
  {
    "receiverId": "65f1a2b3c4d5e6f7a8b9c0d1",
    "note": "Chào bạn, mình cùng tham gia nhóm lập trình!"
  }
  ```
- **Validation**:
  - `receiverId`: Chuỗi ObjectId 24 ký tự hợp lệ, khác `req.user.userId`.
  - `note`: Tối đa 200 ký tự (optional).
- **Quy tắc nghiệp vụ**:
  1. Nếu `receiverId == senderId` -> `400 Bad Request` (`CANNOT_FRIEND_SELF`).
  2. Người nhận phải tồn tại trong CSDL -> `404 Not Found` (`USER_NOT_FOUND`).
  3. Kiểm tra chặn 2 chiều (`isBlocked`) -> `403 Forbidden` (`USER_BLOCKED`).
  4. Kiểm tra đã là bạn bè (`isFriend`) -> `409 Conflict` (`ALREADY_FRIENDS`).
  5. Kiểm tra lời mời gửi đi đang `PENDING` -> `409 Conflict` (`REQUEST_ALREADY_SENT`).
  6. Kiểm tra đối phương đã gửi lời mời `PENDING` cho mình -> `409 Conflict` (`REQUEST_RECEIVED_PENDING` - kèm gợi ý chấp nhận lời mời đối phương).
- **Response 201 Created**:
  ```json
  {
    "success": true,
    "data": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d2",
      "senderId": "65f1a2b3c4d5e6f7a8b9c000",
      "receiverId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "status": "PENDING",
      "note": "Chào bạn, mình cùng tham gia nhóm lập trình!",
      "createdAt": "2026-09-12T10:00:00.000Z"
    }
  }
  ```
- **Socket Emit**: `io.to("user:" + receiverId).emit("friend:request_received", requestData)`

#### `GET /api/friends/requests/received`
- **Mô tả**: Lấy danh sách lời mời kết bạn nhận được đang chờ duyệt.
- **Query Params**: `page` (default 1), `limit` (default 20, max 100).
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "...",
          "note": "...",
          "createdAt": "...",
          "sender": {
            "id": "...",
            "username": "sonsee",
            "displayName": "Sơn",
            "avatarUrl": "...",
            "isOnline": true
          }
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

#### `GET /api/friends/requests/sent`
- **Mô tả**: Lấy danh sách lời mời kết bạn người dùng đã gửi đi đang chờ đối phương duyệt.
- **Query Params**: `page` (default 1), `limit` (default 20, max 100).
- **Response 200 OK**: Cấu trúc tương tự, populate thông tin `receiver`.

#### `POST /api/friends/requests/:requestId/accept`
- **Mô tả**: Chấp nhận lời mời kết bạn.
- **Params**: `requestId` (24 ký tự hex).
- **Quy tắc nghiệp vụ**:
  1. Lời mời phải tồn tại và `receiverId == req.user.userId` -> Nếu không: `404` hoặc `403`.
  2. Trạng thái lời mời phải là `PENDING` -> Nếu khác: `400 Bad Request` (`REQUEST_NOT_PENDING`).
  3. Bọc trong Transaction:
     - Đổi `status` thành `ACCEPTED`, gán `respondedAt: new Date()`.
     - Tạo bản ghi `Friend` với `normalizeFriendIds(senderId, receiverId)`.
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "data": {
      "friendshipId": "...",
      "friend": {
        "id": "...",
        "username": "...",
        "displayName": "...",
        "avatarUrl": "...",
        "isOnline": true
      },
      "acceptedAt": "..."
    }
  }
  ```
- **Socket Emit**: `io.to("user:" + senderId).emit("friend:request_accepted", data)`

#### `POST /api/friends/requests/:requestId/reject`
- **Mô tả**: Từ chối lời mời kết bạn.
- **Params**: `requestId`.
- **Quy tắc**: Phải là người nhận và trạng thái đang `PENDING`. Cập nhật `status: "REJECTED"`, `respondedAt: new Date()`.
- **Response 200 OK**: `{ "success": true, "message": "Đã từ chối lời mời kết bạn" }`

#### `DELETE /api/friends/requests/:requestId/cancel`
- **Mô tả**: Hủy lời mời kết bạn do chính mình gửi đi.
- **Params**: `requestId`.
- **Quy tắc**: Phải là người gửi (`senderId == req.user.userId`) và trạng thái đang `PENDING`. Cập nhật `status: "CANCELED"`.
- **Response 200 OK**: `{ "success": true, "message": "Đã hủy lời mời kết bạn" }`

---

### 3.2. Quản Lý Bạn Bè (Friends)

#### `GET /api/friends`
- **Mô tả**: Lấy danh sách bạn bè của người dùng hiện tại.
- **Query Params**:
  - `page`: số nguyên >= 1 (default 1).
  - `limit`: số nguyên từ 1 đến 100 (default 20).
  - `search`: chuỗi tìm kiếm theo `displayName` hoặc `username` (optional).
  - `onlineOnly`: boolean lọc người đang online (optional, default false).
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "friendshipId": "...",
          "friendSince": "2026-09-12T10:05:00.000Z",
          "user": {
            "id": "...",
            "username": "alex",
            "displayName": "Alex",
            "avatarUrl": "...",
            "bio": "...",
            "isOnline": true,
            "lastSeenAt": "..."
          }
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 15,
        "totalPages": 1
      }
    }
  }
  ```

#### `DELETE /api/friends/:targetUserId`
- **Mô tả**: Hủy kết bạn (Unfriend) với người dùng mục tiêu.
- **Params**: `targetUserId`.
- **Quy tắc**: Xóa bản ghi trong `FriendModel` theo cặp `normalizeFriendIds(req.user.userId, targetUserId)`.
- **Response 200 OK**: `{ "success": true, "message": "Đã hủy kết bạn thành công" }`
- **Socket Emit**: `io.to("user:" + targetUserId).emit("friend:removed", { userId: req.user.userId })`

#### `GET /api/friends/status/:targetUserId`
- **Mô tả**: Kiểm tra quan hệ bạn bè hiện tại giữa tài khoản đăng nhập và tài khoản mục tiêu.
- **Params**: `targetUserId`.
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "data": {
      "targetUserId": "...",
      "status": "FRIENDS" // "NONE" | "PENDING_SENT" | "PENDING_RECEIVED" | "FRIENDS" | "BLOCKED"
    }
  }
  ```

---

### 3.3. Chặn & Bỏ Chặn (Block Management)

#### `POST /api/friends/blocks/:targetUserId`
- **Mô tả**: Chặn một người dùng.
- **Params**: `targetUserId`.
- **Quy tắc nghiệp vụ (Transaction)**:
  1. Không thể tự chặn chính mình -> `400 Bad Request`.
  2. Tạo bản ghi trong `BlockModel`.
  3. Nếu đang là bạn bè -> tự động xóa bản ghi trong `FriendModel`.
  4. Nếu có lời mời `PENDING` giữa 2 người -> chuyển thành `CANCELED`.
- **Response 201 Created**: `{ "success": true, "message": "Đã chặn người dùng thành công" }`
- **Socket Emit**: `io.to("user:" + targetUserId).emit("friend:blocked", { blockerId: req.user.userId })`

#### `DELETE /api/friends/blocks/:targetUserId`
- **Mô tả**: Bỏ chặn một người dùng.
- **Params**: `targetUserId`.
- **Quy tắc**: Xóa bản ghi trong `BlockModel` nơi `blockerId == req.user.userId` và `blockedId == targetUserId`.
- **Response 200 OK**: `{ "success": true, "message": "Đã bỏ chặn người dùng thành công" }`

#### `GET /api/friends/blocks`
- **Mô tả**: Lấy danh sách người dùng đang bị tài khoản hiện tại chặn.
- **Query Params**: `page`, `limit`.
- **Response 200 OK**: Danh sách users kèm thông tin phân trang.

---

## 4. Ràng Buộc Kiểm Thử (Testing Strategy)
- Kiểm thử đơn vị cho Repositories (`friend.repository.test.ts`, `friend-request.repository.test.ts`, `block.repository.test.ts`).
- Kiểm thử nghiệp vụ Service (`friend.service.test.ts`) bao gồm mocking DB transactions và edge cases (chặn, tự kết bạn, gửi trùng).
- Kiểm thử tích hợp End-to-end API (`tests/friend.test.ts`) kiểm tra toàn diện các status code, middleware authentication, và validation headers/body.
