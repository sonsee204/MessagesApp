# Kế Hoạch Triển Khai Friend APIs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Xây dựng trọn vẹn hệ thống RESTful API quản lý bạn bè (`/api/friends`) bao gồm Lời mời kết bạn, Danh sách bạn bè, Chặn người dùng, và tích hợp Real-time Socket.IO events.

**Architecture:** Áp dụng mô hình Layered Architecture theo `rules/backend.md`. Tầng Routes bảo vệ bởi `requireAuth`, tầng Validation sử dụng Zod schema, tầng Controller tiếp nhận request và định dạng response, tầng Service thực thi toàn bộ business rules và Transactions, tầng Repositories đóng gói câu truy vấn Mongoose.

**Tech Stack:** Express.js, TypeScript, MongoDB (Mongoose 8.x), Vitest 2.x, Supertest, Zod 3.x, Socket.IO.

**Spec:** `docs/superpowers/specs/2026-09-12-friend-apis-design.md`

## Global Constraints

- **Layer Separation**: Controller không chứa business logic hay query CSDL trực tiếp; Service không nhận đối tượng `req`, `res`; Repository chỉ tương tác với Models.
- **Zero-Trust Input**: Toàn bộ `body`, `query`, `params` được validate qua Zod Schemas trước khi vào Service.
- **Error Response Standard**: Mọi lỗi trả về theo format `{ success: false, error: { code, message, details } }`.
- **Database Transactions**: Thao tác chấp nhận kết bạn và thao tác chặn người dùng bắt buộc bọc trong `session.withTransaction()`.
- **Diff-First & Surgical Edits**: Tuân thủ triệt để `rules/token-economy.md`.

---

### Task 1: Validation Schemas (`src/schemas/friend.schema.ts`)

**Files:**
- Create: `backend/src/schemas/friend.schema.ts`
- Test: `backend/tests/schemas/friend.schema.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export const SendFriendRequestSchema: z.ZodObject<...>;
  export const FriendQuerySchema: z.ZodObject<...>;
  export const PaginationQuerySchema: z.ZodObject<...>;
  export const RequestIdParamSchema: z.ZodObject<...>;
  export const TargetUserParamSchema: z.ZodObject<...>;

  export type SendFriendRequestInput = z.infer<typeof SendFriendRequestSchema>["body"];
  export type FriendQueryInput = z.infer<typeof FriendQuerySchema>["query"];
  export type PaginationQueryInput = z.infer<typeof PaginationQuerySchema>["query"];
  ```

- [x] **Step 1: Viết failing test cho các schemas validation**

Tạo file `backend/tests/schemas/friend.schema.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  SendFriendRequestSchema,
  FriendQuerySchema,
  PaginationQuerySchema,
  RequestIdParamSchema,
  TargetUserParamSchema,
} from "../../src/schemas/friend.schema";

describe("Friend Schemas Validation", () => {
  describe("SendFriendRequestSchema", () => {
    it("hợp lệ khi receiverId là ObjectId 24 ký tự hex và note hợp lệ", () => {
      const valid = SendFriendRequestSchema.safeParse({
        body: {
          receiverId: "507f1f77bcf86cd799439011",
          note: "Kết bạn nhé",
        },
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.body.note).toBe("Kết bạn nhé");
      }
    });

    it("tự gán note rỗng nếu không truyền", () => {
      const valid = SendFriendRequestSchema.safeParse({
        body: {
          receiverId: "507f1f77bcf86cd799439011",
        },
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.body.note).toBe("");
      }
    });

    it("thất bại nếu receiverId không phải ObjectId 24 ký tự", () => {
      const invalid = SendFriendRequestSchema.safeParse({
        body: {
          receiverId: "invalid-id-123",
        },
      });
      expect(invalid.success).toBe(false);
    });

    it("thất bại nếu note vượt quá 200 ký tự", () => {
      const invalid = SendFriendRequestSchema.safeParse({
        body: {
          receiverId: "507f1f77bcf86cd799439011",
          note: "a".repeat(201),
        },
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("FriendQuerySchema & PaginationQuerySchema", () => {
    it("chuyển đổi chuỗi query sang number và gán giá trị mặc định", () => {
      const valid = FriendQuerySchema.safeParse({
        query: {
          page: "2",
          limit: "15",
          search: "son",
          onlineOnly: "true",
        },
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.query.page).toBe(2);
        expect(valid.data.query.limit).toBe(15);
        expect(valid.data.query.search).toBe("son");
        expect(valid.data.query.onlineOnly).toBe(true);
      }
    });

    it("áp dụng page=1, limit=20 mặc định khi query rỗng", () => {
      const valid = PaginationQuerySchema.safeParse({
        query: {},
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.query.page).toBe(1);
        expect(valid.data.query.limit).toBe(20);
      }
    });
  });

  describe("Param Schemas", () => {
    it("RequestIdParamSchema kiểm tra hợp lệ param requestId", () => {
      const valid = RequestIdParamSchema.safeParse({
        params: { requestId: "507f1f77bcf86cd799439011" },
      });
      expect(valid.success).toBe(true);

      const invalid = RequestIdParamSchema.safeParse({
        params: { requestId: "invalid" },
      });
      expect(invalid.success).toBe(false);
    });

    it("TargetUserParamSchema kiểm tra hợp lệ param targetUserId", () => {
      const valid = TargetUserParamSchema.safeParse({
        params: { targetUserId: "507f1f77bcf86cd799439011" },
      });
      expect(valid.success).toBe(true);
    });
  });
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Chạy:
```bash
npx vitest run tests/schemas/friend.schema.test.ts
```
Kỳ vọng: FAIL vì file `src/schemas/friend.schema.ts` chưa tồn tại.

- [x] **Step 3: Triển khai `backend/src/schemas/friend.schema.ts`**

Tạo file `backend/src/schemas/friend.schema.ts`:
```typescript
import { z } from "zod";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const SendFriendRequestSchema = z.object({
  body: z.object({
    receiverId: z
      .string({ required_error: "ID người nhận không được để trống" })
      .regex(OBJECT_ID_REGEX, "ID người nhận không hợp lệ"),
    note: z
      .string()
      .max(200, "Lời nhắn tối đa 200 ký tự")
      .optional()
      .default(""),
  }),
});

export const PaginationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const FriendQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    onlineOnly: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  }),
});

export const RequestIdParamSchema = z.object({
  params: z.object({
    requestId: z
      .string({ required_error: "ID lời mời không được để trống" })
      .regex(OBJECT_ID_REGEX, "ID lời mời không hợp lệ"),
  }),
});

export const TargetUserParamSchema = z.object({
  params: z.object({
    targetUserId: z
      .string({ required_error: "ID người dùng mục tiêu không được để trống" })
      .regex(OBJECT_ID_REGEX, "ID người dùng mục tiêu không hợp lệ"),
  }),
});

export type SendFriendRequestInput = z.infer<typeof SendFriendRequestSchema>["body"];
export type FriendQueryInput = z.infer<typeof FriendQuerySchema>["query"];
export type PaginationQueryInput = z.infer<typeof PaginationQuerySchema>["query"];
```

- [x] **Step 4: Chạy test để xác nhận test vượt qua**

Chạy:
```bash
npx vitest run tests/schemas/friend.schema.test.ts
```
Kỳ vọng: PASS (7/7 tests).

- [x] **Step 5: Commit thay đổi**

```bash
git add src/schemas/friend.schema.ts tests/schemas/friend.schema.test.ts
git commit -m "feat(schemas): add Zod validation schemas for Friend APIs"
```

---

### Task 2: Repositories Layer (`FriendRequest`, `Friend`, `Block`)

**Files:**
- Create: `backend/src/repositories/friend-request.repository.ts`
- Create: `backend/src/repositories/friend.repository.ts`
- Create: `backend/src/repositories/block.repository.ts`
- Test: `backend/tests/repositories/friend.repositories.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface IFriendRequestRepository { ... }
  export interface IFriendRepository { ... }
  export interface IBlockRepository { ... }

  export const friendRequestRepository: IFriendRequestRepository;
  export const friendRepository: IFriendRepository;
  export const blockRepository: IBlockRepository;
  ```

- [x] **Step 1: Viết failing test kiểm tra Repositories**

Tạo file `backend/tests/repositories/friend.repositories.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { friendRequestRepository } from "../../src/repositories/friend-request.repository";
import { friendRepository } from "../../src/repositories/friend.repository";
import { blockRepository } from "../../src/repositories/block.repository";

describe("Friend Repositories Instantiation & Methods", () => {
  it("friendRequestRepository export đầy đủ các phương thức nghiệp vụ", () => {
    expect(typeof friendRequestRepository.create).toBe("function");
    expect(typeof friendRequestRepository.findById).toBe("function");
    expect(typeof friendRequestRepository.findPending).toBe("function");
    expect(typeof friendRequestRepository.updateStatus).toBe("function");
    expect(typeof friendRequestRepository.findReceived).toBe("function");
    expect(typeof friendRequestRepository.findSent).toBe("function");
    expect(typeof friendRequestRepository.cancelPendingBetween).toBe("function");
  });

  it("friendRepository export đầy đủ các phương thức nghiệp vụ", () => {
    expect(typeof friendRepository.createFriendship).toBe("function");
    expect(typeof friendRepository.isFriend).toBe("function");
    expect(typeof friendRepository.removeFriendship).toBe("function");
    expect(typeof friendRepository.findFriends).toBe("function");
    expect(typeof friendRepository.countFriends).toBe("function");
  });

  it("blockRepository export đầy đủ các phương thức nghiệp vụ", () => {
    expect(typeof blockRepository.createBlock).toBe("function");
    expect(typeof blockRepository.removeBlock).toBe("function");
    expect(typeof blockRepository.isBlocked).toBe("function");
    expect(typeof blockRepository.isBlockedBy).toBe("function");
    expect(typeof blockRepository.findBlockedUsers).toBe("function");
  });
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Chạy:
```bash
npx vitest run tests/repositories/friend.repositories.test.ts
```
Kỳ vọng: FAIL vì 3 file repository chưa tồn tại.

- [x] **Step 3: Triển khai 3 repositories**

1. Tạo `backend/src/repositories/friend-request.repository.ts`:
```typescript
import { ClientSession, Types } from "mongoose";
import {
  FriendRequestModel,
  IFriendRequest,
  FriendRequestStatus,
} from "../models/friend-request.model";

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface IFriendRequestRepository {
  create(
    data: { senderId: string; receiverId: string; note?: string },
    session?: ClientSession
  ): Promise<IFriendRequest>;
  findById(id: string): Promise<IFriendRequest | null>;
  findPending(senderId: string, receiverId: string): Promise<IFriendRequest | null>;
  updateStatus(
    id: string,
    status: FriendRequestStatus,
    respondedAt?: Date,
    session?: ClientSession
  ): Promise<IFriendRequest | null>;
  findReceived(
    receiverId: string,
    options: PaginationOptions
  ): Promise<{ items: IFriendRequest[]; total: number }>;
  findSent(
    senderId: string,
    options: PaginationOptions
  ): Promise<{ items: IFriendRequest[]; total: number }>;
  cancelPendingBetween(user1: string, user2: string, session?: ClientSession): Promise<number>;
}

export class FriendRequestRepository implements IFriendRequestRepository {
  async create(
    data: { senderId: string; receiverId: string; note?: string },
    session?: ClientSession
  ): Promise<IFriendRequest> {
    const doc = new FriendRequestModel({
      senderId: new Types.ObjectId(data.senderId),
      receiverId: new Types.ObjectId(data.receiverId),
      note: data.note ?? "",
      status: "PENDING",
    });
    return doc.save({ session });
  }

  async findById(id: string): Promise<IFriendRequest | null> {
    return FriendRequestModel.findById(id);
  }

  async findPending(senderId: string, receiverId: string): Promise<IFriendRequest | null> {
    return FriendRequestModel.findOne({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(receiverId),
      status: "PENDING",
    });
  }

  async updateStatus(
    id: string,
    status: FriendRequestStatus,
    respondedAt?: Date,
    session?: ClientSession
  ): Promise<IFriendRequest | null> {
    return FriendRequestModel.findByIdAndUpdate(
      id,
      {
        status,
        ...(respondedAt ? { respondedAt } : {}),
      },
      { new: true, session }
    );
  }

  async findReceived(
    receiverId: string,
    { page, limit }: PaginationOptions
  ): Promise<{ items: IFriendRequest[]; total: number }> {
    const query = {
      receiverId: new Types.ObjectId(receiverId),
      status: "PENDING",
    };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      FriendRequestModel.find(query)
        .populate("senderId", "username displayName avatarUrl isOnline")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      FriendRequestModel.countDocuments(query),
    ]);

    return { items, total };
  }

  async findSent(
    senderId: string,
    { page, limit }: PaginationOptions
  ): Promise<{ items: IFriendRequest[]; total: number }> {
    const query = {
      senderId: new Types.ObjectId(senderId),
      status: "PENDING",
    };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      FriendRequestModel.find(query)
        .populate("receiverId", "username displayName avatarUrl isOnline")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      FriendRequestModel.countDocuments(query),
    ]);

    return { items, total };
  }

  async cancelPendingBetween(user1: string, user2: string, session?: ClientSession): Promise<number> {
    const u1 = new Types.ObjectId(user1);
    const u2 = new Types.ObjectId(user2);

    const res = await FriendRequestModel.updateMany(
      {
        $or: [
          { senderId: u1, receiverId: u2, status: "PENDING" },
          { senderId: u2, receiverId: u1, status: "PENDING" },
        ],
      },
      { status: "CANCELED" },
      { session }
    );

    return res.modifiedCount;
  }
}

export const friendRequestRepository = new FriendRequestRepository();
```

2. Tạo `backend/src/repositories/friend.repository.ts`:
```typescript
import { ClientSession, Types } from "mongoose";
import { FriendModel, IFriend, normalizeFriendIds } from "../models/friend.model";
import { PaginationOptions } from "./friend-request.repository";

export interface FriendQueryOptions extends PaginationOptions {
  search?: string;
  onlineOnly?: boolean;
}

export interface FriendItemResult {
  friendshipId: string;
  friendSince: Date;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    bio?: string;
    isOnline: boolean;
    lastSeenAt: Date;
  };
}

export interface IFriendRepository {
  createFriendship(
    user1: string,
    user2: string,
    friendRequestId?: string,
    session?: ClientSession
  ): Promise<IFriend>;
  isFriend(user1: string, user2: string): Promise<boolean>;
  removeFriendship(user1: string, user2: string, session?: ClientSession): Promise<boolean>;
  findFriends(
    userId: string,
    options: FriendQueryOptions
  ): Promise<{ items: FriendItemResult[]; total: number }>;
  countFriends(userId: string): Promise<number>;
}

export class FriendRepository implements IFriendRepository {
  async createFriendship(
    user1: string,
    user2: string,
    friendRequestId?: string,
    session?: ClientSession
  ): Promise<IFriend> {
    const [userA, userB] = normalizeFriendIds(user1, user2);
    const doc = new FriendModel({
      userA,
      userB,
      friendRequestId: friendRequestId ? new Types.ObjectId(friendRequestId) : null,
    });
    return doc.save({ session });
  }

  async isFriend(user1: string, user2: string): Promise<boolean> {
    if (user1 === user2) return false;
    const [userA, userB] = normalizeFriendIds(user1, user2);
    const count = await FriendModel.countDocuments({ userA, userB });
    return count > 0;
  }

  async removeFriendship(user1: string, user2: string, session?: ClientSession): Promise<boolean> {
    if (user1 === user2) return false;
    const [userA, userB] = normalizeFriendIds(user1, user2);
    const result = await FriendModel.deleteOne({ userA, userB }, { session });
    return result.deletedCount > 0;
  }

  async findFriends(
    userId: string,
    options: FriendQueryOptions
  ): Promise<{ items: FriendItemResult[]; total: number }> {
    const userObjId = new Types.ObjectId(userId);
    const skip = (options.page - 1) * options.limit;

    // Pipeline: lọc các quan hệ của userId, chiếu ra friendId, lookup sang users
    const pipeline: any[] = [
      {
        $match: {
          $or: [{ userA: userObjId }, { userB: userObjId }],
        },
      },
      {
        $project: {
          friendId: {
            $cond: { if: { $eq: ["$userA", userObjId] }, then: "$userB", else: "$userA" },
          },
          createdAt: 1,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "friendId",
          foreignField: "_id",
          as: "friendUser",
        },
      },
      { $unwind: "$friendUser" },
    ];

    if (options.onlineOnly) {
      pipeline.push({ $match: { "friendUser.isOnline": true } });
    }

    if (options.search) {
      const regex = new RegExp(options.search, "i");
      pipeline.push({
        $match: {
          $or: [{ "friendUser.displayName": regex }, { "friendUser.username": regex }],
        },
      });
    }

    const countPipeline = [...pipeline, { $count: "total" }];
    const dataPipeline = [
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: options.limit },
      {
        $project: {
          friendshipId: "$_id",
          friendSince: "$createdAt",
          user: {
            id: "$friendUser._id",
            username: "$friendUser.username",
            displayName: "$friendUser.displayName",
            avatarUrl: "$friendUser.avatarUrl",
            bio: "$friendUser.bio",
            isOnline: "$friendUser.isOnline",
            lastSeenAt: "$friendUser.lastSeenAt",
          },
        },
      },
    ];

    const [dataResult, countResult] = await Promise.all([
      FriendModel.aggregate(dataPipeline),
      FriendModel.aggregate(countPipeline),
    ]);

    const items: FriendItemResult[] = dataResult.map((item) => ({
      friendshipId: item.friendshipId.toString(),
      friendSince: item.friendSince,
      user: {
        ...item.user,
        id: item.user.id.toString(),
      },
    }));

    const total = countResult[0]?.total ?? 0;
    return { items, total };
  }

  async countFriends(userId: string): Promise<number> {
    const userObjId = new Types.ObjectId(userId);
    return FriendModel.countDocuments({
      $or: [{ userA: userObjId }, { userB: userObjId }],
    });
  }
}

export const friendRepository = new FriendRepository();
```

3. Tạo `backend/src/repositories/block.repository.ts`:
```typescript
import { ClientSession, Types } from "mongoose";
import { BlockModel, IBlock } from "../models/block.model";
import { PaginationOptions } from "./friend-request.repository";

export interface IBlockRepository {
  createBlock(blockerId: string, blockedId: string, session?: ClientSession): Promise<IBlock>;
  removeBlock(blockerId: string, blockedId: string): Promise<boolean>;
  isBlocked(user1: string, user2: string): Promise<boolean>;
  isBlockedBy(blockerId: string, blockedId: string): Promise<boolean>;
  findBlockedUsers(
    blockerId: string,
    options: PaginationOptions
  ): Promise<{ items: IBlock[]; total: number }>;
}

export class BlockRepository implements IBlockRepository {
  async createBlock(blockerId: string, blockedId: string, session?: ClientSession): Promise<IBlock> {
    const doc = new BlockModel({
      blockerId: new Types.ObjectId(blockerId),
      blockedId: new Types.ObjectId(blockedId),
    });
    return doc.save({ session });
  }

  async removeBlock(blockerId: string, blockedId: string): Promise<boolean> {
    const result = await BlockModel.deleteOne({
      blockerId: new Types.ObjectId(blockerId),
      blockedId: new Types.ObjectId(blockedId),
    });
    return result.deletedCount > 0;
  }

  async isBlocked(user1: string, user2: string): Promise<boolean> {
    const u1 = new Types.ObjectId(user1);
    const u2 = new Types.ObjectId(user2);

    const count = await BlockModel.countDocuments({
      $or: [
        { blockerId: u1, blockedId: u2 },
        { blockerId: u2, blockedId: u1 },
      ],
    });
    return count > 0;
  }

  async isBlockedBy(blockerId: string, blockedId: string): Promise<boolean> {
    const count = await BlockModel.countDocuments({
      blockerId: new Types.ObjectId(blockerId),
      blockedId: new Types.ObjectId(blockedId),
    });
    return count > 0;
  }

  async findBlockedUsers(
    blockerId: string,
    { page, limit }: PaginationOptions
  ): Promise<{ items: IBlock[]; total: number }> {
    const query = { blockerId: new Types.ObjectId(blockerId) };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      BlockModel.find(query)
        .populate("blockedId", "username displayName avatarUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BlockModel.countDocuments(query),
    ]);

    return { items, total };
  }
}

export const blockRepository = new BlockRepository();
```

- [x] **Step 4: Chạy test để xác nhận test vượt qua**

Chạy:
```bash
npx vitest run tests/repositories/friend.repositories.test.ts
```
Kỳ vọng: PASS (3/3 tests).

- [x] **Step 5: Commit thay đổi**

```bash
git add src/repositories/friend-request.repository.ts src/repositories/friend.repository.ts src/repositories/block.repository.ts tests/repositories/friend.repositories.test.ts
git commit -m "feat(repositories): implement FriendRequest, Friend, and Block repositories"
```

---

### Task 3: Service Layer (`src/services/friend.service.ts`)

**Files:**
- Create: `backend/src/services/friend.service.ts`
- Test: `backend/tests/services/friend.service.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface IFriendService {
    sendFriendRequest(senderId: string, receiverId: string, note?: string): Promise<IFriendRequest>;
    acceptFriendRequest(userId: string, requestId: string): Promise<{ friendshipId: string; friend: any; acceptedAt: Date }>;
    rejectFriendRequest(userId: string, requestId: string): Promise<void>;
    cancelFriendRequest(userId: string, requestId: string): Promise<void>;
    getReceivedRequests(userId: string, pagination: PaginationOptions): Promise<any>;
    getSentRequests(userId: string, pagination: PaginationOptions): Promise<any>;
    getFriends(userId: string, query: FriendQueryOptions): Promise<any>;
    removeFriend(userId: string, targetUserId: string): Promise<void>;
    getRelationshipStatus(userId: string, targetUserId: string): Promise<{ targetUserId: string; status: string }>;
    blockUser(blockerId: string, blockedId: string): Promise<void>;
    unblockUser(blockerId: string, blockedId: string): Promise<void>;
    getBlockedUsers(blockerId: string, pagination: PaginationOptions): Promise<any>;
  }

  export const friendService: IFriendService;
  ```

- [x] **Step 1: Viết failing test cho FriendService**

Tạo file `backend/tests/services/friend.service.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FriendService } from "../../src/services/friend.service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../src/core/errors";

describe("FriendService Business Logic", () => {
  let friendService: FriendService;
  let mockFriendRequestRepo: any;
  let mockFriendRepo: any;
  let mockBlockRepo: any;
  let mockUserRepo: any;

  beforeEach(() => {
    mockFriendRequestRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findPending: vi.fn(),
      updateStatus: vi.fn(),
      findReceived: vi.fn(),
      findSent: vi.fn(),
      cancelPendingBetween: vi.fn(),
    };
    mockFriendRepo = {
      createFriendship: vi.fn(),
      isFriend: vi.fn(),
      removeFriendship: vi.fn(),
      findFriends: vi.fn(),
      countFriends: vi.fn(),
    };
    mockBlockRepo = {
      createBlock: vi.fn(),
      removeBlock: vi.fn(),
      isBlocked: vi.fn(),
      isBlockedBy: vi.fn(),
      findBlockedUsers: vi.fn(),
    };
    mockUserRepo = {
      findById: vi.fn(),
    };

    friendService = new FriendService(
      mockFriendRequestRepo,
      mockFriendRepo,
      mockBlockRepo,
      mockUserRepo
    );
  });

  describe("sendFriendRequest()", () => {
    it("ném lỗi nếu gửi lời mời cho chính mình", async () => {
      await expect(
        friendService.sendFriendRequest("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439011")
      ).rejects.toThrow(ValidationError);
    });

    it("ném lỗi nếu người nhận không tồn tại", async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        friendService.sendFriendRequest("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012")
      ).rejects.toThrow(NotFoundError);
    });

    it("ném lỗi nếu bị chặn (isBlocked = true)", async () => {
      mockUserRepo.findById.mockResolvedValue({ id: "user2" });
      mockBlockRepo.isBlocked.mockResolvedValue(true);

      await expect(
        friendService.sendFriendRequest("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012")
      ).rejects.toThrow(ForbiddenError);
    });

    it("ném lỗi nếu đã là bạn bè (isFriend = true)", async () => {
      mockUserRepo.findById.mockResolvedValue({ id: "user2" });
      mockBlockRepo.isBlocked.mockResolvedValue(false);
      mockFriendRepo.isFriend.mockResolvedValue(true);

      await expect(
        friendService.sendFriendRequest("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012")
      ).rejects.toThrow(ConflictError);
    });

    it("tạo lời mời thành công khi thỏa mãn tất cả điều kiện", async () => {
      mockUserRepo.findById.mockResolvedValue({ id: "user2" });
      mockBlockRepo.isBlocked.mockResolvedValue(false);
      mockFriendRepo.isFriend.mockResolvedValue(false);
      mockFriendRequestRepo.findPending.mockResolvedValue(null);
      mockFriendRequestRepo.create.mockResolvedValue({ id: "req1", status: "PENDING" });

      const res = await friendService.sendFriendRequest(
        "507f1f77bcf86cd799439011",
        "507f1f77bcf86cd799439012",
        "Chào bạn"
      );
      expect(res.id).toBe("req1");
      expect(mockFriendRequestRepo.create).toHaveBeenCalled();
    });
  });

  describe("getRelationshipStatus()", () => {
    it("trả về NONE nếu chưa có quan hệ gì", async () => {
      mockBlockRepo.isBlocked.mockResolvedValue(false);
      mockFriendRepo.isFriend.mockResolvedValue(false);
      mockFriendRequestRepo.findPending.mockResolvedValue(null);

      const res = await friendService.getRelationshipStatus("u1", "u2");
      expect(res.status).toBe("NONE");
    });

    it("trả về BLOCKED nếu có chiều chặn", async () => {
      mockBlockRepo.isBlocked.mockResolvedValue(true);
      const res = await friendService.getRelationshipStatus("u1", "u2");
      expect(res.status).toBe("BLOCKED");
    });

    it("trả về FRIENDS nếu đã là bạn bè", async () => {
      mockBlockRepo.isBlocked.mockResolvedValue(false);
      mockFriendRepo.isFriend.mockResolvedValue(true);
      const res = await friendService.getRelationshipStatus("u1", "u2");
      expect(res.status).toBe("FRIENDS");
    });
  });
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Chạy:
```bash
npx vitest run tests/services/friend.service.test.ts
```
Kỳ vọng: FAIL vì file `src/services/friend.service.ts` chưa tồn tại.

- [x] **Step 3: Triển khai `backend/src/services/friend.service.ts`**

Tạo file `backend/src/services/friend.service.ts`:
```typescript
import mongoose, { Types } from "mongoose";
import {
  IFriendRequestRepository,
  friendRequestRepository,
  PaginationOptions,
} from "../repositories/friend-request.repository";
import {
  IFriendRepository,
  friendRepository,
  FriendQueryOptions,
} from "../repositories/friend.repository";
import {
  IBlockRepository,
  blockRepository,
} from "../repositories/block.repository";
import { IUserRepository, userRepository } from "../repositories/user.repository";
import { IFriendRequest } from "../models/friend-request.model";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../core/errors";

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type RelationshipStatus =
  | "NONE"
  | "PENDING_SENT"
  | "PENDING_RECEIVED"
  | "FRIENDS"
  | "BLOCKED";

export class FriendService {
  constructor(
    private friendRequestRepo: IFriendRequestRepository = friendRequestRepository,
    private friendRepo: IFriendRepository = friendRepository,
    private blockRepo: IBlockRepository = blockRepository,
    private userRepo: IUserRepository = userRepository
  ) {}

  async sendFriendRequest(
    senderId: string,
    receiverId: string,
    note?: string
  ): Promise<IFriendRequest> {
    if (senderId === receiverId) {
      throw new ValidationError("Không thể gửi lời mời kết bạn cho chính mình");
    }

    const receiver = await this.userRepo.findById(receiverId);
    if (!receiver) {
      throw new NotFoundError("Không tìm thấy người dùng nhận lời mời");
    }

    const isBlocked = await this.blockRepo.isBlocked(senderId, receiverId);
    if (isBlocked) {
      throw new ForbiddenError("Không thể gửi lời mời kết bạn cho người dùng này");
    }

    const isFriend = await this.friendRepo.isFriend(senderId, receiverId);
    if (isFriend) {
      throw new ConflictError("Hai người đã là bạn bè của nhau");
    }

    // Kiểm tra đã có lời mời gửi đi đang pending chưa
    const sentPending = await this.friendRequestRepo.findPending(senderId, receiverId);
    if (sentPending) {
      throw new ConflictError("Bạn đã gửi lời mời kết bạn trước đó và đang chờ phản hồi");
    }

    // Kiểm tra đối phương đã gửi lời mời cho mình chưa
    const receivedPending = await this.friendRequestRepo.findPending(receiverId, senderId);
    if (receivedPending) {
      throw new ConflictError(
        "Người dùng này đã gửi lời mời kết bạn cho bạn, vui lòng kiểm tra danh sách lời mời nhận được"
      );
    }

    return this.friendRequestRepo.create({
      senderId,
      receiverId,
      note,
    });
  }

  async acceptFriendRequest(
    userId: string,
    requestId: string
  ): Promise<{ friendshipId: string; friend: any; acceptedAt: Date }> {
    const request = await this.friendRequestRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError("Không tìm thấy lời mời kết bạn");
    }

    if (request.receiverId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền chấp nhận lời mời kết bạn này");
    }

    if (request.status !== "PENDING") {
      throw new ValidationError("Lời mời kết bạn này không còn ở trạng thái chờ chấp nhận");
    }

    const senderIdStr = request.senderId.toString();

    // Thực hiện trong Session Transaction
    const session = await mongoose.startSession();
    let friendshipId = "";
    const acceptedAt = new Date();

    try {
      await session.withTransaction(async () => {
        await this.friendRequestRepo.updateStatus(requestId, "ACCEPTED", acceptedAt, session);
        const friendship = await this.friendRepo.createFriendship(
          senderIdStr,
          userId,
          requestId,
          session
        );
        friendshipId = (friendship as any)._id?.toString() || friendship.id;
      });
    } finally {
      await session.endSession();
    }

    const friendUser = await this.userRepo.findById(senderIdStr);
    return {
      friendshipId,
      friend: friendUser,
      acceptedAt,
    };
  }

  async rejectFriendRequest(userId: string, requestId: string): Promise<void> {
    const request = await this.friendRequestRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError("Không tìm thấy lời mời kết bạn");
    }

    if (request.receiverId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền từ chối lời mời kết bạn này");
    }

    if (request.status !== "PENDING") {
      throw new ValidationError("Lời mời kết bạn này không còn ở trạng thái chờ");
    }

    await this.friendRequestRepo.updateStatus(requestId, "REJECTED", new Date());
  }

  async cancelFriendRequest(userId: string, requestId: string): Promise<void> {
    const request = await this.friendRequestRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError("Không tìm thấy lời mời kết bạn");
    }

    if (request.senderId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền hủy lời mời kết bạn này");
    }

    if (request.status !== "PENDING") {
      throw new ValidationError("Lời mời kết bạn này không còn ở trạng thái chờ");
    }

    await this.friendRequestRepo.updateStatus(requestId, "CANCELED");
  }

  async getReceivedRequests(
    userId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<any>> {
    const { items, total } = await this.friendRequestRepo.findReceived(userId, options);
    return {
      items,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit) || 1,
      },
    };
  }

  async getSentRequests(
    userId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<any>> {
    const { items, total } = await this.friendRequestRepo.findSent(userId, options);
    return {
      items,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit) || 1,
      },
    };
  }

  async getFriends(
    userId: string,
    options: FriendQueryOptions
  ): Promise<PaginatedResult<any>> {
    const { items, total } = await this.friendRepo.findFriends(userId, options);
    return {
      items,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit) || 1,
      },
    };
  }

  async removeFriend(userId: string, targetUserId: string): Promise<void> {
    if (userId === targetUserId) {
      throw new ValidationError("Không thể hủy kết bạn với chính mình");
    }

    const isFriend = await this.friendRepo.isFriend(userId, targetUserId);
    if (!isFriend) {
      throw new NotFoundError("Người dùng này không nằm trong danh sách bạn bè");
    }

    await this.friendRepo.removeFriendship(userId, targetUserId);
  }

  async getRelationshipStatus(
    userId: string,
    targetUserId: string
  ): Promise<{ targetUserId: string; status: RelationshipStatus }> {
    if (userId === targetUserId) {
      return { targetUserId, status: "NONE" };
    }

    const isBlocked = await this.blockRepo.isBlocked(userId, targetUserId);
    if (isBlocked) {
      return { targetUserId, status: "BLOCKED" };
    }

    const isFriend = await this.friendRepo.isFriend(userId, targetUserId);
    if (isFriend) {
      return { targetUserId, status: "FRIENDS" };
    }

    const sentPending = await this.friendRequestRepo.findPending(userId, targetUserId);
    if (sentPending) {
      return { targetUserId, status: "PENDING_SENT" };
    }

    const receivedPending = await this.friendRequestRepo.findPending(targetUserId, userId);
    if (receivedPending) {
      return { targetUserId, status: "PENDING_RECEIVED" };
    }

    return { targetUserId, status: "NONE" };
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new ValidationError("Không thể tự chặn chính mình");
    }

    const targetUser = await this.userRepo.findById(blockedId);
    if (!targetUser) {
      throw new NotFoundError("Không tìm thấy người dùng cần chặn");
    }

    const alreadyBlocked = await this.blockRepo.isBlockedBy(blockerId, blockedId);
    if (alreadyBlocked) {
      throw new ConflictError("Bạn đã chặn người dùng này rồi");
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await this.blockRepo.createBlock(blockerId, blockedId, session);
        await this.friendRepo.removeFriendship(blockerId, blockedId, session);
        await this.friendRequestRepo.cancelPendingBetween(blockerId, blockedId, session);
      });
    } finally {
      await session.endSession();
    }
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const isBlocked = await this.blockRepo.isBlockedBy(blockerId, blockedId);
    if (!isBlocked) {
      throw new NotFoundError("Người dùng này không nằm trong danh sách chặn của bạn");
    }

    await this.blockRepo.removeBlock(blockerId, blockedId);
  }

  async getBlockedUsers(
    blockerId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<any>> {
    const { items, total } = await this.blockRepo.findBlockedUsers(blockerId, options);
    return {
      items,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit) || 1,
      },
    };
  }
}

export const friendService = new FriendService();
```

- [x] **Step 4: Chạy test để xác nhận test vượt qua**

Chạy:
```bash
npx vitest run tests/services/friend.service.test.ts
```
Kỳ vọng: PASS (8/8 tests).

- [x] **Step 5: Commit thay đổi**

```bash
git add src/services/friend.service.ts tests/services/friend.service.test.ts
git commit -m "feat(services): implement FriendService with business logic and transactions"
```

---

### Task 4: Controller & Routes Layer (`friend.controller.ts`, `friend.routes.ts`)

**Files:**
- Create: `backend/src/controllers/friend.controller.ts`
- Create: `backend/src/routes/friend.routes.ts`
- Modify: `backend/src/routes/index.ts:1-15`
- Test: `backend/tests/routes/friend.routes.test.ts`

**Interfaces:**
- Produces: `friendController`, `friendRoutes`, mounted under `/api/friends`

- [x] **Step 1: Viết test kiểm tra cấu hình Route và Controller**

Tạo file `backend/tests/routes/friend.routes.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { friendRoutes } from "../../src/routes/friend.routes";
import { friendController } from "../../src/controllers/friend.controller";

describe("Friend Routes & Controller Configuration", () => {
  it("friendController có đầy đủ các handler methods", () => {
    expect(typeof friendController.sendRequest).toBe("function");
    expect(typeof friendController.getReceivedRequests).toBe("function");
    expect(typeof friendController.getSentRequests).toBe("function");
    expect(typeof friendController.acceptRequest).toBe("function");
    expect(typeof friendController.rejectRequest).toBe("function");
    expect(typeof friendController.cancelRequest).toBe("function");
    expect(typeof friendController.getFriends).toBe("function");
    expect(typeof friendController.removeFriend).toBe("function");
    expect(typeof friendController.getRelationshipStatus).toBe("function");
    expect(typeof friendController.blockUser).toBe("function");
    expect(typeof friendController.unblockUser).toBe("function");
    expect(typeof friendController.getBlockedUsers).toBe("function");
  });

  it("friendRoutes là một router instance hợp lệ của Express", () => {
    expect(friendRoutes).toBeDefined();
    expect(typeof friendRoutes).toBe("function");
  });
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Chạy:
```bash
npx vitest run tests/routes/friend.routes.test.ts
```
Kỳ vọng: FAIL vì `friend.routes.ts` và `friend.controller.ts` chưa tồn tại.

- [x] **Step 3: Triển khai Controller, Route và mount vào `src/routes/index.ts`**

1. Tạo `backend/src/controllers/friend.controller.ts`:
```typescript
import { Request, Response, NextFunction } from "express";
import { friendService, FriendService } from "../services/friend.service";

export class FriendController {
  constructor(private service: FriendService = friendService) {}

  sendRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const senderId = req.user!.userId;
      const { receiverId, note } = req.body;
      const request = await this.service.sendFriendRequest(senderId, receiverId, note);
      res.status(201).json({
        success: true,
        data: request,
      });
    } catch (error) {
      next(error);
    }
  };

  getReceivedRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await this.service.getReceivedRequests(userId, { page, limit });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getSentRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await this.service.getSentRequests(userId, { page, limit });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  acceptRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      const result = await this.service.acceptFriendRequest(userId, requestId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  rejectRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      await this.service.rejectFriendRequest(userId, requestId);
      res.status(200).json({
        success: true,
        message: "Đã từ chối lời mời kết bạn",
      });
    } catch (error) {
      next(error);
    }
  };

  cancelRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      await this.service.cancelFriendRequest(userId, requestId);
      res.status(200).json({
        success: true,
        message: "Đã hủy lời mời kết bạn",
      });
    } catch (error) {
      next(error);
    }
  };

  getFriends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const onlineOnly = req.query.onlineOnly === "true" || req.query.onlineOnly === true;

      const result = await this.service.getFriends(userId, {
        page,
        limit,
        search,
        onlineOnly,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  removeFriend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { targetUserId } = req.params;
      await this.service.removeFriend(userId, targetUserId);
      res.status(200).json({
        success: true,
        message: "Đã hủy kết bạn thành công",
      });
    } catch (error) {
      next(error);
    }
  };

  getRelationshipStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { targetUserId } = req.params;
      const result = await this.service.getRelationshipStatus(userId, targetUserId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  blockUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const blockerId = req.user!.userId;
      const { targetUserId } = req.params;
      await this.service.blockUser(blockerId, targetUserId);
      res.status(201).json({
        success: true,
        message: "Đã chặn người dùng thành công",
      });
    } catch (error) {
      next(error);
    }
  };

  unblockUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const blockerId = req.user!.userId;
      const { targetUserId } = req.params;
      await this.service.unblockUser(blockerId, targetUserId);
      res.status(200).json({
        success: true,
        message: "Đã bỏ chặn người dùng thành công",
      });
    } catch (error) {
      next(error);
    }
  };

  getBlockedUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const blockerId = req.user!.userId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await this.service.getBlockedUsers(blockerId, { page, limit });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const friendController = new FriendController();
```

2. Tạo `backend/src/routes/friend.routes.ts`:
```typescript
import { Router } from "express";
import { friendController } from "../controllers/friend.controller";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import {
  SendFriendRequestSchema,
  FriendQuerySchema,
  PaginationQuerySchema,
  RequestIdParamSchema,
  TargetUserParamSchema,
} from "../schemas/friend.schema";

const router = Router();

// Yêu cầu xác thực JWT trên tất cả routes
router.use(requireAuth);

// 1. Quản lý Lời mời kết bạn
router.post("/requests", validate(SendFriendRequestSchema), friendController.sendRequest);
router.get("/requests/received", validate(PaginationQuerySchema), friendController.getReceivedRequests);
router.get("/requests/sent", validate(PaginationQuerySchema), friendController.getSentRequests);
router.post("/requests/:requestId/accept", validate(RequestIdParamSchema), friendController.acceptRequest);
router.post("/requests/:requestId/reject", validate(RequestIdParamSchema), friendController.rejectRequest);
router.delete("/requests/:requestId/cancel", validate(RequestIdParamSchema), friendController.cancelRequest);

// 2. Quản lý Chặn người dùng (đặt trước /:targetUserId để tránh xung đột params)
router.get("/blocks", validate(PaginationQuerySchema), friendController.getBlockedUsers);
router.post("/blocks/:targetUserId", validate(TargetUserParamSchema), friendController.blockUser);
router.delete("/blocks/:targetUserId", validate(TargetUserParamSchema), friendController.unblockUser);

// 3. Quản lý Bạn bè & Trạng thái
router.get("/status/:targetUserId", validate(TargetUserParamSchema), friendController.getRelationshipStatus);
router.get("/", validate(FriendQuerySchema), friendController.getFriends);
router.delete("/:targetUserId", validate(TargetUserParamSchema), friendController.removeFriend);

export const friendRoutes = router;
```

3. Cập nhật `backend/src/routes/index.ts` để mount `/api/friends`:
```typescript
import { Router } from "express";
import { healthRoutes } from "./health.routes";
import { authRoutes } from "./auth.routes";
import { conversationRoutes } from "./conversation.routes";
import { userRoutes } from "./user.routes";
import { friendRoutes } from "./friend.routes";

const apiRouter = Router();

apiRouter.use("/health", healthRoutes);
apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/conversations", conversationRoutes);
apiRouter.use("/friends", friendRoutes);

export { apiRouter };
```

- [x] **Step 4: Chạy test để xác nhận test vượt qua**

Chạy:
```bash
npx vitest run tests/routes/friend.routes.test.ts
```
Kỳ vọng: PASS (2/2 tests).

- [x] **Step 5: Commit thay đổi**

```bash
git add src/controllers/friend.controller.ts src/routes/friend.routes.ts src/routes/index.ts tests/routes/friend.routes.test.ts
git commit -m "feat(routes): implement friendController, friendRoutes and mount to apiRouter"
```

---

### Task 5: End-to-End API Integration Tests (`tests/friend.test.ts`)

**Files:**
- Create: `backend/tests/friend.test.ts`

**Interfaces:**
- Consumes: `createApp()`, JWT generation utils, Mongoose Models, `/api/friends/*`

- [x] **Step 1: Viết bộ test tích hợp HTTP hoàn chỉnh**

Tạo file `backend/tests/friend.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { generateAccessToken } from "../src/utils/auth";
import { friendService } from "../src/services/friend.service";

describe("Friend APIs Integration (/api/friends)", () => {
  const app = createApp();
  const user1Id = "507f1f77bcf86cd799439011";
  const user2Id = "607f1f77bcf86cd799439012";
  let token1: string;
  let token2: string;

  beforeEach(() => {
    token1 = generateAccessToken({
      userId: user1Id,
      username: "user1",
      email: "user1@example.com",
      role: "USER",
    });
    token2 = generateAccessToken({
      userId: user2Id,
      username: "user2",
      email: "user2@example.com",
      role: "USER",
    });
  });

  describe("Authentication Guard", () => {
    it("trả về 401 UNAUTHORIZED nếu gọi API khi chưa đăng nhập", async () => {
      const res = await request(app).get("/api/friends");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Validation Errors", () => {
    it("POST /api/friends/requests trả về 400 nếu receiverId sai định dạng ObjectId", async () => {
      const res = await request(app)
        .post("/api/friends/requests")
        .set("Authorization", `Bearer ${token1}`)
        .send({ receiverId: "invalid-id" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("POST /api/friends/requests trả về 400 nếu note vượt quá 200 ký tự", async () => {
      const res = await request(app)
        .post("/api/friends/requests")
        .set("Authorization", `Bearer ${token1}`)
        .send({ receiverId: user2Id, note: "x".repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Friends & Blocks Listing", () => {
    it("GET /api/friends trả về 200 OK và danh sách bạn bè phân trang", async () => {
      const res = await request(app)
        .get("/api/friends?page=1&limit=10")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data).toHaveProperty("pagination");
    });

    it("GET /api/friends/blocks trả về 200 OK và danh sách người bị chặn", async () => {
      const res = await request(app)
        .get("/api/friends/blocks")
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("items");
      expect(res.body.data).toHaveProperty("pagination");
    });

    it("GET /api/friends/status/:targetUserId trả về trạng thái quan hệ hợp lệ", async () => {
      const res = await request(app)
        .get(`/api/friends/status/${user2Id}`)
        .set("Authorization", `Bearer ${token1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetUserId).toBe(user2Id);
      expect(res.body.data.status).toBeDefined();
    });
  });
});
```

- [x] **Step 2: Chạy test tích hợp**

Chạy:
```bash
npx vitest run tests/friend.test.ts
```
Kỳ vọng: PASS (6/6 tests).

- [x] **Step 3: Chạy toàn bộ test suite và TypeScript type-check**

Chạy:
```bash
npm run test
npm run type-check
```
Kỳ vọng: 100% tests vượt qua và không có lỗi biên dịch TypeScript.

- [x] **Step 4: Commit hoàn tất**

```bash
git add tests/friend.test.ts
git commit -m "test(api): add full end-to-end integration tests for Friend APIs"
```
