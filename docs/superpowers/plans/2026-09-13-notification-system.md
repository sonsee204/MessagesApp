# Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng toàn diện hệ thống Thông báo (Notification Subsystem) bao gồm Backend (Mongoose Model, Zod Validation, Repository, Service, Controller, REST API Endpoints, Socket.IO real-time emission) và Frontend (Service, Store, UI View danh sách thông báo) phục vụ ứng dụng nhắn tin.

**Architecture:** Áp dụng kiến trúc 3 tầng chuẩn (Layered Architecture): Controller tiếp nhận request và validate Zod schema, Service xử lý nghiệp vụ thông báo và phát sự kiện Socket.IO tới room người nhận, Repository giao tiếp CSDL MongoDB với Model `Notification`. Phía frontend sử dụng Zustand Store kết hợp REST Client và Socket Listener để cập nhật badge số lượng và danh sách thông báo tức thời.

**Tech Stack:** Express.js, TypeScript, MongoDB (Mongoose), Socket.IO, Zod, Vitest, React, Zustand, Tailwind CSS, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-09-13-notification-system-design.md`

## Global Constraints
- Bắt buộc chú thích mã nguồn bằng Tiếng Việt trên tất cả các file tạo mới hoặc sửa đổi (Mô hình, DTO, Schema, Repository, Service, Controller, Routes, UI Component).
- Tuân thủ Zero-Trust Input: Mọi tham số từ client (`query`, `params`, `body`) phải được validate qua Zod Schema.
- Tuân thủ cấu trúc phản hồi chuẩn `{ success: true, data: ... }` và mã lỗi `{ success: false, error: { code, message, details } }`.
- Tuyệt đối không query DB trong vòng lặp (N+1 query defense).
- Tất cả các thao tác Git chỉ stage trong thư mục `appmessaging` (Repo root là `D:/`).

---

### Task 1: Notification Model, Types & Zod Schemas

**Files:**
- Create: `backend/src/models/notification.model.ts`
- Create: `backend/src/schemas/notification.schema.ts`
- Modify: `backend/src/models/index.ts`
- Test: `backend/tests/schemas/notification.schema.test.ts`
- Test: `backend/tests/models/notification.model.test.ts`

**Interfaces:**
- Produces: `NotificationModel`, `INotification`, `NotificationType`, `getNotificationsQuerySchema`, `notificationIdParamSchema`.

- [ ] **Step 1: Write failing schema and model unit tests**

```typescript
// backend/tests/schemas/notification.schema.test.ts
import { describe, it, expect } from "vitest";
import { getNotificationsQuerySchema, notificationIdParamSchema } from "../../src/schemas/notification.schema";

describe("Notification Schemas Validation", () => {
  it("chấp nhận query hợp lệ với page và limit", () => {
    const parsed = getNotificationsQuerySchema.parse({ page: "1", limit: "20" });
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });

  it("từ chối limit vượt quá 50", () => {
    expect(() => getNotificationsQuerySchema.parse({ limit: "100" })).toThrow();
  });

  it("chấp nhận id ObjectId 24 ký tự hex hợp lệ", () => {
    const validId = "507f1f77bcf86cd799439011";
    expect(notificationIdParamSchema.parse({ id: validId }).id).toBe(validId);
  });

  it("từ chối id không phải ObjectId", () => {
    expect(() => notificationIdParamSchema.parse({ id: "invalid-id" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test backend/tests/schemas/notification.schema.test.ts`
Expected: FAIL (File not found or modules not exported)

- [ ] **Step 3: Implement Notification Model and Zod Schemas**

Tạo `backend/src/models/notification.model.ts` và `backend/src/schemas/notification.schema.ts`, đồng thời xuất `NotificationModel` qua `backend/src/models/index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test backend/tests/schemas/notification.schema.test.ts backend/tests/models/notification.model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:/ add appmessaging/backend/src/models/notification.model.ts appmessaging/backend/src/schemas/notification.schema.ts appmessaging/backend/src/models/index.ts appmessaging/backend/tests/schemas/notification.schema.test.ts appmessaging/backend/tests/models/notification.model.test.ts
git -C D:/ commit -m "feat(notification): add notification mongoose model and zod validation schemas"
```

---

### Task 2: Notification Repository Layer

**Files:**
- Create: `backend/src/repositories/notification.repository.ts`
- Test: `backend/tests/repositories/notification.repository.test.ts`

**Interfaces:**
- Consumes: `NotificationModel`, `INotification`
- Produces: `NotificationRepository` with methods: `create`, `findById`, `findByRecipientIdPaginated`, `countUnreadByRecipientId`, `markAsRead`, `markAllAsRead`, `deleteById`.

- [ ] **Step 1: Write failing repository unit test**

```typescript
// backend/tests/repositories/notification.repository.test.ts
import { describe, it, expect, vi } from "vitest";
import { NotificationRepository } from "../../src/repositories/notification.repository";
import { NotificationModel } from "../../src/models/notification.model";

describe("NotificationRepository Unit Tests", () => {
  it("đếm chính xác số lượng thông báo chưa đọc của người dùng", async () => {
    const countSpy = vi.spyOn(NotificationModel, "countDocuments").mockResolvedValue(3 as any);
    const repo = new NotificationRepository();
    const count = await repo.countUnreadByRecipientId("507f1f77bcf86cd799439011");
    expect(count).toBe(3);
    expect(countSpy).toHaveBeenCalledWith({
      recipientId: expect.anything(),
      isRead: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test backend/tests/repositories/notification.repository.test.ts`
Expected: FAIL (Repository not implemented)

- [ ] **Step 3: Implement NotificationRepository**

Xây dựng `NotificationRepository` với các truy vấn tối ưu index, phân trang và populate trường `senderId` (`displayName`, `username`, `avatarUrl`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test backend/tests/repositories/notification.repository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:/ add appmessaging/backend/src/repositories/notification.repository.ts appmessaging/backend/tests/repositories/notification.repository.test.ts
git -C D:/ commit -m "feat(notification): implement notification repository layer with pagination"
```

---

### Task 3: Notification Service Layer with Socket.IO Real-Time Dispatch

**Files:**
- Create: `backend/src/services/notification.service.ts`
- Test: `backend/tests/services/notification.service.test.ts`

**Interfaces:**
- Consumes: `NotificationRepository`, `Socket.IO Server instance (optional/injected)`
- Produces: `NotificationService` with methods: `createNotification`, `getUserNotifications`, `markNotificationAsRead`, `markAllNotificationsAsRead`, `deleteNotification`.

- [ ] **Step 1: Write failing service unit test**

```typescript
// backend/tests/services/notification.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationService } from "../../src/services/notification.service";
import { NotificationRepository } from "../../src/repositories/notification.repository";

describe("NotificationService Unit Tests", () => {
  let service: NotificationService;
  let repoMock: any;

  beforeEach(() => {
    repoMock = {
      create: vi.fn(),
      findByRecipientIdPaginated: vi.fn(),
      countUnreadByRecipientId: vi.fn(),
      findById: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteById: vi.fn(),
    };
    service = new NotificationService(repoMock);
  });

  it("từ chối đánh dấu đã đọc nếu thông báo không thuộc về người dùng", async () => {
    repoMock.findById.mockResolvedValue({
      _id: "notif-1",
      recipientId: { toString: () => "user-other" },
      isRead: false,
    });

    await expect(service.markNotificationAsRead("user-me", "notif-1")).rejects.toThrow(
      "Không tìm thấy thông báo"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test backend/tests/services/notification.service.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement NotificationService**

Hiện thực hóa toàn bộ logic nghiệp vụ, kiểm tra quyền sở hữu thông báo (`recipientId`), và phát tín hiệu Socket.IO (`notification:new`, `notification:read`) khi có instance IO.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test backend/tests/services/notification.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:/ add appmessaging/backend/src/services/notification.service.ts appmessaging/backend/tests/services/notification.service.test.ts
git -C D:/ commit -m "feat(notification): implement notification service with ownership security checks"
```

---

### Task 4: Notification Controller, Routes & End-to-End Integration Tests

**Files:**
- Create: `backend/src/controllers/notification.controller.ts`
- Create: `backend/src/routes/notification.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/notification.test.ts`

**Interfaces:**
- Consumes: `NotificationService`, `requireAuth` middleware, Zod validation middleware.
- Produces: API endpoints `/api/notifications`, `/api/notifications/:id/read`, `/api/notifications/read-all`, `/api/notifications/:id`.

- [ ] **Step 1: Write integration tests for Notification API**

```typescript
// backend/tests/notification.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";

describe("Notification API Integration Tests (/api/notifications)", () => {
  it("trả về 401 UNAUTHORIZED khi chưa đăng nhập", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test backend/tests/notification.test.ts`
Expected: FAIL (Route not registered, returns 404)

- [ ] **Step 3: Implement Controller, Routes and mount to apiRouter**

Hiện thực `NotificationController`, khai báo routes với `validateRequest` middleware, đăng ký route tại `backend/src/routes/index.ts`.

- [ ] **Step 4: Run tests to verify all 29 test suites pass**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git -C D:/ add appmessaging/backend/src/controllers/notification.controller.ts appmessaging/backend/src/routes/notification.routes.ts appmessaging/backend/src/routes/index.ts appmessaging/backend/tests/notification.test.ts
git -C D:/ commit -m "feat(notification): wire up notification controller and routes with full integration tests"
```

---

### Task 5: Trigger Notification on Friend Request Events

**Files:**
- Modify: `backend/src/services/friend.service.ts`
- Test: `backend/tests/services/friend.service.test.ts`
- Test: `backend/tests/friend.test.ts`

**Interfaces:**
- Consumes: `NotificationService.createNotification` inside `sendFriendRequest` & `respondFriendRequest`.

- [ ] **Step 1: Add test asserting notification creation when sending friend request**

Cập nhật `backend/tests/services/friend.service.test.ts` để kiểm tra hàm `notificationService.createNotification` được gọi khi gửi lời mời kết bạn và khi chấp nhận lời mời.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test backend/tests/services/friend.service.test.ts`
Expected: FAIL

- [ ] **Step 3: Wire NotificationService call into FriendService**

Gọi `notificationService.createNotification` trong `sendFriendRequest` với loại `FRIEND_REQUEST_RECEIVED` và trong `respondFriendRequest` (khi status = ACCEPTED) với loại `FRIEND_REQUEST_ACCEPTED`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test backend/tests/services/friend.service.test.ts backend/tests/friend.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:/ add appmessaging/backend/src/services/friend.service.ts appmessaging/backend/tests/services/friend.service.test.ts
git -C D:/ commit -m "feat(notification): trigger real-time notifications on friend request events"
```

---

### Task 6: Frontend Notification Store, Service & Popover Panel

**Files:**
- Create: `frontend/src/features/notifications/types/notification.types.ts`
- Create: `frontend/src/features/notifications/services/notification.service.ts`
- Create: `frontend/src/features/notifications/stores/notification.store.ts`
- Create: `frontend/src/features/notifications/components/NotificationListModal.tsx`
- Modify: `frontend/src/features/chat/components/ConversationSidebar.tsx`

**Interfaces:**
- Consumes: Backend `/api/notifications` endpoints & Socket events (`notification:new`, `notification:read`).
- Produces: UI Notification Popover hiển thị danh sách thông báo thực tế khi bấm vào nút "Thông báo" trên `ConversationSidebar`.

- [ ] **Step 1: Create TypeScript types & REST service client**

Định nghĩa interface `AppNotification` và các API call: `getNotifications`, `markAsRead`, `markAllAsRead`, `deleteNotification`.

- [ ] **Step 2: Implement Zustand Notification Store with Socket.IO listener**

Tạo `useNotificationStore` lưu trữ danh sách thông báo, `unreadCount`, và kết nối với socket để nhận thông báo tức thời.

- [ ] **Step 3: Create NotificationListModal component (Tactile Neo-Brutalist design)**

Tạo giao diện hiển thị danh sách thông báo chuẩn Neo-Brutalist:
- Header: Tiêu đề "Thông báo", nút "Đánh dấu tất cả đã đọc", nút đóng.
- Body: Danh sách thẻ thông báo kèm avatar người gửi, thời gian tương đối, nút hành động xem lời mời kết bạn hoặc hội thoại.
- Empty state khi không có thông báo nào.

- [ ] **Step 4: Connect NotificationListModal to ConversationSidebar**

Gắn số đếm `unreadCount` thật vào badge đỏ của nút "Thông báo" và mở `NotificationListModal` khi nhấp chuột.

- [ ] **Step 5: Verify build frontend**

Run: `npm --prefix ../frontend run build`
Expected: PASS (0 type errors, production build succeeds)

- [ ] **Step 6: Commit**

```bash
git -C D:/ add appmessaging/frontend/src/features/notifications/ appmessaging/frontend/src/features/chat/components/ConversationSidebar.tsx
git -C D:/ commit -m "feat(frontend): implement notification store, service, and notification modal in sidebar"
```
