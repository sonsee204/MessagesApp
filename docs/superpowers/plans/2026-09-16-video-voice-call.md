# Video & Voice Call (1-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng tính năng gọi thoại và gọi video 1-1 thời gian thực trên nền tảng Express + Socket.IO + WebRTC P2P + React, lưu lịch sử cuộc gọi MongoDB và hỗ trợ FCM thông báo cuộc gọi nhỡ.

**Architecture:** Sử dụng Socket.IO hiện có để làm signaling server trao đổi SDP/ICE candidates giữa 2 peer; WebRTC client P2P xử lý stream audio/video phía trình duyệt; Backend quản lý trạng thái cuộc gọi (`CallModel`), bộ nhớ tạm phòng chống gọi đồng thời (`ActiveCallRegistry`), và gửi Push Notification (FCM) khi đối phương ngoại tuyến.

**Tech Stack:** Express.js, TypeScript, Mongoose (MongoDB), Socket.IO, WebRTC Native API, React 18, Zustand, Tailwind CSS, Firebase Admin SDK.

**Spec:** `docs/superpowers/specs/2026-09-16-video-voice-call-design.md`

## Global Constraints

- Tuân thủ nghiêm ngặt `.claude/rules/backend.md` (Layered Architecture: Controller -> Service -> Repository, Zero-Trust Validation, comments Tiếng Việt bắt buộc).
- Tuân thủ `.claude/rules/frontend.md` (Atomic Design, Headless Hooks, Semantic Tokens, 4 UI States, a11y ARIA, kiểm tra `npx react-doctor@latest` sau khi hoàn thành).
- Tuân thủ `.claude/rules/hard-bans.md` (Không dùng type `any`, không dùng `@ts-ignore`, không vượt 400 dòng hiệu dụng).
- Tuân thủ `.claude/rules/task-routing.md` (Phân phối task cho subagent phù hợp: Backend/Socket concurrency dùng `deep-architect`, CRUD/UI dùng `feature-builder`).

---

### Task 1: Backend Data Models & Repositories (`Call` & `DeviceToken`)

**Files:**
- Create: `backend/src/models/call.model.ts`
- Create: `backend/src/models/device-token.model.ts`
- Modify: `backend/src/models/index.ts`
- Create: `backend/src/repositories/call.repository.ts`
- Create: `backend/src/repositories/device-token.repository.ts`
- Test: `backend/src/repositories/call.repository.test.ts`

**Interfaces:**
- Consumes: Mongoose connection, `IUser` model
- Produces: `ICall`, `IDeviceToken`, `callRepository`, `deviceTokenRepository`

- [x] **Step 1: Viết test thất bại cho CallRepository**
- [x] **Step 2: Chạy test để xác nhận thất bại**
  - Run: `cd backend && npx vitest run src/repositories/call.repository.test.ts`
- [x] **Step 3: Định nghĩa Schema & khởi tạo Repository**
- [x] **Step 4: Chạy lại test đảm bảo pass**
  - Run: `cd backend && npx vitest run src/repositories/call.repository.test.ts`
- [x] **Step 5: Commit task 1**

---

### Task 2: Active Call In-Memory Registry & Call Service Layer

**Files:**
- Create: `backend/src/socket/active-call.registry.ts`
- Create: `backend/src/services/call.service.ts`
- Test: `backend/src/socket/active-call.registry.test.ts`
- Test: `backend/src/services/call.service.test.ts`

**Interfaces:**
- Consumes: `callRepository`, `friendRepository`, `conversationRepository`, `blockRepository`
- Produces: `ActiveCallRegistry`, `callService` (methods: `initiateCall`, `acceptCall`, `declineCall`, `cancelCall`, `endCall`, `getCallHistory`)

- [x] **Step 1: Viết unit test cho ActiveCallRegistry (check busy, map caller/callee)**
- [x] **Step 2: Viết unit test cho CallService (kiểm tra quan hệ bạn bè, chặn block, tính toán duration)**
- [x] **Step 3: Hiện thực ActiveCallRegistry và CallService**
- [x] **Step 4: Chạy test và type-check**
  - Run: `cd backend && npx vitest run src/services/call.service.test.ts src/socket/active-call.registry.test.ts`
- [x] **Step 5: Commit task 2**

---

### Task 3: Socket.IO WebRTC Signaling Handlers

**Files:**
- Create: `backend/src/socket/call.handlers.ts`
- Modify: `backend/src/socket/index.ts`
- Test: `backend/src/socket/call.handlers.test.ts`

**Interfaces:**
- Consumes: `callService`, `ActiveCallRegistry`, `emitToUser`
- Produces: 8 socket signaling events (`call:initiate`, `call:accept`, `call:decline`, `call:cancel`, `call:offer`, `call:answer`, `call:ice`, `call:end`)

- [x] **Step 1: Viết test cho luồng relay signaling (offer/answer/ice) và xử lý sự kiện ngắt kết nối đột ngột**
- [x] **Step 2: Đăng ký các handler cuộc gọi vào socket connection lifecycle**
- [x] **Step 3: Xử lý dọn dẹp các cuộc gọi mồ côi (orphan calls) khi khởi động server**
- [x] **Step 4: Chạy test socket handlers**
  - Run: `cd backend && npx vitest run src/socket/call.handlers.test.ts`
- [x] **Step 5: Commit task 3**

---

### Task 4: REST API Endpoints & Push Notification Service (FCM)

**Files:**
- Create: `backend/src/config/firebase.ts`
- Create: `backend/src/services/push.service.ts`
- Create: `backend/src/schemas/call.schema.ts`
- Create: `backend/src/controllers/call.controller.ts`
- Create: `backend/src/routes/call.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/src/controllers/call.controller.test.ts`

**Interfaces:**
- Consumes: `callService`, `deviceTokenRepository`, Firebase Admin SDK
- Produces: `/api/calls`, `/api/device-tokens`

- [x] **Step 1: Viết test kiểm tra phân trang lịch sử cuộc gọi và bảo mật token thiết bị**
- [x] **Step 2: Khởi tạo module Firebase Admin cấu hình lười (lazy evaluation)**
- [x] **Step 3: Tạo routes, controller và validate request bằng Zod Schema**
- [x] **Step 4: Chạy kiểm thử API và type-check**
  - Run: `cd backend && npx vitest run src/controllers/call.controller.test.ts && npm run build`
- [x] **Step 5: Commit task 4**

---

### Task 5: Frontend WebRTC Client Hook & Call State Management

**Files:**
- Create: `frontend/src/features/call/lib/webrtc-config.ts`
- Create: `frontend/src/features/call/types/call.types.ts`
- Create: `frontend/src/features/call/hooks/useCall.ts`
- Test: `frontend/src/features/call/hooks/useCall.test.ts`

**Interfaces:**
- Consumes: `getSocket` từ `lib/socket.ts`, trình duyệt `navigator.mediaDevices`, `RTCPeerConnection`
- Produces: State machine `status` (`idle`, `dialing`, `ringing`, `connecting`, `active`, `ended`), `localStream`, `remoteStream`, các hành động `initiateCall`, `acceptCall`, `declineCall`, `endCall`, `toggleAudio`, `toggleVideo`

- [ ] **Step 1: Viết test giả lập trạng thái WebRTC hook (chuyển đổi dialing -> active -> cleanup tracks)**
- [ ] **Step 2: Hiện thực hóa `useCall` với logic hủy sau 30 giây (ring timeout) và dọn sạch media stream**
- [ ] **Step 3: Chạy test hook**
- [ ] **Step 4: Commit task 5**

---

### Task 6: Frontend Call UI Components & Global Integration

**Files:**
- Create: `frontend/src/features/call/components/atoms/CallTimer.tsx`
- Create: `frontend/src/features/call/components/molecules/CallControls.tsx`
- Create: `frontend/src/features/call/components/molecules/IncomingCallModal.tsx`
- Create: `frontend/src/features/call/components/organisms/CallScreen.tsx`
- Create: `frontend/src/features/call/components/organisms/CallHistoryList.tsx`
- Modify: `frontend/src/features/chat/components/ChatHeader.tsx` (thêm nút bấm Call Audio/Video)
- Modify: `frontend/src/App.tsx` (gắn kết Modal & CallScreen toàn cục)

**Interfaces:**
- Consumes: `useCall` hook, `useAuthStore`
- Produces: Giao diện cuộc gọi Fullscreen chuẩn a11y, Modal chuông reo `alertdialog`, lịch sử cuộc gọi

- [ ] **Step 1: Xây dựng các Atomic components (Timer, Controls với aria-labels)**
- [ ] **Step 2: Dựng Modal chuông reo với Focus-trap và phím tắt (Enter: nhận, Esc: từ chối)**
- [ ] **Step 3: Dựng màn hình gọi toàn diện (100dvh, Remote stream fullscreen, Local stream PiP)**
- [ ] **Step 4: Gắn nút gọi vào `ChatHeader.tsx` và gắn modal toàn cục vào `App.tsx`**
- [ ] **Step 5: Kiểm tra xác minh React Doctor & Typecheck**
  - Run: `cd frontend && npm run build && npx react-doctor@latest`
- [ ] **Step 6: Commit task 6**
