# Thiết kế Kiến trúc Data Models: Friend, Message, FriendRequest, Block

> **Ngày**: 2026-09-12  
> **Trạng thái**: Approved (Drafted from Brainstorming)  
> **Phạm vi**: Backend Data Layer (`backend/src/models/`)  
> **Công nghệ**: Express.js + TypeScript + MongoDB (Mongoose)

---

## 1. Mục tiêu và Phạm vi
Thiết kế và chuẩn hóa hệ thống Data Models cho ứng dụng nhắn tin thời gian thực:
- Mở rộng model `Message` hỗ trợ reply, soft delete (thu hồi), và đính kèm đa phương tiện (`attachments`).
- Xây dựng model `FriendRequest` quản lý vòng đời lời mời kết bạn (Pending, Accepted, Rejected, Canceled) kèm ghi chú.
- Xây dựng model `Friend` tối ưu hóa quan hệ bạn bè 2 chiều với compound unique index chuẩn hóa.
- Xây dựng model `Block` hỗ trợ cơ chế chặn người dùng, tích hợp kiểm tra trước khi gửi yêu cầu kết bạn.

---

## 2. Chi tiết Data Models & Schema

### 2.1. Model `Message` (`backend/src/models/message.model.ts`)
Mở rộng từ schema hiện tại:

```typescript
export interface IAttachment {
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content?: string;
  type: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
  attachments: IAttachment[];
  replyToMessageId?: Types.ObjectId | null;
  readBy: Types.ObjectId[];
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Quy tắc Schema & Validation**:
- `conversationId`: `ObjectId`, ref: `"Conversation"`, required, index: true.
- `senderId`: `ObjectId`, ref: `"User"`, required, index: true.
- `content`: `string`, trim: true, maxlength: 5000, optional (bắt buộc nếu `attachments` rỗng).
- `type`: `enum: ["TEXT", "IMAGE", "FILE", "SYSTEM"]`, default: `"TEXT"`.
- `attachments`: Mảng subdocuments `{ url, name, size, mimeType }`, default: `[]`.
- `replyToMessageId`: `ObjectId`, ref: `"Message"`, default: `null`.
- `readBy`: `[ObjectId]`, ref: `"User"`, default: `[]`.
- `isDeleted`: `boolean`, default: `false`, index: true.
- `deletedAt`: `Date`, default: `null`.
- `timestamps`: `true`.

**Indexes**:
- Phân trang tin nhắn cursor-based: `{ conversationId: 1, createdAt: -1 }`.
- Lọc tin nhắn chưa đọc: `{ conversationId: 1, readBy: 1 }`.

---

### 2.2. Model `FriendRequest` (`backend/src/models/friend-request.model.ts`)
Quản lý trạng thái và luồng gửi/nhận lời mời kết bạn:

```typescript
export type FriendRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED";

export interface IFriendRequest extends Document {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  status: FriendRequestStatus;
  note?: string;
  respondedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Quy tắc Schema & Validation**:
- `senderId`: `ObjectId`, ref: `"User"`, required, index: true.
- `receiverId`: `ObjectId`, ref: `"User"`, required, index: true.
- `status`: `enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELED"]`, default: `"PENDING"`, index: true.
- `note`: `string`, trim: true, maxlength: 200, default: `""`.
- `respondedAt`: `Date`, default: `null`.
- `timestamps`: `true`.

**Indexes**:
- Ràng buộc duy nhất cho yêu cầu đang chờ: `{ senderId: 1, receiverId: 1 }` với partial filter `{ status: "PENDING" }` (ngăn gửi trùng nhiều lời mời chờ nhưng cho phép gửi lại sau khi từ chối hoặc hủy).
- Truy vấn danh sách lời mời nhận được: `{ receiverId: 1, status: 1, createdAt: -1 }`.
- Truy vấn danh sách lời mời đã gửi đi: `{ senderId: 1, status: 1, createdAt: -1 }`.

---

### 2.3. Model `Friend` (`backend/src/models/friend.model.ts`)
Quản lý danh sách bạn bè đã thiết lập quan hệ 2 chiều:

```typescript
export interface IFriend extends Document {
  userA: Types.ObjectId;
  userB: Types.ObjectId;
  friendRequestId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Quy tắc Chuẩn Hóa**:
- Để tránh lưu 2 bản ghi đảo ngược (`user1 -> user2` và `user2 -> user1`), hệ thống chuẩn hóa bằng quy tắc chuỗi:
  `userA` luôn là ID có giá trị chuỗi nhỏ hơn `userB` (`userA.toString() < userB.toString()`).
- Khi tạo quan hệ bạn bè:
  ```typescript
  const [userA, userB] = [userId1, userId2].sort((a, b) =>
    a.toString().localeCompare(b.toString())
  );
  ```

**Indexes**:
- Compound Unique Index: `{ userA: 1, userB: 1 }` (unique: true).
- Truy vấn bạn bè của một user: `{ userA: 1, createdAt: -1 }` và `{ userB: 1, createdAt: -1 }`.

---

### 2.4. Model `Block` (`backend/src/models/block.model.ts`)
Quản lý danh sách chặn người dùng:

```typescript
export interface IBlock extends Document {
  blockerId: Types.ObjectId;
  blockedId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- Compound Unique Index: `{ blockerId: 1, blockedId: 1 }` (unique: true).
- Kiểm tra trạng thái bị chặn: `{ blockedId: 1, blockerId: 1 }`.

---

## 3. Ràng Buộc Toàn Vẹn & Giao Dịch Dữ Liệu (Transactions)

### 3.1. Luồng Gửi Lời Mời Kết Bạn
1. **Validation Input**: Kiểm tra `receiverId` khác `senderId`.
2. **Kiểm Tra Chặn**: Truy vấn `BlockModel` kiểm tra 2 chiều (`senderId` chặn `receiverId` hoặc ngược lại). Nếu có -> Báo lỗi `403 Forbidden` (`USER_BLOCKED`).
3. **Kiểm Tra Bạn Bè Hiện Tại**: Chuẩn hóa ID và kiểm tra trong `FriendModel`. Nếu tồn tại -> Báo lỗi `409 Conflict` (`ALREADY_FRIENDS`).
4. **Kiểm Tra Lời Mời Chéo**: Nếu đối phương đã gửi lời mời `PENDING` tới người dùng hiện tại -> Trả về gợi ý chấp nhận lời mời có sẵn hoặc tự động chuyển trạng thái kết bạn.
5. **Tạo Mới**: Lưu `FriendRequestModel` với trạng thái `PENDING`.

### 3.2. Luồng Chấp Nhận Lời Mời Kết Bạn (Transaction Bắt Buộc)
Thao tác ghi 2 bảng bắt buộc thực hiện trong Mongoose Session Transaction:
```typescript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // 1. Cập nhật FriendRequest status = ACCEPTED
  await FriendRequestModel.findByIdAndUpdate(
    requestId,
    { status: "ACCEPTED", respondedAt: new Date() },
    { session }
  );

  // 2. Tạo bản ghi Friend với ID chuẩn hóa
  const [userA, userB] = [senderId, receiverId].sort((a, b) =>
    a.toString().localeCompare(b.toString())
  );
  await FriendModel.create([{ userA, userB, friendRequestId: requestId }], { session });

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

### 3.3. Luồng Thu Hồi Tin Nhắn (Soft Delete)
- Gán `isDeleted: true`, `deletedAt: new Date()`.
- Không xóa cứng record nhằm bảo toàn cấu trúc phân trang cursor và ngữ cảnh trò chuyện.
- Trả về payload sanitized cho client: nội dung thay thế bằng placeholder và ẩn `attachments`.

---

## 4. Kế Hoạch Triển Khai (Phase Breakdown)
- **Giai đoạn 1**: Cập nhật `MessageModel` và tạo các unit test kiểm tra schema validation, indexes.
- **Giai đoạn 2**: Tạo `FriendRequestModel`, `FriendModel`, `BlockModel` kèm index và unit tests.
- **Giai đoạn 3**: Export tập trung tại `backend/src/models/index.ts` và chuẩn hóa types/interfaces.
