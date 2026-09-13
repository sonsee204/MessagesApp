# Tài liệu thiết kế hệ thống Thông báo (Notification System Design Specification)

> **Ngày lập**: 13/09/2026  
> **Trạng thái**: Bản thảo đã duyệt kiến trúc (Approved Design)  
> **Tác giả**: Claude Code Architect  
> **Phạm vi**: Backend Express.js/MongoDB + WebSocket Socket.IO + Frontend React / ConversationSidebar

---

## 1. Tổng quan và Mục tiêu (Overview & Goals)

### 1.1 Mục tiêu nghiệp vụ
Hệ thống Thông báo (Notification Subsystem) nhằm cung cấp cho người dùng trải nghiệm nhận diện các biến động xã hội và hoạt động tương tác trong ứng dụng nhắn tin một cách tức thời (Real-time) và bền vững (Persistent):
- Nhận thông báo khi có người gửi lời mời kết bạn mới (`FRIEND_REQUEST_RECEIVED`).
- Nhận thông báo khi đối phương chấp thuận lời mời kết bạn (`FRIEND_REQUEST_ACCEPTED`).
- Nhận thông báo khi được nhắc tên (mention) trong cuộc trò chuyện nhóm (`MESSAGE_MENTION`).
- Nhận thông báo cảnh báo và thông tin từ hệ thống quản trị (`SYSTEM_ALERT`).
- Xem lại lịch sử thông báo có phân trang, đánh dấu đã đọc một mục hoặc tất cả mục, và xóa thông báo.

### 1.2 Ràng buộc kỹ thuật & Tiêu chuẩn
- **Kiến trúc phân tầng chuẩn**: Controller (HTTP/REST) ──> Service (Business Logic) ──> Repository (Data Access via Mongoose).
- **Socket.IO Gateway**: Bắn sự kiện real-time `notification:new` trực tiếp đến room cá nhân `user:<userId>`.
- **Zero-Trust Input**: Mọi query parameters và request body đều được kiểm tra bằng Zod Schema.
- **Tiêu chuẩn kiểm thử**: Tối thiểu 100% các nhánh nghiệp vụ được bao phủ bởi Unit Test và Integration Test (Vitest + Supertest).
- **Chú thích tiếng Việt**: Mọi mã nguồn tạo mới hoặc cập nhật bắt buộc kèm chú thích bằng tiếng Việt.

---

## 2. Kiến trúc dữ liệu (Data Architecture & Schema)

### 2.1 Collection: `notifications`
Mỗi thông báo là một tài liệu trong collection `notifications` thuộc cơ sở dữ liệu MongoDB.

#### TypeScript Interface (`INotification`):
```typescript
import { Document, Types } from "mongoose";

/**
 * Các loại thông báo được hỗ trợ trong hệ thống:
 * - FRIEND_REQUEST_RECEIVED: Nhận lời mời kết bạn mới
 * - FRIEND_REQUEST_ACCEPTED: Lời mời kết bạn đã được đối phương đồng ý
 * - MESSAGE_MENTION: Được nhắc tên trong tin nhắn cuộc trò chuyện
 * - SYSTEM_ALERT: Cảnh báo hoặc thông báo từ hệ thống quản trị
 */
export type NotificationType =
  | "FRIEND_REQUEST_RECEIVED"
  | "FRIEND_REQUEST_ACCEPTED"
  | "MESSAGE_MENTION"
  | "SYSTEM_ALERT";

export interface INotificationData {
  conversationId?: string;
  messageId?: string;
  friendRequestId?: string;
  url?: string;
}

export interface INotification extends Document {
  recipientId: Types.ObjectId;     // Người nhận thông báo (Bắt buộc)
  senderId?: Types.ObjectId;       // Người khởi phát hành động (Tuỳ chọn)
  type: NotificationType;          // Loại thông báo
  title: string;                   // Tiêu đề ngắn gọn (Tối đa 100 ký tự)
  content: string;                 // Nội dung thông báo chi tiết (Tối đa 500 ký tự)
  data?: INotificationData;        // Dữ liệu metadata phục vụ điều hướng (JSON object)
  isRead: boolean;                 // Trạng thái đã đọc (Mặc định false)
  readAt?: Date | null;            // Thời điểm đánh dấu đã đọc
  createdAt: Date;
  updatedAt: Date;
}
```

#### Mongoose Schema Definition:
```typescript
const NotificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "FRIEND_REQUEST_RECEIVED",
        "FRIEND_REQUEST_ACCEPTED",
        "MESSAGE_MENTION",
        "SYSTEM_ALERT",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    data: {
      conversationId: { type: String, default: null },
      messageId: { type: String, default: null },
      friendRequestId: { type: String, default: null },
      url: { type: String, default: null },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index: Tối ưu hoá truy vấn lấy danh sách thông báo của người dùng sắp xếp mới nhất
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
// Compound Index: Tối ưu hoá đếm số lượng thông báo chưa đọc
NotificationSchema.index({ recipientId: 1, isRead: 1 });
```

---

## 3. Thiết kế REST API Endpoints (`/api/notifications`)

Tất cả các endpoint đều yêu cầu xác thực qua `requireAuth` Middleware (JWT Access Token hoặc Signed Session Cookie).

### 3.1 `GET /api/notifications`
- **Mục đích**: Lấy danh sách thông báo của tài khoản hiện tại kèm số lượng chưa đọc.
- **Query Parameters**:
  - `page`: Số trang (Số nguyên dương, mặc định `1`).
  - `limit`: Số lượng mỗi trang (Số nguyên từ `1` đến `50`, mặc định `20`).
  - `unreadOnly`: Chỉ lấy thông báo chưa đọc (`true` | `false`, mặc định `false`).
- **Mã phản hồi thành công**: `200 OK`
- **Định dạng dữ liệu trả về**:
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "67341234567890abcdef1234",
        "type": "FRIEND_REQUEST_RECEIVED",
        "title": "Lời mời kết bạn mới",
        "content": "nguyenvana đã gửi cho bạn một lời mời kết bạn.",
        "sender": {
          "id": "67341234567890abcdef1111",
          "username": "nguyenvana",
          "displayName": "Nguyễn Văn A",
          "avatarUrl": "https://.../avatar.webp"
        },
        "data": {
          "friendRequestId": "67341234567890abcdef2222"
        },
        "isRead": false,
        "readAt": null,
        "createdAt": "2026-09-13T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    },
    "unreadCount": 1
  }
}
```

### 3.2 `PATCH /api/notifications/:id/read`
- **Mục đích**: Đánh dấu một thông báo cụ thể là đã đọc.
- **Ràng buộc**: Người dùng chỉ được sửa thông báo của chính mình (`recipientId === req.user.id`). Nếu không tìm thấy hoặc không đúng chủ sở hữu -> `404 NOT_FOUND`.
- **Mã phản hồi thành công**: `200 OK`
- **Định dạng phản hồi**:
```json
{
  "success": true,
  "data": {
    "id": "67341234567890abcdef1234",
    "isRead": true,
    "readAt": "2026-09-13T10:05:00.000Z"
  }
}
```

### 3.3 `PATCH /api/notifications/read-all`
- **Mục đích**: Đánh dấu tất cả thông báo chưa đọc của người dùng hiện tại thành đã đọc.
- **Mã phản hồi thành công**: `200 OK`
- **Định dạng phản hồi**:
```json
{
  "success": true,
  "data": {
    "updatedCount": 5
  }
}
```

### 3.4 `DELETE /api/notifications/:id`
- **Mục đích**: Xóa vĩnh viễn một thông báo khỏi danh sách.
- **Ràng buộc**: Phải đúng chủ sở hữu `recipientId`.
- **Mã phản hồi thành công**: `200 OK`
```json
{
  "success": true,
  "message": "Đã xóa thông báo thành công."
}
```

---

## 4. Tích hợp Real-time WebSocket (Socket.IO)

### 4.1 Room Architecture
Khi socket client kết nối và xác thực thành công, server sẽ tự động cho socket join vào room cá nhân của user:
```typescript
socket.join(`user:${user.id}`);
```

### 4.2 Events
1. **`notification:new`** (Server -> Client):
   - Kích hoạt khi có thông báo mới tạo ra.
   - Payload: Bản ghi thông báo hoàn chỉnh (kèm thông tin sender populated).
2. **`notification:read`** (Server -> Client):
   - Kích hoạt khi thông báo được đánh dấu đã đọc từ một thiết bị khác của cùng user, giúp đồng bộ số lượng unread badge ngay lập tức.
   - Payload: `{ notificationId: string }` hoặc `{ all: true }`.

---

## 5. Tích hợp với các Module nghiệp vụ hiện có

1. **FriendService (`sendFriendRequest`)**:
   - Sau khi tạo bản ghi `friend_requests`, gọi `NotificationService.createNotification(...)` cho `receiverId`.
2. **FriendService (`acceptFriendRequest`)**:
   - Khi người nhận đồng ý, gửi thông báo `FRIEND_REQUEST_ACCEPTED` ngược lại cho người gửi lời mời ban đầu (`senderId`).
3. **MessageService (`createMessage`)**:
   - Quét nội dung tin nhắn tìm regex `@username`. Với các user được mention thuộc hội thoại, gửi thông báo `MESSAGE_MENTION`.

---

## 6. Chiến lược kiểm thử tự động (Testing Strategy)

1. **Unit Tests**:
   - `tests/schemas/notification.schema.test.ts`: Validate Zod Schema (pagination limits, ObjectId validation).
   - `tests/models/notification.model.test.ts`: Kiểm tra Schema constraints, required fields, indexes.
   - `tests/services/notification.service.test.ts`: Kiểm thử business rules, isolation người dùng, tính toán unreadCount.
2. **Integration Tests (`tests/notification.test.ts`)**:
   - Kiểm tra toàn diện chu kỳ REST API với Supertest (Auth guard, lấy danh sách, đánh dấu 1 mục, đánh dấu tất cả, xoá mục).
   - Kiểm tra bảo mật: Ngăn chặn User A đọc hoặc đánh dấu đã đọc thông báo của User B.

---

## 7. Kế hoạch chia pha triển khai (Phased Implementation Roadmap)

- **Giai đoạn 1**: Schema, Model, Zod Schemas và Repository (`backend/src/models/notification.model.ts`, `backend/src/repositories/notification.repository.ts`).
- **Giai đoạn 2**: Notification Service & Unit Tests (`backend/src/services/notification.service.ts`).
- **Giai đoạn 3**: Controller, Routes, OpenAPI Docs và Integration Tests (`backend/src/controllers/notification.controller.ts`, `backend/src/routes/notification.routes.ts`).
- **Giai đoạn 4**: Tích hợp gọi tạo thông báo tự động từ `FriendService` & Socket.IO emitter.
- **Giai đoạn 5**: Frontend Client Store (`notification.store.ts`), API Client Service và UI Popover/Drawer khi bấm nút Thông báo ở `ConversationSidebar`.
