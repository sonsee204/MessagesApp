# Thiết kế tính năng Cuộc gọi (Voice & Video Call)

> **Ngày**: 2026-09-16 · **Trạng thái**: Đã duyệt qua brainstorming (6/6 section)
> **Phạm vi**: Cuộc gọi 1-1 (audio + video) trong hội thoại DIRECT, signaling qua Socket.IO hiện có, push FCM cho callee offline.

---

## 1. Quyết định kiến trúc (đã thống nhất)

| # | Vấn đề | Quyết định |
|---|---|---|
| 1 | Phạm vi | **1-1 trước** (DIRECT). Group call (SFU/mesh) là phase sau, không thuộc spec này |
| 2 | Signaling | **Reuse Socket.IO hiện có** (`emitToUser`), không tách server riêng |
| 3 | Call history | **Có lưu MongoDB** (`CallModel`) — missed/declined/ended + duration |
| 4 | Loại call | **Cả audio + video**, người gọi chọn lúc bấm gọi |
| 5 | Quyền gọi | **Chỉ bạn bè** (re-use friend check hiện có) + chặn block |
| 6 | Callee offline | **Push notification thật (FCM)** — missed log + notification + web push |
| 7 | Kết thúc call | **Peer tự close** khi nhận event; **ring timeout 30s ở client** |

## 2. Data Model

### 2.1 `CallModel` (`backend/src/models/call.model.ts`)

```ts
{
  _id:            ObjectId
  conversationId: ObjectId  // ref Conversation (DIRECT)
  callerId:       ObjectId  // ref User
  calleeId:       ObjectId  // ref User
  type:           "audio" | "video"
  status:         "ringing" | "answered" | "missed" | "declined" | "ended"
  startedAt:      Date      // caller initiate
  answeredAt:     Date | null
  endedAt:        Date | null
  durationSec:    number | null  // answeredAt → endedAt
}
```

- Index: `{ callerId: 1, startedAt: -1 }`, `{ calleeId: 1, startedAt: -1 }` (query lịch sử), `{ status: 1 }` partial index cho `ringing` (dọn orphan khi restart).
- **Không** lưu SDP/ICE — chỉ metadata.

### 2.2 `DeviceTokenModel` (`backend/src/models/device-token.model.ts`)

```ts
{
  _id:      ObjectId
  userId:   ObjectId   // ref User
  platform: "web" | "android" | "ios"
  token:    string     // unique
  createdAt, updatedAt: Date
}
```

- Index: `{ userId: 1 }`, `{ token: 1 }` unique.

## 3. Socket.IO Signaling Events

Tất cả đi qua socket đã auth JWT lúc handshake (middleware hiện có). Server **relay + persist 2 mốc** (initiate, kết thúc), không giữ media state.

### 3.1 Client → Server

| Event | Payload | Hành vi server |
|---|---|---|
| `call:initiate` | `{ calleeId, type }` | Check friendship + not-blocked → resolve/create DIRECT conversation → kiểm tra busy → tạo CallLog `ringing`. Callee online → forward `call:incoming`. Callee offline → log `missed` + Notification + FCM |
| `call:accept` | `{ callId }` | Verify user là callee → forward `call:accepted` → update `answered` + `answeredAt` |
| `call:decline` | `{ callId }` | Verify callee → forward `call:declined` → update `declined` + `endedAt` |
| `call:cancel` | `{ callId }` | Caller bỏ khi đang chờ → forward `call:canceled` → update `missed` + `endedAt` |
| `call:offer` | `{ callId, sdp }` | Relay thuần tới callee (không persist) |
| `call:answer` | `{ callId, sdp }` | Relay thuần tới caller |
| `call:ice` | `{ callId, candidate }` | Relay thuần 2 chiều |
| `call:end` | `{ callId }` | Forward `call:ended` → update `ended` + `endedAt` + `durationSec` |

### 3.2 Server → Client (forward)

`call:incoming`, `call:accepted`, `call:declined`, `call:canceled`, `call:offer`, `call:answer`, `call:ice`, `call:ended`, `call:busy`, `call:error { message }`

### 3.3 Ràng buộc an toàn

- Mọi event trừ `call:initiate`: server verify user là `callerId` hoặc `calleeId` của `callId` → chặn giả mạo.
- SDP/ICE không bao giờ ghi DB.
- **ActiveCallRegistry** (`backend/src/socket/active-call.registry.ts`): `Map<userId, callId>` in-memory — nguồn duy nhất trả lời "user bận chưa" (O(1), đồng bộ). Xóa khi sang trạng thái cuối. Restart server = reset (chấp nhận được; client timeout tự dọn).
- **Race** A→B và B→A đồng thời: request đến sau nhận `call:busy`.
- **Dọn orphan**: khi boot server, update mọi CallLog `status: "ringing"` → `missed` (không có cuộc gọi ringing nào sống sót qua restart).

## 4. WebRTC Client (Frontend)

### 4.1 Cấu hình

- `frontend/src/features/call/lib/webrtc-config.ts`: MVP chỉ STUN `stun:stun.l.google.com:19302`. TURN (coturn/dịch vụ) = phase sau, đổi mỗi file này.
- 1 cuộc gọi = 1 `RTCPeerConnection` (1-1 nên P2P trực tiếp, không SFU).

### 4.2 State machine (hook `useCall`)

```
idle → dialing → connecting → active → ended
         ↓ (callee)        ↘ rejected / missed / canceled / busy
       ringing ────────────↗
```

- `dialing`: caller đã gửi `call:initiate`, chờ `call:accepted`/`call:answer`. **Ring timeout 30s ở client** → `call:cancel` + trạng thái `missed`.
- `ringing`: callee nhận `call:incoming`, hiện `IncomingCallModal`. Hết 30s (client callee) → auto-decline? **Không** — callee timeout không auto-response; caller timeout mới cancel.
- `connecting`: đã trao đổi SDP, chờ ICE `connected`.
- `active`: media flow, chạy `CallTimer`.
- `ended/rejected/missed/canceled/busy`: trạng thái cuối, cleanup.

### 4.3 Luồng media

**Caller:** bấm gọi → `getUserMedia({audio:true, video: type==="video"})` → tạo PC + addTrack → emit `call:initiate` → `createOffer()` → emit `call:offer` → nhận `call:answer` → `setRemoteDescription` → ICE qua `call:ice` 2 chiều.

**Callee:** nhận `call:incoming` → bấm "Nghe" → `getUserMedia` → emit `call:accept` → nhận `call:offer` → `setRemoteDescription` → `createAnswer()` → emit `call:answer`.

### 4.4 Rớt mạng & cleanup

- `pc.oniceconnectionstatechange`: `failed` (hoặc `disconnected` quá 3s) → emit `call:end` + toast "Cuộc gọi kết thúc do mất kết nối". Không auto ICE-restart (phase sau).
- Mọi trạng thái cuối: `pc.close()`, `stream.getTracks().forEach(t => t.stop())`, giải phóng `srcObject`. Đặt trong `useEffect` cleanup để không leak camera/mic.

## 5. Push Notification (FCM)

### 5.1 Firebase Admin SDK

- `backend/src/config/firebase.ts`: lazy init (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`), giống pattern `cloudinary.ts`. Thiếu env → throw tại thời điểm gửi, **không** làm fail boot app / request.
- MVP gửi qua HTTP v1 legacy hay **v1 `projects/<id>/messages:send`** với `firebase-admin` SDK.

### 5.2 Luồng offline

```
A gọi B, B không có socket online
  → CallLog status=missed (kèm endedAt)
  → Notification doc (type="CALL_MISSED", refId=callId) — tái dụng NotificationModel + notification.service hiện có
  → DeviceToken.find({userId: B}) → gửi FCM mỗi token:
      notification: { title: "Cuộc gọi nhỡ", body: "<A> gọi <video|audio> cho bạn" }
      data: { type: "CALL_MISSED", callId, callerId }
      webpush.fcm_options.link: "/chat/<conversationId>"
```

- FE đăng ký: `getToken()` firebase/messaging → `POST /api/device-tokens` khi login; `DELETE /api/device-tokens` khi logout.
- Best-effort: không retry queue. FCM trả error `UNREGISTERED`/`INVALID_ARGUMENT` → xóa DeviceToken.
- Chỉ push khi callee **offline**; online thì đã có `call:incoming` qua socket.
- APNs (iOS native) phase sau — abstraction `push.service.ts` để thêm provider mà không sửa call flow.

## 6. REST API + Layered Services

### 6.1 Backend layers (Controller → Service → Repository)

| Tầng | File | Trách nhiệm |
|---|---|---|
| Model | `call.model.ts`, `device-token.model.ts` | Schema + index |
| Repository | `call.repository.ts`, `device-token.repository.ts` | `create`, `findById`, `updateStatus(callId, status, patch)`, `findRecentByUser(userId, {page, limit})`, `countMissed(userId)`; device token: `upsert`, `deleteByToken` |
| Service | `call.service.ts` | `initiateCall` (friendship + block + busy + conversation resolve), `acceptCall`, `declineCall`, `cancelCall`, `endCall` (tính durationSec), `getCallHistory` (pagination bắt buộc) |
| Service | `push.service.ts` | `sendToDeviceTokens(userId, payload)` — bao FCM, nuốt error log |
| Controller | `call.controller.ts`, `device-token.controller.ts` | HTTP wrapper, không logic |
| Socket | `socket/call.handlers.ts` | Đăng ký 8 events §3.1, gọi CallService, relay qua `emitToUser` |
| Registry | `socket/active-call.registry.ts` | Map in-memory busy |

### 6.2 Endpoints (`requireAuth` + `validate`)

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/calls?page=&limit=` | Lịch sử call của tôi (caller + callee), populate 2 phía user info |
| `GET` | `/api/calls/missed-count` | Đếm missed (badge) |
| `POST` | `/api/device-tokens` | `{ token, platform }` upsert |
| `DELETE` | `/api/device-tokens` | `{ token }` thu hồi khi logout |

Validation qua Zod (`call.schema.ts`, `device-token.schema.ts`) theo convention `validate` middleware (shape `{ body/query/params }`).

## 7. Frontend UI (Atomic Design)

```
features/call/
  hooks/useCall.ts            # headless: socket events + RTCPeerConnection + state machine
  lib/webrtc-config.ts        # STUN/TURN
  services/call.service.ts    # REST: getCallHistory, missedCount, device-tokens
  components/
    atoms/    CallButton, CallTimer, CallAvatar
    molecules/ CallControls (mic/camera/end), IncomingCallModal, CallStatusToast
    organisms/ CallScreen (remote fullscreen + local PiP + controls), CallHistoryList
    pages/    CallHistoryPage (route /calls)
```

### 7.1 4 UI states (frontend.md §4)

- **Loading**: skeleton `CallHistoryList`
- **Empty**: icon + "Chưa có cuộc gọi nào" + CTA "Tìm bạn để gọi"
- **Error**: thông báo thân thiện + nút Thử lại
- **Success**: danh sách nhóm theo ngày, badge đỏ số missed

### 7.2 A11y (frontend.md §5)

- `IncomingCallModal`: `role="alertdialog"`, `aria-live="assertive"`, focus-trap 2 nút Accept/Decline, `Esc` từ chối.
- `CallScreen`: mọi nút icon có `aria-label` (Tắt mic / Bật camera / Kết thúc); `aria-live="polite"` trên CallTimer; `Esc` = kết thúc (có confirm hold 200ms để tránh bấm nhầm? Không — Esc end ngay, đúng hành vi phổ biến).
- Phím tắt khi ringing: `Enter` accept, `Delete/Backspace` decline.

### 7.3 Mobile-first

- `CallScreen`: `100dvh` fullscreen; local video PiP `absolute bottom-4 right-4`, tap to swap.
- Nút điều khiển tối thiểu 44×44px touch target.

### 7.4 Global call mount

`useCall` gắn ở `ChatLayout`/App level (không phải trong page chat) để: (1) nhận `call:incoming` từ mọi trang, (2) call không mất khi điều hướng. `IncomingCallModal` + `CallScreen` render toàn cục từ state của hook.

## 8. Testing

| Lớp | Công cụ | Nội dung |
|---|---|---|
| Unit backend | vitest (đã có) | `call.service`: friendship fail → ForbiddenError; busy → từ chối; transition status hợp lệ (`ringing→answered→ended`); `durationSec` tính đúng; orphan cleanup khi boot |
| Unit registry | vitest | `active-call.registry`: set/delete/busy check, race 2 chiều |
| Unit FE | vitest + mock | `useCall` state machine với socket/RTC mock: timeout 30s → cancel; `ended` → cleanup tracks |
| Component | RTL | 4 states CallHistoryList; IncomingCallModal a11y (role, focus-trap) |
| Gate cuối | **React Doctor** (bắt buộc frontend.md §6) | `cd frontend && npx react-doctor@latest` |
| Type/Build | `tsc --noEmit` + `npm run build` cả 2 phía | pass sạch |
| E2E | tùy chọn sau MVP | 2 browser contexts Playwright, `--use-fake-media` flags |

## 9. Outside Scope (phase sau, ghi rõ để không làm loãng MVP)

1. **Group call** (3+ người) — cần SFU (mediasoup/LiveKit) hoặc mesh.
2. **TURN server** cho NAT cứng — tự host coturn.
3. **APNs** cho iOS native — thêm provider vào `push.service`.
4. **ICE restart / reconnect tự động** khi rớt mạng giữa call.
5. **Screen sharing**, call recording, call-in-chat-message bubble (tin nhắn "Cuộc gọi lúc ...": có thể thêm sau bằng cách gắn CallLog → Message loại `CALL`).
6. Queue/retry push.

## 10. Env & Config mới

```
# backend/.env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=          # newline escaped \n
VAPID_KEY_FILE=                # (tuỳ chọn) web push cert path
# frontend/.env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Package mới dự kiến: `firebase-admin` (backend), `firebase` (frontend, chỉ cần `firebase/messaging`).

## 11. Thứ tự triển khai (để viết plan)

1. `CallModel` + `DeviceTokenModel` + repositories + unit tests
2. `call.service` (initiate/accept/decline/cancel/end + history) + unit tests
3. `active-call.registry` + `socket/call.handlers.ts` (8 events) + integration test socket
4. REST routes `/api/calls`, `/api/device-tokens` + validation schemas
5. `config/firebase.ts` + `push.service` + nối vào luồng missed
6. FE: `webrtc-config` + `useCall` hook (state machine) + unit tests
7. FE UI: `IncomingCallModal` → `CallScreen` → `CallHistoryList`/Page → global mount
8. FE: Firebase messaging registration + service worker `firebase-messaging-sw.js`
9. gates: `tsc --noEmit`, build 2 phía, vitest, **React Doctor**
