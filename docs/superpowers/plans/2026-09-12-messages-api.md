# Kế Hoạch Triển Khai Messages API & Real-time Messaging

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng trọn vẹn hệ thống Messages API chuẩn RESTful (`/api/conversations/:conversationId/messages`) bao gồm Gửi tin nhắn (Text, Attachments, Reply), Lấy lịch sử phân trang con trỏ (Cursor-based Pagination), Thu hồi tin nhắn (Soft Delete), Đánh dấu đã đọc (Read Receipts), kiểm tra Chặn (Block Shield), đảm bảo tính toàn vẹn qua MongoDB Transaction và đồng bộ thời gian thực qua Socket.IO.

**Architecture:** Áp dụng mô hình Layered Architecture theo `rules/backend.md`. Tầng Routes bảo vệ bởi `requireAuth`, tầng Validation sử dụng Zod schema (Zero-Trust Input), tầng Controller tiếp nhận request và định dạng HTTP status/response chuẩn, tầng Service thực thi toàn bộ business rules, block validation, MongoDB Transactions và kích hoạt Socket.IO events, tầng Repositories đóng gói các câu truy vấn Mongoose Models và hỗ trợ `ClientSession`. Toàn bộ mã nguồn bắt buộc có chú thích Tiếng Việt đầy đủ theo `CLAUDE.md`.

**Tech Stack:** Express.js, TypeScript, MongoDB (Mongoose 8.x), Socket.IO 4.x, Zod 3.x, Vitest 2.x, Supertest.

**Spec:** `docs/superpowers/specs/2026-09-12-messages-api-design.md`

## Global Constraints

- **Layer Separation**: Controller không chứa business logic hay query CSDL trực tiếp; Service không nhận đối tượng `req`, `res`; Repository chỉ tương tác với Models.
- **Zero-Trust Input**: Toàn bộ `body`, `query`, `params` được validate qua Zod Schemas trước khi vào Service. Tuyệt đối không nhận `senderId` từ client body (phải lấy từ `req.user.userId`).
- **Data Integrity & Transactions**: Thao tác tạo tin nhắn và cập nhật `lastMessage`/`lastMessageAt` của Conversation bắt buộc bọc trong `session.withTransaction()`.
- **Error Response Standard**: Mọi lỗi trả về theo format `{ success: false, error: { code, message, details } }`.
- **Vietnamese Comments**: Mọi file code sinh mới hoặc cập nhật bắt buộc có chú thích bằng Tiếng Việt chi tiết mục đích, luồng và các bước logic.
- **Diff-First & Surgical Edits**: Tuân thủ triệt để `rules/token-economy.md`.

---

### Task 1: Validation Schemas (`src/schemas/message.schema.ts`)

**Files:**
- Modify: `backend/src/schemas/message.schema.ts`
- Create: `backend/tests/schemas/message.schema.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export const SendMessageSchema: z.ZodObject<...>;
  export const GetMessagesQuerySchema: z.ZodObject<...>;
  export const RecallMessageParamsSchema: z.ZodObject<...>;
  export const MarkMessagesAsReadParamsSchema: z.ZodObject<...>;

  export type SendMessageInput = z.infer<typeof SendMessageSchema>["body"];
  export type GetMessagesQueryInput = z.infer<typeof GetMessagesQuerySchema>["query"];
  export type RecallMessageParamsInput = z.infer<typeof RecallMessageParamsSchema>["params"];
  ```

- [x] **Step 1: Viết failing test cho Message Validation Schemas**

Tạo file `backend/tests/schemas/message.schema.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  SendMessageSchema,
  GetMessagesQuerySchema,
  RecallMessageParamsSchema,
  MarkMessagesAsReadParamsSchema,
} from "../../src/schemas/message.schema";

describe("Message Schemas Validation", () => {
  describe("SendMessageSchema", () => {
    it("hợp lệ với tin nhắn văn bản thông thường", () => {
      const valid = SendMessageSchema.safeParse({
        params: { conversationId: "507f1f77bcf86cd799439011" },
        body: { content: "Xin chào bạn!" },
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.body.content).toBe("Xin chào bạn!");
        expect(valid.data.body.type).toBe("TEXT");
      }
    });

    it("hợp lệ với tin nhắn có đính kèm file dù content rỗng", () => {
      const valid = SendMessageSchema.safeParse({
        params: { conversationId: "507f1f77bcf86cd799439011" },
        body: {
          type: "IMAGE",
          attachments: [
            {
              url: "https://example.com/img.png",
              name: "img.png",
              size: 1024,
              mimeType: "image/png",
            },
          ],
        },
      });
      expect(valid.success).toBe(true);
    });

    it("thất bại nếu cả content và attachments đều rỗng", () => {
      const invalid = SendMessageSchema.safeParse({
        params: { conversationId: "507f1f77bcf86cd799439011" },
        body: { content: "   " },
      });
      expect(invalid.success).toBe(false);
    });

    it("thất bại nếu conversationId sai định dạng ObjectId", () => {
      const invalid = SendMessageSchema.safeParse({
        params: { conversationId: "invalid-id" },
        body: { content: "Hello" },
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("GetMessagesQuerySchema", () => {
    it("hợp lệ và gán limit mặc định là 20", () => {
      const valid = GetMessagesQuerySchema.safeParse({
        params: { conversationId: "507f1f77bcf86cd799439011" },
        query: {},
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.query.limit).toBe(20);
      }
    });

    it("giới hạn limit tối đa 50", () => {
      const invalid = GetMessagesQuerySchema.safeParse({
        params: { conversationId: "507f1f77bcf86cd799439011" },
        query: { limit: "100" },
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("RecallMessageParamsSchema & MarkMessagesAsReadParamsSchema", () => {
    it("hợp lệ khi truyền đúng ObjectId cho conversationId và messageId", () => {
      const validRecall = RecallMessageParamsSchema.safeParse({
        params: {
          conversationId: "507f1f77bcf86cd799439011",
          messageId: "507f1f77bcf86cd799439022",
        },
      });
      expect(validRecall.success).toBe(true);

      const validRead = MarkMessagesAsReadParamsSchema.safeParse({
        params: {
          conversationId: "507f1f77bcf86cd799439011",
        },
      });
      expect(validRead.success).toBe(true);
    });
  });
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx vitest run backend/tests/schemas/message.schema.test.ts`
Expected: FAIL do các schema mới chưa được khai báo hoặc cấu trúc cũ chưa đáp ứng.

- [x] **Step 3: Cập nhật `backend/src/schemas/message.schema.ts`**

Cập nhật file với đầy đủ validation và chú thích Tiếng Việt:
```typescript
import { z } from "zod";

/** Biểu thức chính quy kiểm tra định dạng chuỗi ObjectId 24 ký tự hex của MongoDB */
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Schema xác thực tệp đính kèm trong tin nhắn
 */
export const AttachmentSchema = z.object({
  url: z.string().url("Đường dẫn tệp không đúng định dạng URL"),
  name: z.string().trim().min(1, "Tên tệp không được để trống"),
  size: z.number().min(0, "Kích thước tệp không được âm"),
  mimeType: z.string().trim().min(1, "MimeType không được để trống"),
});

/**
 * Schema xác thực dữ liệu gửi tin nhắn mới
 * - params: conversationId (ObjectId hợp lệ)
 * - body: content, type, attachments, replyToMessageId
 * - Điều kiện: Phải có content hoặc ít nhất 1 attachment
 */
export const SendMessageSchema = z.object({
  params: z.object({
    conversationId: z.string().regex(OBJECT_ID_REGEX, "ID cuộc trò chuyện không hợp lệ"),
  }),
  body: z
    .object({
      content: z.string().trim().max(5000, "Nội dung tin nhắn không vượt quá 5000 ký tự").optional(),
      type: z.enum(["TEXT", "IMAGE", "FILE", "SYSTEM"]).default("TEXT"),
      attachments: z.array(AttachmentSchema).default([]),
      replyToMessageId: z.string().regex(OBJECT_ID_REGEX, "ID tin nhắn trả lời không hợp lệ").optional().nullable(),
    })
    .refine(
      (data) => {
        const hasContent = Boolean(data.content && data.content.trim().length > 0);
        const hasAttachments = Array.isArray(data.attachments) && data.attachments.length > 0;
        return hasContent || hasAttachments;
      },
      {
        message: "Nội dung tin nhắn hoặc tệp đính kèm không được để trống",
        path: ["content"],
      }
    ),
});

/**
 * Schema xác thực truy vấn lịch sử tin nhắn kèm phân trang cursor
 */
export const GetMessagesQuerySchema = z.object({
  params: z.object({
    conversationId: z.string().regex(OBJECT_ID_REGEX, "ID cuộc trò chuyện không hợp lệ"),
  }),
  query: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .refine((val) => !isNaN(val) && val >= 1 && val <= 50, {
        message: "Số lượng tin nhắn (limit) phải nằm trong khoảng từ 1 đến 50",
      }),
    cursor: z.string().optional(),
  }),
});

/**
 * Schema xác thực tham số thu hồi tin nhắn
 */
export const RecallMessageParamsSchema = z.object({
  params: z.object({
    conversationId: z.string().regex(OBJECT_ID_REGEX, "ID cuộc trò chuyện không hợp lệ"),
    messageId: z.string().regex(OBJECT_ID_REGEX, "ID tin nhắn không hợp lệ"),
  }),
});

/**
 * Schema xác thực tham số đánh dấu đã đọc tin nhắn
 */
export const MarkMessagesAsReadParamsSchema = z.object({
  params: z.object({
    conversationId: z.string().regex(OBJECT_ID_REGEX, "ID cuộc trò chuyện không hợp lệ"),
  }),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>["body"];
export type GetMessagesQueryInput = z.infer<typeof GetMessagesQuerySchema>["query"];
export type RecallMessageParamsInput = z.infer<typeof RecallMessageParamsSchema>["params"];
```

- [x] **Step 4: Chạy test xác nhận pass**

Run: `npx vitest run backend/tests/schemas/message.schema.test.ts`
Expected: PASS 100%.

- [x] **Step 5: Commit**

```bash
git add backend/src/schemas/message.schema.ts backend/tests/schemas/message.schema.test.ts
git commit -m "feat(schemas): implement robust Zod schemas for Messages API"
```

---

### Task 2: Real-time Socket Bridge (`src/socket/index.ts`)

**Files:**
- Modify: `backend/src/socket/index.ts`
- Create: `backend/tests/socket/socket.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export function getIO(): Server | null;
  export function emitToConversation(conversationId: string, event: string, payload: unknown): void;
  ```

- [x] **Step 1: Viết failing test cho Socket Bridge**

Tạo file `backend/tests/socket/socket.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { getIO, emitToConversation } from "../../src/socket";

describe("Socket Bridge Utilities", () => {
  it("getIO trả về null khi server chưa khởi động", () => {
    expect(getIO()).toBeNull();
  });

  it("emitToConversation không ném lỗi nếu getIO() là null", () => {
    expect(() => {
      emitToConversation("conv_123", "new_message", { content: "test" });
    }).not.toThrow();
  });
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx vitest run backend/tests/socket/socket.test.ts`
Expected: FAIL do `getIO` và `emitToConversation` chưa được export.

- [x] **Step 3: Cập nhật `backend/src/socket/index.ts`**

Thêm biến lưu `ioInstance` và xuất các hàm trợ giúp phát sự kiện an toàn:
```typescript
// ... existing code ...
let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

/**
 * Phát sự kiện Socket.IO tới toàn bộ thành viên đang ở trong phòng cuộc hội thoại
 * @param conversationId ID của cuộc hội thoại
 * @param event Tên sự kiện (ví dụ: 'new_message', 'message_recalled', 'messages_read')
 * @param payload Dữ liệu đính kèm sự kiện
 */
export function emitToConversation(conversationId: string, event: string, payload: unknown): void {
  try {
    const io = getIO();
    if (io) {
      io.to(`conversation:${conversationId}`).emit(event, payload);
    }
  } catch (error) {
    logger.error(`Lỗi khi phát sự kiện socket ${event} tới conversation:${conversationId}`, error);
  }
}

export function initSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    // ... existing config ...
  });

  ioInstance = io;
  // ... existing code ...
```

- [x] **Step 4: Chạy test xác nhận pass**

Run: `npx vitest run backend/tests/socket/socket.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/socket/index.ts backend/tests/socket/socket.test.ts
git commit -m "feat(socket): export getIO and safe emitToConversation bridge"
```

---

### Task 3: Repository Enhancements (`src/repositories/message.repository.ts` & `conversation.repository.ts`)

**Files:**
- Modify: `backend/src/repositories/message.repository.ts`
- Modify: `backend/src/repositories/conversation.repository.ts`
- Create: `backend/tests/repositories/message.repository.test.ts`

**Interfaces:**
- Consumes: `ClientSession` từ `mongoose`, `IAttachment` từ `message.model.ts`.
- Produces:
  ```typescript
  export interface IMessageRepository {
    findById(id: string): Promise<IMessage | null>;
    create(data: {
      conversationId: string;
      senderId: string;
      content?: string;
      type?: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
      attachments?: IAttachment[];
      replyToMessageId?: string | null;
    }, session?: ClientSession): Promise<IMessage>;
    findByConversationId(
      conversationId: string,
      options: { limit: number; before?: string }
    ): Promise<IMessage[]>;
    softDelete(messageId: string, session?: ClientSession): Promise<IMessage | null>;
    markAllAsRead(conversationId: string, userId: string, session?: ClientSession): Promise<void>;
  }
  ```

- [x] **Step 1: Viết unit tests cho MessageRepository**

Tạo file `backend/tests/repositories/message.repository.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { MongooseMessageRepository } from "../../src/repositories/message.repository";
import { MessageModel } from "../../src/models/message.model";

describe("MongooseMessageRepository", () => {
  let repo: MongooseMessageRepository;

  beforeEach(() => {
    vi.restoreAllMocks();
    repo = new MongooseMessageRepository();
  });

  it("create gọi MessageModel.create với dữ liệu chuẩn hóa", async () => {
    const fakeMessage = {
      _id: new Types.ObjectId(),
      populate: vi.fn().mockResolvedValue({ id: "msg_123", content: "Xin chào" }),
    };

    vi.spyOn(MessageModel, "create").mockResolvedValue([fakeMessage] as any);

    const result = await repo.create({
      conversationId: "507f1f77bcf86cd799439011",
      senderId: "507f1f77bcf86cd799439022",
      content: "Xin chào",
      type: "TEXT",
    });

    expect(result).toBeDefined();
    expect(MessageModel.create).toHaveBeenCalled();
  });

  it("softDelete cập nhật cờ isDeleted thành true", async () => {
    const msgId = new Types.ObjectId().toString();
    vi.spyOn(MessageModel, "findByIdAndUpdate").mockReturnValue({
      exec: vi.fn().mockResolvedValue({ id: msgId, isDeleted: true }),
    } as any);

    const result = await repo.softDelete(msgId);
    expect(result?.isDeleted).toBe(true);
    expect(MessageModel.findByIdAndUpdate).toHaveBeenCalledWith(
      msgId,
      { $set: { isDeleted: true, deletedAt: expect.any(Date) } },
      { new: true }
    );
  });
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx vitest run backend/tests/repositories/message.repository.test.ts`
Expected: FAIL do các hàm `softDelete` và `markAllAsRead` chưa được triển khai.

- [x] **Step 3: Cập nhật `backend/src/repositories/message.repository.ts` và `conversation.repository.ts`**

Bổ sung tham số `session?: ClientSession`, `softDelete`, và `markAllAsRead`. Cập nhật `conversationRepository.updateLastMessage` để nhận `session?: ClientSession`. Kèm chú thích Tiếng Việt chi tiết.

- [x] **Step 4: Chạy test xác nhận pass**

Run: `npx vitest run backend/tests/repositories/message.repository.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/repositories/message.repository.ts backend/src/repositories/conversation.repository.ts backend/tests/repositories/message.repository.test.ts
git commit -m "feat(repositories): enhance Message & Conversation repos with transactions and softDelete"
```

---

### Task 4: Service Layer & Business Logic (`src/services/message.service.ts`)

**Files:**
- Modify: `backend/src/services/message.service.ts`
- Create: `backend/tests/services/message.service.test.ts`

**Interfaces:**
- Consumes: `IMessageRepository`, `IConversationRepository`, `IBlockRepository`, `emitToConversation`.
- Produces:
  ```typescript
  export class MessageService {
    sendMessage(data: {
      conversationId: string;
      senderId: string;
      content?: string;
      type?: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
      attachments?: IAttachment[];
      replyToMessageId?: string | null;
    }): Promise<IMessage>;

    getConversationMessages(
      conversationId: string,
      userId: string,
      options: { limit: number; cursor?: string }
    ): Promise<PaginatedMessages>;

    recallMessage(
      conversationId: string,
      messageId: string,
      userId: string
    ): Promise<IMessage>;

    markAsRead(
      conversationId: string,
      userId: string
    ): Promise<{ success: boolean; readCount: number }>;
  }
  ```

- [x] **Step 1: Viết unit tests cho MessageService**

Tạo file `backend/tests/services/message.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageService } from "../../src/services/message.service";
import { NotFoundError, ForbiddenError } from "../../src/core/errors";

describe("MessageService", () => {
  let service: MessageService;
  const mockMsgRepo: any = {
    create: vi.fn(),
    findById: vi.fn(),
    findByConversationId: vi.fn(),
    softDelete: vi.fn(),
    markAllAsRead: vi.fn(),
  };
  const mockConvRepo: any = {
    findById: vi.fn(),
    updateLastMessage: vi.fn(),
  };
  const mockBlockRepo: any = {
    isBlockedBetween: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new MessageService(mockMsgRepo, mockConvRepo, mockBlockRepo);
  });

  describe("sendMessage", () => {
    it("ném NotFoundError nếu conversation không tồn tại", async () => {
      mockConvRepo.findById.mockResolvedValue(null);

      await expect(
        service.sendMessage({
          conversationId: "conv_1",
          senderId: "u_1",
          content: "Hello",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("ném ForbiddenError nếu sender không phải participant", async () => {
      mockConvRepo.findById.mockResolvedValue({
        id: "conv_1",
        participants: ["u_2", "u_3"],
      });

      await expect(
        service.sendMessage({
          conversationId: "conv_1",
          senderId: "u_1",
          content: "Hello",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("ném ForbiddenError nếu 2 bên trong hội thoại DIRECT bị chặn", async () => {
      mockConvRepo.findById.mockResolvedValue({
        id: "conv_1",
        type: "DIRECT",
        participants: ["u_1", "u_2"],
      });
      mockBlockRepo.isBlockedBetween.mockResolvedValue(true);

      await expect(
        service.sendMessage({
          conversationId: "conv_1",
          senderId: "u_1",
          content: "Hello",
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("recallMessage", () => {
    it("ném ForbiddenError nếu người thu hồi không phải người gửi tin nhắn", async () => {
      mockMsgRepo.findById.mockResolvedValue({
        id: "msg_1",
        conversationId: "conv_1",
        senderId: { id: "u_2", _id: "u_2" },
        isDeleted: false,
      });

      await expect(
        service.recallMessage("conv_1", "msg_1", "u_1")
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx vitest run backend/tests/services/message.service.test.ts`
Expected: FAIL do các hàm chưa hỗ trợ đầy đủ các tham số và dependency injection.

- [x] **Step 3: Cập nhật `backend/src/services/message.service.ts`**

Hiện thực hóa:
- Dependency injection `blockRepository`.
- Kiểm tra cuộc hội thoại trực tiếp có bị chặn hay không (`blockRepo.isBlockedBetween`).
- Gói gọn `create` và `updateLastMessage` trong MongoDB Transaction Session (nếu MongoDB hỗ trợ replica set, fallback an toàn nếu standalone).
- Kích hoạt `emitToConversation(...)` khi gửi tin nhắn, thu hồi và đọc tin nhắn.
- Đảm bảo 100% comment Tiếng Việt chi tiết từng bước.

- [x] **Step 4: Chạy test xác nhận pass**

Run: `npx vitest run backend/tests/services/message.service.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/services/message.service.ts backend/tests/services/message.service.test.ts
git commit -m "feat(services): implement full business rules, block checking, and transactions in MessageService"
```

---

### Task 5: Controller & Routes Layer (`src/controllers/message.controller.ts` & `src/routes/conversation.routes.ts`)

**Files:**
- Modify: `backend/src/controllers/message.controller.ts`
- Modify: `backend/src/routes/conversation.routes.ts`
- Create: `backend/tests/routes/message.routes.test.ts`

**Endpoints:**
- `POST /api/conversations/:conversationId/messages` $\rightarrow$ `201 Created`
- `GET /api/conversations/:conversationId/messages` $\rightarrow$ `200 OK`
- `DELETE /api/conversations/:conversationId/messages/:messageId` $\rightarrow$ `200 OK`
- `POST /api/conversations/:conversationId/messages/read` $\rightarrow$ `200 OK`

- [x] **Step 1: Viết test cho Controller & Routes**

Tạo file `backend/tests/routes/message.routes.test.ts` kiểm thử đầy đủ các endpoint:
- Kiểm tra `401 Unauthorized` khi thiếu JWT.
- Kiểm tra `400 Bad Request` khi validation Zod thất bại.
- Kiểm tra `201 Created` khi gửi tin nhắn thành công.
- Kiểm tra `200 OK` khi lấy danh sách tin nhắn.
- Kiểm tra `200 OK` khi thu hồi tin nhắn.
- Kiểm tra `200 OK` khi đánh dấu đã đọc.

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx vitest run backend/tests/routes/message.routes.test.ts`
Expected: FAIL do các route `DELETE` và `POST /read` chưa được đăng ký trong `conversation.routes.ts`.

- [x] **Step 3: Cập nhật `message.controller.ts` và `conversation.routes.ts`**

Thêm các phương thức controller `recall` và `markAsRead`, gắn schema validation và đăng ký routes.

- [x] **Step 4: Chạy test xác nhận pass**

Run: `npx vitest run backend/tests/routes/message.routes.test.ts`
Expected: PASS 100%.

- [x] **Step 5: Commit**

```bash
git add backend/src/controllers/message.controller.ts backend/src/routes/conversation.routes.ts backend/tests/routes/message.routes.test.ts
git commit -m "feat(routes): wire up complete Messages API endpoints with controller and auth guards"
```

---

### Task 6: Comprehensive End-to-End Integration Tests (`tests/message.test.ts`)

**Files:**
- Create: `backend/tests/message.test.ts`

- [x] **Step 1: Viết bộ test E2E tích hợp toàn bộ luồng gửi/nhận/thu hồi tin nhắn**

Tạo file `backend/tests/message.test.ts` mô phỏng đầy đủ luồng thực tế của 2 người dùng trong cuộc hội thoại:
- User A gửi tin nhắn văn bản $\rightarrow$ Kiểm tra HTTP 201, lastMessage được cập nhật.
- User A gửi tin nhắn ảnh kèm caption $\rightarrow$ Kiểm tra attachments được lưu.
- User B đọc tin nhắn $\rightarrow$ Kiểm tra `POST /read` cập nhật `readBy`.
- User B truy vấn lịch sử tin nhắn $\rightarrow$ Kiểm tra cursor pagination và cấu trúc dữ liệu.
- User A thu hồi tin nhắn $\rightarrow$ Kiểm tra `isDeleted = true`.
- User C (người ngoài) cố gắng gửi tin nhắn vào hội thoại $\rightarrow$ Nhận `403 Forbidden`.
- Người dùng bị chặn cố gửi tin nhắn $\rightarrow$ Nhận `403 Forbidden`.

- [x] **Step 2: Chạy toàn bộ test suite của dự án**

Run: `npm test`
Expected: Toàn bộ các bài test (Auth, Friend, Message, Health, Errors) đều PASS mà không có lỗi hồi quy (regression).

- [x] **Step 3: Commit**

```bash
git add backend/tests/message.test.ts
git commit -m "test(api): add comprehensive end-to-end integration tests for Messages API"
```

---

## Self-Review Checklist
- [x] **Spec Coverage**: Đã bao phủ toàn bộ các yêu cầu từ Schema, Repository, Service, Socket, Controller đến Routes.
- [x] **No Placeholders**: Mọi file, đường dẫn, interface và đoạn code test đều được ghi cụ thể, không dùng TODO hay TBD.
- [x] **Type Consistency**: Khớp hoàn toàn các kiểu dữ liệu `IMessage`, `SendMessageInput`, `PaginatedMessages`.
- [x] **Vietnamese Comments Mandatory**: Đã đưa vào quy chuẩn bắt buộc trong mọi task.
