# Kế Hoạch Triển Khai Models Friend, Message, FriendRequest và Block

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng model `Message` (hỗ trợ reply, thu hồi tin nhắn, attachments) và tạo mới các model `FriendRequest`, `Friend`, `Block` kèm theo kiểm thử đơn vị schema validation trên Mongoose và TypeScript.

**Architecture:** Áp dụng mô hình Layered Architecture theo `rules/backend.md`. Các Data Models được định nghĩa type-safe với Mongoose Schema, kèm compound indexes, transformer `toJSON` chuẩn hóa, và hàm tiện ích chuẩn hóa thứ tự quan hệ bạn bè 2 chiều (`normalizeFriendIds`).

**Tech Stack:** Express.js, TypeScript, MongoDB (Mongoose 8.x), Vitest 2.x.

**Spec:** `docs/superpowers/specs/2026-09-12-friend-message-friend-request-models-design.md`

## Global Constraints

- **Type Safety**: Tất cả schema interface đều kế thừa `Document` từ Mongoose, export đầy đủ TypeScript interfaces/types.
- **Transform**: Mọi model đều có cấu hình `toJSON` chuyển đổi `_id` thành `id` và xóa `_id`, `__v`.
- **Zero-Trust**: Validation chặt chẽ các kiểu dữ liệu, enum và giới hạn độ dài trường.
- **Diff-First & Surgical Edits**: Tuân thủ triệt để `rules/token-economy.md`.

---

### Task 1: Mở rộng Model `Message` (`message.model.ts`)

**Files:**
- Modify: `backend/src/models/message.model.ts`
- Test: `backend/tests/models/message.model.test.ts`

**Interfaces:**
- Produces:
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

  export const MessageModel: Model<IMessage>;
  ```

- [ ] **Step 1: Viết failing test kiểm tra schema mở rộng của MessageModel**

Tạo file `backend/tests/models/message.model.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { MessageModel } from "../../src/models/message.model";

describe("MessageModel Schema & Validation", () => {
  it("khởi tạo thành công với các giá trị mặc định", () => {
    const msg = new MessageModel({
      conversationId: new Types.ObjectId(),
      senderId: new Types.ObjectId(),
      content: "Xin chào bạn bè",
    });

    const error = msg.validateSync();
    expect(error).toBeUndefined();
    expect(msg.type).toBe("TEXT");
    expect(msg.isDeleted).toBe(false);
    expect(msg.deletedAt).toBeNull();
    expect(msg.replyToMessageId).toBeNull();
    expect(msg.attachments).toEqual([]);
    expect(msg.readBy).toEqual([]);
  });

  it("cho phép đính kèm attachments và replyToMessageId", () => {
    const replyId = new Types.ObjectId();
    const msg = new MessageModel({
      conversationId: new Types.ObjectId(),
      senderId: new Types.ObjectId(),
      content: "Xem file đính kèm này",
      replyToMessageId: replyId,
      attachments: [
        {
          url: "https://example.com/file.pdf",
          name: "tailieu.pdf",
          size: 1024,
          mimeType: "application/pdf",
        },
      ],
    });

    const error = msg.validateSync();
    expect(error).toBeUndefined();
    expect(msg.replyToMessageId?.toString()).toBe(replyId.toString());
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments[0].name).toBe("tailieu.pdf");
  });

  it("cho phép content rỗng nếu có attachments", () => {
    const msg = new MessageModel({
      conversationId: new Types.ObjectId(),
      senderId: new Types.ObjectId(),
      type: "IMAGE",
      attachments: [
        {
          url: "https://example.com/photo.png",
          name: "photo.png",
          size: 2048,
          mimeType: "image/png",
        },
      ],
    });

    const error = msg.validateSync();
    expect(error).toBeUndefined();
  });

  it("thất bại nếu thiếu cả content lẫn attachments", () => {
    const msg = new MessageModel({
      conversationId: new Types.ObjectId(),
      senderId: new Types.ObjectId(),
    });

    const error = msg.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["content"]).toBeDefined();
  });

  it("thất bại nếu type không nằm trong enum cho phép", () => {
    const msg = new MessageModel({
      conversationId: new Types.ObjectId(),
      senderId: new Types.ObjectId(),
      content: "Hello",
      type: "INVALID_TYPE" as any,
    });

    const error = msg.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["type"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Chạy:
```bash
npx vitest run tests/models/message.model.test.ts
```
Kỳ vọng: FAIL vì `isDeleted`, `deletedAt`, `replyToMessageId`, `attachments` chưa được định nghĩa trong schema hiện tại.

- [ ] **Step 3: Cập nhật `backend/src/models/message.model.ts`**

Cập nhật `backend/src/models/message.model.ts`:
```typescript
import { Schema, model, Document, Types, Model } from "mongoose";

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

const AttachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    mimeType: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 5000,
      validate: {
        validator: function (this: IMessage, val?: string) {
          const hasAttachments = Array.isArray(this.attachments) && this.attachments.length > 0;
          return hasAttachments || (typeof val === "string" && val.trim().length > 0);
        },
        message: "Nội dung tin nhắn không được để trống khi không có tệp đính kèm",
      },
    },
    type: {
      type: String,
      enum: ["TEXT", "IMAGE", "FILE", "SYSTEM"],
      default: "TEXT",
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },
    replyToMessageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as { toString(): string }).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for cursor-based pagination per conversation
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, readBy: 1 });

export const MessageModel: Model<IMessage> = model<IMessage>("Message", MessageSchema);
```

- [ ] **Step 4: Chạy test để xác nhận test vượt qua**

Chạy:
```bash
npx vitest run tests/models/message.model.test.ts
```
Kỳ vọng: PASS (5/5 tests).

- [ ] **Step 5: Commit thay đổi**

```bash
git add src/models/message.model.ts tests/models/message.model.test.ts
git commit -m "feat(models): expand MessageModel with reply, soft-delete, and attachments"
```

---

### Task 2: Tạo Model `FriendRequest` (`friend-request.model.ts`)

**Files:**
- Create: `backend/src/models/friend-request.model.ts`
- Test: `backend/tests/models/friend-request.model.test.ts`

**Interfaces:**
- Produces:
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

  export const FriendRequestModel: Model<IFriendRequest>;
  ```

- [ ] **Step 1: Viết failing test cho FriendRequestModel**

Tạo file `backend/tests/models/friend-request.model.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { FriendRequestModel } from "../../src/models/friend-request.model";

describe("FriendRequestModel Schema & Validation", () => {
  it("khởi tạo thành công với các trường hợp lệ và giá trị mặc định", () => {
    const senderId = new Types.ObjectId();
    const receiverId = new Types.ObjectId();

    const request = new FriendRequestModel({
      senderId,
      receiverId,
    });

    const error = request.validateSync();
    expect(error).toBeUndefined();
    expect(request.status).toBe("PENDING");
    expect(request.note).toBe("");
    expect(request.respondedAt).toBeNull();
  });

  it("cho phép gửi kèm note tối đa 200 ký tự", () => {
    const request = new FriendRequestModel({
      senderId: new Types.ObjectId(),
      receiverId: new Types.ObjectId(),
      note: "Chào bạn, mình kết bạn nhé!",
    });

    const error = request.validateSync();
    expect(error).toBeUndefined();
    expect(request.note).toBe("Chào bạn, mình kết bạn nhé!");
  });

  it("thất bại nếu note vượt quá 200 ký tự", () => {
    const request = new FriendRequestModel({
      senderId: new Types.ObjectId(),
      receiverId: new Types.ObjectId(),
      note: "a".repeat(201),
    });

    const error = request.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["note"]).toBeDefined();
  });

  it("thất bại nếu thiếu senderId hoặc receiverId", () => {
    const request = new FriendRequestModel({});

    const error = request.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["senderId"]).toBeDefined();
    expect(error?.errors["receiverId"]).toBeDefined();
  });

  it("thất bại nếu status không hợp lệ", () => {
    const request = new FriendRequestModel({
      senderId: new Types.ObjectId(),
      receiverId: new Types.ObjectId(),
      status: "INVALID_STATUS" as any,
    });

    const error = request.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["status"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Chạy:
```bash
npx vitest run tests/models/friend-request.model.test.ts
```
Kỳ vọng: FAIL vì file `friend-request.model.ts` chưa tồn tại.

- [ ] **Step 3: Triển khai `backend/src/models/friend-request.model.ts`**

Tạo file `backend/src/models/friend-request.model.ts`:
```typescript
import { Schema, model, Document, Types, Model } from "mongoose";

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

const FriendRequestSchema = new Schema<IFriendRequest>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELED"],
      default: "PENDING",
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as { toString(): string }).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Prevent duplicate active pending requests between same sender and receiver
FriendRequestSchema.index(
  { senderId: 1, receiverId: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" } }
);

// Optimize query for pending requests received / sent
FriendRequestSchema.index({ receiverId: 1, status: 1, createdAt: -1 });
FriendRequestSchema.index({ senderId: 1, status: 1, createdAt: -1 });

export const FriendRequestModel: Model<IFriendRequest> = model<IFriendRequest>(
  "FriendRequest",
  FriendRequestSchema
);
```

- [ ] **Step 4: Chạy test để xác nhận test vượt qua**

Chạy:
```bash
npx vitest run tests/models/friend-request.model.test.ts
```
Kỳ vọng: PASS (5/5 tests).

- [ ] **Step 5: Commit thay đổi**

```bash
git add src/models/friend-request.model.ts tests/models/friend-request.model.test.ts
git commit -m "feat(models): add FriendRequestModel schema, validation and indexes"
```

---

### Task 3: Tạo Model `Friend` (`friend.model.ts`)

**Files:**
- Create: `backend/src/models/friend.model.ts`
- Test: `backend/tests/models/friend.model.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface IFriend extends Document {
    userA: Types.ObjectId;
    userB: Types.ObjectId;
    friendRequestId?: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
  }

  export function normalizeFriendIds(
    id1: Types.ObjectId | string,
    id2: Types.ObjectId | string
  ): [Types.ObjectId, Types.ObjectId];

  export const FriendModel: Model<IFriend>;
  ```

- [ ] **Step 1: Viết failing test cho FriendModel & normalizeFriendIds**

Tạo file `backend/tests/models/friend.model.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { FriendModel, normalizeFriendIds } from "../../src/models/friend.model";

describe("FriendModel Schema & Helpers", () => {
  describe("normalizeFriendIds()", () => {
    it("luôn sắp xếp userA có chuỗi ObjectId nhỏ hơn userB", () => {
      const idSmall = new Types.ObjectId("507f1f77bcf86cd799439011");
      const idLarge = new Types.ObjectId("607f1f77bcf86cd799439012");

      const [uA1, uB1] = normalizeFriendIds(idSmall, idLarge);
      expect(uA1.toString()).toBe(idSmall.toString());
      expect(uB1.toString()).toBe(idLarge.toString());

      // Ngược lại khi đảo thứ tự truyền vào
      const [uA2, uB2] = normalizeFriendIds(idLarge, idSmall);
      expect(uA2.toString()).toBe(idSmall.toString());
      expect(uB2.toString()).toBe(idLarge.toString());
    });

    it("ném lỗi nếu 2 user id trùng nhau", () => {
      const id = new Types.ObjectId();
      expect(() => normalizeFriendIds(id, id)).toThrowError(
        "Không thể tạo quan hệ bạn bè với chính mình"
      );
    });
  });

  describe("FriendModel Schema Validation", () => {
    it("khởi tạo thành công với userA và userB hợp lệ", () => {
      const idA = new Types.ObjectId("507f1f77bcf86cd799439011");
      const idB = new Types.ObjectId("607f1f77bcf86cd799439012");

      const friend = new FriendModel({
        userA: idA,
        userB: idB,
      });

      const error = friend.validateSync();
      expect(error).toBeUndefined();
      expect(friend.friendRequestId).toBeNull();
    });

    it("cho phép liên kết friendRequestId", () => {
      const reqId = new Types.ObjectId();
      const friend = new FriendModel({
        userA: new Types.ObjectId("507f1f77bcf86cd799439011"),
        userB: new Types.ObjectId("607f1f77bcf86cd799439012"),
        friendRequestId: reqId,
      });

      const error = friend.validateSync();
      expect(error).toBeUndefined();
      expect(friend.friendRequestId?.toString()).toBe(reqId.toString());
    });

    it("thất bại nếu thiếu userA hoặc userB", () => {
      const friend = new FriendModel({});
      const error = friend.validateSync();
      expect(error).toBeDefined();
      expect(error?.errors["userA"]).toBeDefined();
      expect(error?.errors["userB"]).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Chạy:
```bash
npx vitest run tests/models/friend.model.test.ts
```
Kỳ vọng: FAIL vì file `friend.model.ts` chưa tồn tại.

- [ ] **Step 3: Triển khai `backend/src/models/friend.model.ts`**

Tạo file `backend/src/models/friend.model.ts`:
```typescript
import { Schema, model, Document, Types, Model } from "mongoose";

export interface IFriend extends Document {
  userA: Types.ObjectId;
  userB: Types.ObjectId;
  friendRequestId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export function normalizeFriendIds(
  id1: Types.ObjectId | string,
  id2: Types.ObjectId | string
): [Types.ObjectId, Types.ObjectId] {
  const s1 = id1.toString();
  const s2 = id2.toString();

  if (s1 === s2) {
    throw new Error("Không thể tạo quan hệ bạn bè với chính mình");
  }

  const objId1 = typeof id1 === "string" ? new Types.ObjectId(id1) : id1;
  const objId2 = typeof id2 === "string" ? new Types.ObjectId(id2) : id2;

  return s1.localeCompare(s2) < 0 ? [objId1, objId2] : [objId2, objId1];
}

const FriendSchema = new Schema<IFriend>(
  {
    userA: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userB: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    friendRequestId: {
      type: Schema.Types.ObjectId,
      ref: "FriendRequest",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as { toString(): string }).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Ensure unique bidirectional friendship pair
FriendSchema.index({ userA: 1, userB: 1 }, { unique: true });

// Query indexes for listing friends for a user
FriendSchema.index({ userA: 1, createdAt: -1 });
FriendSchema.index({ userB: 1, createdAt: -1 });

export const FriendModel: Model<IFriend> = model<IFriend>("Friend", FriendSchema);
```

- [ ] **Step 4: Chạy test để xác nhận test vượt qua**

Chạy:
```bash
npx vitest run tests/models/friend.model.test.ts
```
Kỳ vọng: PASS (5/5 tests).

- [ ] **Step 5: Commit thay đổi**

```bash
git add src/models/friend.model.ts tests/models/friend.model.test.ts
git commit -m "feat(models): add FriendModel with normalized pair helper and indexes"
```

---

### Task 4: Tạo Model `Block` (`block.model.ts`)

**Files:**
- Create: `backend/src/models/block.model.ts`
- Test: `backend/tests/models/block.model.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface IBlock extends Document {
    blockerId: Types.ObjectId;
    blockedId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  }

  export const BlockModel: Model<IBlock>;
  ```

- [ ] **Step 1: Viết failing test cho BlockModel**

Tạo file `backend/tests/models/block.model.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { BlockModel } from "../../src/models/block.model";

describe("BlockModel Schema & Validation", () => {
  it("khởi tạo thành công với blockerId và blockedId hợp lệ", () => {
    const blockerId = new Types.ObjectId();
    const blockedId = new Types.ObjectId();

    const block = new BlockModel({
      blockerId,
      blockedId,
    });

    const error = block.validateSync();
    expect(error).toBeUndefined();
    expect(block.blockerId.toString()).toBe(blockerId.toString());
    expect(block.blockedId.toString()).toBe(blockedId.toString());
  });

  it("thất bại nếu thiếu blockerId hoặc blockedId", () => {
    const block = new BlockModel({});

    const error = block.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["blockerId"]).toBeDefined();
    expect(error?.errors["blockedId"]).toBeDefined();
  });

  it("thất bại nếu tự chặn chính mình", () => {
    const userId = new Types.ObjectId();
    const block = new BlockModel({
      blockerId: userId,
      blockedId: userId,
    });

    const error = block.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["blockedId"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Chạy:
```bash
npx vitest run tests/models/block.model.test.ts
```
Kỳ vọng: FAIL vì file `block.model.ts` chưa tồn tại.

- [ ] **Step 3: Triển khai `backend/src/models/block.model.ts`**

Tạo file `backend/src/models/block.model.ts`:
```typescript
import { Schema, model, Document, Types, Model } from "mongoose";

export interface IBlock extends Document {
  blockerId: Types.ObjectId;
  blockedId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BlockSchema = new Schema<IBlock>(
  {
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      validate: {
        validator: function (this: IBlock, val: Types.ObjectId) {
          return !this.blockerId || this.blockerId.toString() !== val.toString();
        },
        message: "Không thể tự chặn chính mình",
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as { toString(): string }).toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Prevent duplicate block record
BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
BlockSchema.index({ blockedId: 1, blockerId: 1 });

export const BlockModel: Model<IBlock> = model<IBlock>("Block", BlockSchema);
```

- [ ] **Step 4: Chạy test để xác nhận test vượt qua**

Chạy:
```bash
npx vitest run tests/models/block.model.test.ts
```
Kỳ vọng: PASS (3/3 tests).

- [ ] **Step 5: Commit thay đổi**

```bash
git add src/models/block.model.ts tests/models/block.model.test.ts
git commit -m "feat(models): add BlockModel schema and self-block validation"
```

---

### Task 5: Centralized Model Exports & Integrity Verification

**Files:**
- Create: `backend/src/models/index.ts`
- Test: `backend/tests/models/models-export.test.ts`

**Interfaces:**
- Consumes: All models (`UserModel`, `ConversationModel`, `RefreshTokenModel`, `MessageModel`, `FriendRequestModel`, `FriendModel`, `BlockModel`)
- Produces: Centralized barrel export at `backend/src/models/index.ts`

- [ ] **Step 1: Viết test xác nhận tất cả models được export đầy đủ từ `src/models/index.ts`**

Tạo file `backend/tests/models/models-export.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  UserModel,
  ConversationModel,
  RefreshTokenModel,
  MessageModel,
  FriendRequestModel,
  FriendModel,
  BlockModel,
  normalizeFriendIds,
} from "../../src/models";

describe("Models Barrel Export (index.ts)", () => {
  it("export đầy đủ tất cả models và hàm tiện ích", () => {
    expect(UserModel).toBeDefined();
    expect(ConversationModel).toBeDefined();
    expect(RefreshTokenModel).toBeDefined();
    expect(MessageModel).toBeDefined();
    expect(FriendRequestModel).toBeDefined();
    expect(FriendModel).toBeDefined();
    expect(BlockModel).toBeDefined();
    expect(typeof normalizeFriendIds).toBe("function");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Chạy:
```bash
npx vitest run tests/models/models-export.test.ts
```
Kỳ vọng: FAIL vì `src/models/index.ts` chưa tồn tại.

- [ ] **Step 3: Tạo `backend/src/models/index.ts`**

Tạo file `backend/src/models/index.ts`:
```typescript
export * from "./user.model";
export * from "./conversation.model";
export * from "./refresh-token.model";
export * from "./message.model";
export * from "./friend-request.model";
export * from "./friend.model";
export * from "./block.model";
```

- [ ] **Step 4: Chạy toàn bộ test suite và TypeScript type-check**

Chạy:
```bash
npm run test
npm run type-check
```
Kỳ vọng: Toàn bộ test suite vượt qua và không có lỗi TypeScript nào.

- [ ] **Step 5: Commit hoàn tất**

```bash
git add src/models/index.ts tests/models/models-export.test.ts
git commit -m "feat(models): add centralized models barrel export and verify full integrity"
```
