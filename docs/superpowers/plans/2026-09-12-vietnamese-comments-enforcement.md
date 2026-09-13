# Vietnamese Comments Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thắt chặt quy chuẩn governance bắt buộc chú thích code bằng Tiếng Việt tại các file cấu hình và bổ sung chú thích Tiếng Việt toàn diện cho toàn bộ module Friend APIs.

**Architecture:** Nâng cấp các file governance (`CLAUDE.md`, `rules/backend.md`, `rules/token-economy.md`) để quy định rõ bắt buộc chú thích Tiếng Việt cho mọi khối code mà không bị hiểu nhầm là vi phạm Token Economy; sau đó cập nhật chú thích chi tiết (JSDoc/TSDoc và inline comments) cho Schema, Model, Repository, Service, Controller và Routes của Friend APIs.

**Tech Stack:** Express.js, TypeScript, Mongoose, Zod.

**Spec:** Quy chuẩn chú thích từ `workflows/create-api-endpoint.md` và `workflows/code-review-audit.md`.

## Global Constraints

- **Language**: Toàn bộ chú thích mã nguồn phải viết bằng Tiếng Việt rõ ràng, chuẩn ngữ pháp, súc tích.
- **Diff-First & Surgical Edits**: Ưu tiên công cụ `Edit` thay vì ghi đè file lớn; giữ nguyên 100% logic nghiệp vụ hiện có.
- **Type-Check & Tests**: Mọi thay đổi không được làm hỏng TypeScript types (`npm run type-check`) và tất cả test cases phải tiếp tục pass 100% (`npm run test`).

---

### Task 1: Cập nhật Governance Rules và CLAUDE.md

**Files:**
- Modify: `D:/appmessaging/CLAUDE.md`
- Modify: `D:/appmessaging/.claude/CLAUDE.md`
- Modify: `D:/appmessaging/.claude/rules/backend.md`
- Modify: `D:/appmessaging/.claude/rules/token-economy.md`

- [x] **Step 1: Bổ sung điều khoản bắt buộc chú thích Tiếng Việt vào CLAUDE.md (gốc và .claude/)**
Thêm quy tắc `Vietnamese Comments Mandatory` vào mục `⚡ Direct Communication & Token Minimization`.

- [x] **Step 2: Thêm mục Quy chuẩn chú thích Tiếng Việt vào rules/backend.md**
Quy định rõ cấu trúc comment cho từng tầng: Schema (mục đích trường), Repository (chức năng truy vấn), Service (các bước logic nghiệp vụ và transaction), Controller (HTTP status và định dạng phản hồi).

- [x] **Step 3: Làm rõ quy tắc trong rules/token-economy.md**
Ghi chú rõ Token Economy không cấm comment Tiếng Việt; comment Tiếng Việt là bắt buộc để duy trì tính bảo trì cho dự án.

- [x] **Step 4: Commit thay đổi governance**
`git add CLAUDE.md .claude/CLAUDE.md .claude/rules/backend.md .claude/rules/token-economy.md`
`git commit -m "docs(governance): enforce mandatory Vietnamese comments in CLAUDE.md and backend rules"`

---

### Task 2: Bổ sung chú thích Tiếng Việt cho Schema và Models của Friend APIs

**Files:**
- Modify: `D:/appmessaging/backend/src/schemas/friend.schema.ts`
- Modify: `D:/appmessaging/backend/src/models/friend-request.model.ts`
- Modify: `D:/appmessaging/backend/src/models/friend.model.ts`
- Modify: `D:/appmessaging/backend/src/models/block.model.ts`

- [x] **Step 1: Thêm chú thích cho friend.schema.ts**
Chú thích mục đích của từng Zod schema (`SendFriendRequestSchema`, `PaginationQuerySchema`, `FriendQuerySchema`, `RequestIdParamSchema`, `TargetUserParamSchema`) và các trường validate.

- [x] **Step 2: Thêm chú thích cho friend-request.model.ts**
Chú thích các trường trong `IFriendRequest`, các enum trạng thái (`FriendRequestStatus`), và compound index chống trùng lặp.

- [x] **Step 3: Thêm chú thích cho friend.model.ts**
Chú thích cấu trúc `IFriend`, hàm chuẩn hóa `normalizeFriendIds` và logic đảm bảo thứ tự quan hệ 2 chiều.

- [x] **Step 4: Thêm chú thích cho block.model.ts**
Chú thích quan hệ chặn người dùng, các trường và compound index.

- [x] **Step 5: Chạy type-check và tests**
Run: `npm run type-check; npm run test`
Expected: 100% tests pass.

- [x] **Step 6: Commit**
`git add src/schemas/friend.schema.ts src/models/friend-request.model.ts src/models/friend.model.ts src/models/block.model.ts`
`git commit -m "docs(models,schemas): add Vietnamese comments for friend schemas and models"`

---

### Task 3: Bổ sung chú thích Tiếng Việt cho Repositories của Friend APIs

**Files:**
- Modify: `D:/appmessaging/backend/src/repositories/friend-request.repository.ts`
- Modify: `D:/appmessaging/backend/src/repositories/friend.repository.ts`
- Modify: `D:/appmessaging/backend/src/repositories/block.repository.ts`

- [x] **Step 1: Thêm chú thích cho friend-request.repository.ts**
Chú thích interface `IFriendRequestRepository` và từng phương thức (`create`, `findById`, `findPending`, `updateStatus`, `findReceived`, `findSent`, `cancelPendingBetween`).

- [x] **Step 2: Thêm chú thích cho friend.repository.ts**
Chú thích interface `IFriendRepository`, `FriendQueryOptions`, `FriendItemResult`, và các phương thức (`createFriendship`, `isFriend`, `removeFriendship`, `findFriends`, `countFriends`).

- [x] **Step 3: Thêm chú thích cho block.repository.ts**
Chú thích interface `IBlockRepository` và các phương thức (`createBlock`, `removeBlock`, `isBlocked`, `isBlockedBy`, `findBlockedUsers`).

- [x] **Step 4: Chạy type-check và tests**
Run: `npm run type-check; npm run test`
Expected: 100% tests pass.

- [x] **Step 5: Commit**
`git add src/repositories/friend-request.repository.ts src/repositories/friend.repository.ts src/repositories/block.repository.ts`
`git commit -m "docs(repositories): add Vietnamese comments for friend repositories"`

---

### Task 4: Bổ sung chú thích Tiếng Việt cho Service, Controller và Routes của Friend APIs

**Files:**
- Modify: `D:/appmessaging/backend/src/services/friend.service.ts`
- Modify: `D:/appmessaging/backend/src/controllers/friend.controller.ts`
- Modify: `D:/appmessaging/backend/src/routes/friend.routes.ts`

- [x] **Step 1: Thêm chú thích chi tiết từng bước nghiệp vụ trong friend.service.ts**
Chú thích JSDoc và inline comments cho 11 phương thức nghiệp vụ:
- `sendFriendRequest`: Kiểm tra tự gửi, người dùng tồn tại, quan hệ chặn, đã là bạn bè, lời mời trùng lặp hai chiều.
- `acceptFriendRequest`: Transaction MongoDB, cập nhật trạng thái lời mời, tạo tình bạn 2 chiều, hủy các lời mời liên quan.
- `rejectFriendRequest`: Kiểm tra quyền người nhận, chuyển trạng thái REJECTED.
- `cancelFriendRequest`: Kiểm tra quyền người gửi, chuyển trạng thái CANCELED.
- `getReceivedRequests`: Lấy danh sách lời mời nhận được có phân trang.
- `getSentRequests`: Lấy danh sách lời mời đã gửi có phân trang.
- `getFriends`: Danh sách bạn bè kèm lọc tìm kiếm tên, lọc trạng thái online và phân trang.
- `removeFriend`: Xóa quan hệ bạn bè.
- `blockUser`: Transaction MongoDB, tạo bản ghi chặn, xóa bạn bè (nếu có), hủy lời mời kết bạn 2 chiều.
- `unblockUser`: Bỏ chặn người dùng.
- `getBlockedUsers`: Danh sách người dùng bị chặn có phân trang.
- `getRelationshipStatus`: Xác định trạng thái quan hệ 2 chiều giữa 2 người dùng.

- [x] **Step 2: Thêm chú thích cho friend.controller.ts**
Chú thích từng handler: trích xuất user/params/query/body, gọi service và trả về HTTP status code tương ứng (200, 201).

- [x] **Step 3: Rà soát và hoàn thiện chú thích trong friend.routes.ts**
Đảm bảo tất cả các endpoint đều có chú thích rõ ràng về chức năng và middleware áp dụng.

- [x] **Step 4: Chạy kiểm thử toàn diện**
Run: `npm run type-check; npm run test`
Expected: PASS 13/13 test suites, 90/90 tests.

- [x] **Step 5: Commit**
`git add src/services/friend.service.ts src/controllers/friend.controller.ts src/routes/friend.routes.ts`
`git commit -m "docs(api): add full Vietnamese comments for friend service, controller and routes"`
