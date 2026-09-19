# Implementation Plan: Fix lỗi cuộc gọi video bị treo sau khi kết thúc

> **Nguồn**: Điều tra root-cause bug production "kết thúc cuộc gọi video rồi cuộc gọi vẫn bị treo và không thể tắt đi được".
> **Phạm vi**: FE (`useCall.ts`, `CallScreen.tsx`, `CallProvider.tsx`) + BE (`call.handlers.ts`, `call.service.ts`).

---

## 1. Bối cảnh & Mục tiêu

- **Vấn đề**: Người dùng bấm "Kết thúc" (hoặc đối phương thoát) nhưng màn hình cuộc gọi vẫn overlay đầy màn hình, không có nút nào bấm được, phải tải lại trang.
- **Phạm vi làm**: 6 nhóm fix (F1–F6) đi từ gốc rễ (watchdog timeout) tới lớp phòng thủ UI (nút đóng luôn có sẵn).
- **Phạm vi KHÔNG làm** (out-of-scope, làm riêng):
  - Tách god file `useCall.ts` (692 dòng) / `CallScreen.tsx` (526 dòng) — vi phạm hard-bans.md #3, đã ghi nợ kỹ thuật ở plan `fix-call-review-findings.md`.
  - Đổi Socket.IO event payload (FE-BE contract đang chạy phải giữ nguyên).
  - **TURN server**: ĐÃ GỘP VÀO PLAN NÀY (yêu cầu người dùng) — xem T10, mục 3.7.

---

## 2. Phân Tích Nguyên Nhân Gốc Rễ (Root Cause)

### Cây triệu chứng

```
Người dùng bấm "Kết thúc cuộc gọi"
   ↓
terminateSession("ended")          ← useCall.ts:103-115
   ↓
status = "ended", cleanup MediaStream + PeerConnection
   ↓
CallScreen tự đóng sau 2 giây      ← CallScreen.tsx:424-439
   ↓
NẾU timing/timer bị phá vỡ → overlay KHÔNG bao giờ đóng
```

### RC-1: Không có watchdog cho trạng thái `connecting` (NGUYÊN NHÂN CHÍNH)

`useCall.ts:186-212` — `oniceconnectionstatechange` chỉ xử lý 3 trạng thái:

| Trạng thái ICE | Xử lý hiện tại |
|---|---|
| `connected` / `completed` | ✅ chuyển sang `active` |
| `disconnected` | ✅ chờ 3s → `emit("call:end")` + `terminateSession("ended")` |
| `failed` | ✅ kết thúc ngay |
| **(không bao giờ fired)** | ❌ **không có gì** |

**Nếu peer connection không bao giờ phát event nào** (TURN không reachable, NAT symmetric không qua được, ICE gathering chết silently), trạng thái **mãi mãi ở `connecting`**. Không có timeout nào cứu vớt.

**Tại sao ghép với `webrtc-config.ts:5-9`**: config hiện tại **chỉ có STUN của Google, không có TURN**. Trên mạng NAT khắc nghiệt (symmetric NAT, corporate firewall, CGNAT của mạng mobile Việt Nam), hai peer không thể kết nối P2P và ICE **im lặng chết** — không `failed`, không `disconnected`, chỉ là không bao giờ `connected`. Đây là lý do bug tái phát theo mạng.

### RC-2: `CallScreenNonVideo` không render bất kỳ nút nào cho `connecting` và terminal states

`CallScreen.tsx:268-289`:

```tsx
{status === "active" ? (
  <CallControls ... />           // ✅ có nút tắt
) : status === "dialing" ? (
  <button>Hủy cuộc gọi</button>  // ✅ có nút hủy
) : null}                        // ❌ connecting + mọi trạng thái terminal → KHÔNG CÓ NÚT
```

**Hậu quả**: cuộc gọi thoại (audio call) bị kẹt ở `connecting` → overlay full màn hình, chỉ có dòng chữ "Đang thiết lập kết nối WebRTC..." nhấp nháy, **không có nút nào để thoát**. Đây chính là cảm giác "không thể tắt đi được".

`CallProvider.tsx:51` render `CallScreen` cho **mọi** `status !== "idle" && status !== "ringing"`, nên overlay này không thể bỏ qua.

### RC-3: `terminateSession` reset trạng thái không trọn vẹn + không xóa `callIdRef`

`useCall.ts:103-115`:

```ts
setState((prev) => ({
  ...prev,
  status: targetStatus,
  error,
  localStream: null,
  remoteStream: null,
}));
// ❌ KHÔNG xóa: callIdRef.current, callId, hasLocalVideo, isVideoMuted, type
```

**Hậu quả dây chuyền**:
1. `callIdRef.current` vẫn trỏ tới cuộc gọi đã kết thúc → `endCall()` (`useCall.ts:423-434`) emit `call:end` lên một callId đã `ended`.
2. BE `call.service.ts:308-353` **throw ConflictError** ("Cuộc gọi đã kết thúc trước đó") khi status đã terminal.
3. `call.handlers.ts:120-132` (`emitCallFailure`) map ConflictError → **phát `call:busy` về chính người gửi**.
4. FE nhận `call:busy` → `handleBusy` (`useCall.ts:653`) → `terminateSession("busy")` — vòng lặp nhiễu, và `busy` **không nằm trong `isTerminal`**... thực tế nó có nằm trong `isTerminal` (CallScreen.tsx:345), nhưng trạng thái nhảy loạn làm timer auto-close 2s phải reset lại.

### RC-4: `resetCall` không xóa `callIdRef`

`useCall.ts:503-506`:

```ts
const resetCall = useCallback((): void => {
  cleanupMediaAndPeer();
  setState(INITIAL_CALL_STATE);   // ❌ callIdRef.current vẫn giữ callId cũ
}, [cleanupMediaAndPeer]);
```

Sau khi overlay đóng, `callIdRef` vẫn treo. Nếu `handleIncoming` (`useCall.ts:513-528`) đã ghi `callIdRef.current = data.callId` rồi nhưng cuộc gọi bị hủy giữa chừng mà chưa qua terminal handler, ref này sẽ bị "rò rỉ" sang cuộc gọi kế tiếp — `endCall` của call mới có thể emit nhầm callId cũ.

### RC-5: Esc key không phản hồi khi `connecting` (RC-2 hiện diện ở cả lớp phím)

`CallScreen.tsx:406-422` — Esc gọi `onCancel` → `onEnd` (cùng là `call.endCall` ở `CallProvider.tsx:57`). `endCall` không có guard "đã kết thúc rồi" nên bấm Esc 2 lần phát 2 lần `call:end` (phát sinh RC-3). Quan trọng: **Esc có hoạt động**, nhưng khi overlay đã stuck do RC-1+RC-2 thì người dùng thường không biết tới phím Esc.

### RC-6 (nhẹ, BE): disconnect khi đang `answered` không cập nhật DB

`call.handlers.ts:363-366` — khi socket rớt giữa cuộc gọi đã answered, chỉ emit `call:peer_disconnected`, **không cập nhật DB**. Bản ghi treo ở `answered` tới khi self-heal 30 phút (đã fix ở plan trước) mới giải phóng. Đây không phải nguyên nhân trực tiếp của overlay stuck, nhưng làm "hệ số phân tán" — trạng thái BE và FE không khớp, khiến lần gọi kế tiếp dính `ConflictError` → RC-3.

### Tóm tắt độ ưu tiên

| Mã | Nguyên nhân | Mức | Tần suất gặp |
|---|---|---|---|
| RC-1 | Không watchdog `connecting` + STUN-only (không TURN) | **Critical** | Mỗi lần gọi qua NAT khắc nghiệt |
| RC-2 | `CallScreenNonVideo` vô nút khi `connecting`/terminal | **Critical** | 100% khi RC-1 kích hoạt (audio call) |
| RC-2b | `state.error` không hiển thị ở đâu (timeout/lỗi khiếm khuyết không thấy) | **High** | Mỗi khi watchdog hoặc ICE `failed` kích hoạt |
| RC-3 | `terminateSession` partial + `callIdRef` không xóa | High | Mỗi lần bấm End 2 nhịp |
| RC-4 | `resetCall` không xóa `callIdRef` | Medium | Rò rỉ sang call kế tiếp |
| RC-5 | Esc phát `call:end` nhiều lần | Medium | Bấm Esc liên tục |
| RC-6 | BE disconnect `answered` không cập nhật DB | Low | Tab đóng giữa cuộc gọi |

---

## 3. Thiết Kế Kỹ Thuật

### 3.1 Watchdog timeout cho `connecting` (fix RC-1)

Thêm `connectionTimeoutRef` (dùng `iceRestartTimeout` chuẩn WebRTC là **10 giây**, không phải 30s — người dùng không chấp nhận chờ lâu hơn).

**Đặt timeout lúc nào**: vào `connecting` (tức là lúc `handleAccepted` tạo PC — `useCall.ts:542-567`), không phải lúc tạo PC trong `createPeerConnection` (hàm này dùng chung cho nhiều path).

```ts
// Khởi động watchdog 10s: nếu sau 10s vẫn connecting (ICE không connected) → đóng phiên.
// Lý do 10s: ICE restart timeout chuẩn của trình duyệt; chờ thêm chỉ tăng bực bội của user.
const startConnectionWatchdog = useCallback((): void => {
  clearConnectionWatchdog();
  connectionTimeoutRef.current = setTimeout(() => {
    // Chỉ chốt lúc vẫn đang connecting — nếu đã active/terminal thì timeout vô dụng.
    if (stateRef.current.status === "connecting") {
      const socket = getSocket();
      const activeCallId = callIdRef.current;
      if (activeCallId) {
        socket.emit("call:end", { callId: activeCallId });
      }
      terminateSession("ended", "Không thể thiết lập kết nối. Vui lòng thử lại.");
    }
  }, 10_000);
}, [clearConnectionWatchdog, terminateSession]);
```

**Xóa watchdog ở**: `cleanupMediaAndPeer` (thêm clear) + ngay khi ICE `connected`/`completed` (đã có branch ở `useCall.ts:188-192`).

**Hiện thực phân tán**: watchdog phải được clear trong **cả hai** nơi, nếu không timeout firing sau khi phiên đã active sẽ tự ý đóng cuộc gọi đang tốt.

### 3.2 Nút đóng cho mọi trạng thái non-active (fix RC-2)

Đổi logic render ở `CallScreen.tsx:268-289`:

```tsx
{status === "active" ? (
  <CallControls ... />
) : (
  <button onClick={onEnd}>Kết thúc</button>   // dialing/connecting/terminal: luôn có nút
)}
```

Giữ nút "Hủy cuộc gọi" riêng cho `dialing` (vì lúc này semantics là Hủy — không phải Kết thúc). Cụ thể:

| Trạng thái | Nút | Label | Hành động |
|---|---|---|---|
| `active` | `CallControls` | — | `onEnd` |
| `dialing` | button đỏ | "Hủy cuộc gọi" | `onCancel` |
| `connecting` | button đỏ | "Hủy cuộc gọi" | `onEnd` |
| terminal (`ended`/`rejected`/...) | button xám | "Đóng" | `onClose` |

**Tại sao tách `onClose` cho terminal**: `onEnd` emit sự kiện mạng (gây RC-3 khi gọi lần 2), trong khi terminal chỉ cần dọn local state (`resetCall`). `onClose` đã có sẵn prop (`CallScreen.tsx:314-316`).

### 3.3 Reset trọn vẹn + xóa `callIdRef` (fix RC-3, RC-4)

```ts
const terminateSession = useCallback(
  (targetStatus: CallStatus, error: string | null = null): void => {
    cleanupMediaAndPeer();
    callIdRef.current = null;              // ✅ cắt đứt tham chiếu cuộc gọi cũ
    setState((prev) => ({
      ...prev,
      status: targetStatus,
      error,
      callId: null,                        // ✅ state đi đôi với ref
      callerId: null,
      callerName: null,
      calleeId: null,
      type: null,
      localStream: null,
      remoteStream: null,
      hasLocalVideo: false,
      isVideoMuted: false,
      isAudioMuted: false,
    }));
  },
  [cleanupMediaAndPeer]
);

// resetCall cũng phải xóa ref
const resetCall = useCallback((): void => {
  cleanupMediaAndPeer();
  callIdRef.current = null;                // ✅ không rò rỉ sang call kế tiếp
  setState(INITIAL_CALL_STATE);
}, [cleanupMediaAndPeer]);
```

**Lưu ý**: `terminateSession` giữ tham số `error` (đã có sẵn trong CallState) — message watchdog timeout đi vào đây, tới `state.error` và hiển thị ở `statusMessage` (cần quyết định mục 5).

### 3.4 Idempotent `endCall` (fix RC-3, RC-5)

Thêm guard đầu hàm — nếu đã terminal thì chỉ dọn local, không emit:

```ts
const endCall = useCallback((): void => {
  // Guard idempotent: đã terminal thì không emit nữa (chặn RC-3: emit call:end lên call đã kết thúc
  // → BE throw ConflictError → phản hồi call:busy về người gửi)
  if (stateRef.current.status === "ended" || stateRef.current.status === "rejected" ||
      stateRef.current.status === "missed" || stateRef.current.status === "busy") {
    return;
  }
  // ... existing code (call:cancel khi dialing, call:end khi đã có callId)
}, [terminateSession]);
```

**Phương án bị loại**: thêm `hasEndedRef` cờ riêng — trùng lặp thông tin với `stateRef.current.status` (single source of truth).

### 3.5 BE: `call:end` idempotent + disconnect answered cập nhật DB (fix RC-6)

**Lựa chọn A (khuyên dùng) — BE tự im lặng khi đã terminal**:

`call.service.ts` `endCall`: thay vì throw ConflictError khi status đã `ended|declined|missed`, **trả về bản ghi hiện tại và clear registry** (idempotent). Lý do: `call:end` là thao tác đóng — lặp lại là an toàn về mặt ngữ nghĩa, không phải xung đột nghiệp vụ như `acceptCall`.

```ts
// Đã kết thúc rồi → idempotent: trả về bản ghi hiện có, giải phóng registry (nếu còn treo)
// thay vì throw ConflictError (gây vòng lặp call:busy → terminateSession("busy") ở FE).
const isTerminal = ["ended", "declined", "missed"].includes(call.status);
if (isTerminal) {
  this.callRegistry.clearCall(callId);
  return call;
}
```

**Phương án B (bị loại)**: giữ throw + bắt riêng ở handler rồi emit `call:ended` (không `call:busy`). Phức tạp hơn, và vẫn để registry treo nếu caller-side tự terminate trước.

**Disconnect khi đang answered** (`call.handlers.ts:363-366`): thêm cập nhật DB sang `ended` kèm `endedAt` + `durationSec`:

```ts
} else {
  // Cuộc gọi đã answered/active: đóng hẳn trên DB + báo đối phương
  try {
    await callSvc.endCall(activeCallId, userId);
  } catch (err) {
    logger.warn(`Không thể end call ${activeCallId} khi disconnect:`, err);
  }
  emitToUserFn(getOtherUserId(call), "call:peer_disconnected", { callId: activeCallId });
}
```

**Trade-off**: `endCall` tính `durationSec` từ `answeredAt` — đo đúng thời lượng thực. Rủi ro nhỏ: nếu user có 2 thiết bị và thiết bị này rớt mạng tạm thời, cuộc gọi trên thiết bị kia bị đóng. Đã được `isUserOnlineFn` (`call.handlers.ts:342`) chặn — chỉ khi **không còn socket nào** mới chạy nhánh này.

**Test impact**: `call.service.test.ts:468-475` (test "ném ConflictError nếu cuộc gọi đã kết thúc trước đó") **sai lệch behavior mới** → phải đổi sang test idempotent. `call.handlers.test.ts:401-414` phải thêm assertion `mockCallSvc.endCall` được gọi.

### 3.6 Modal thông báo lỗi cuộc gọi (fix RC-2b)

**Quyết định UX**: message lỗi timeout/failure hiển thị qua **modal riêng** (yêu cầu người dùng), không chèn vào status line.

Tạo molecule `frontend/src/features/call/components/molecules/CallErrorModal.tsx`:

- Dùng native `<dialog>` + `showModal()` **giống hệt** `IncomingCallModal.tsx:38-54` — tận dụng focus-trap và khóa tương tác nền.
- `role="alertdialog"`, `aria-live="assertive"`, `aria-modal="true"` — đạt chuẩn a11y (frontend.md §5).
- Phím tắt: **Enter = Thử lại**, **Escape = Đóng** (cùng pattern với `IncomingCallModal.tsx:57`).
- Icon `AlertTriangle` (lucide-react, cùng bộ icon đã dùng).

```tsx
interface CallErrorModalProps {
  /** Nội dung lỗi thân thiện (lấy từ state.error, đã được describeMediaError / watchdog message) */
  message: string;
  /** Có hiển thị nút "Thử lại" không — false khi lỗi không thể retry (vd: đối phương từ chối) */
  canRetry?: boolean;
  /** Callback nút Thử lại: khởi tạo lại cuộc gọi tới cùng calleeId + type */
  onRetry?: () => void;
  /** Callback nút Đóng: reset state về idle */
  onClose: () => void;
}
```

**Luồng gắn modal**: trong `CallProvider.tsx` — render khi `call.state.error && isTerminal(call.state.status)`:

```tsx
{call.state.status !== "idle" && call.state.status !== "ringing" && (
  <CallScreen ... />
)}
{/* Modal lỗi chỉ hiện khi màn hình call đang ở trạng thái cuối cùng */
{call.state.error && call.state.status !== "idle" && (
  <CallErrorModal
    message={call.state.error}
    canRetry={call.state.calleeId !== null && call.state.type !== null}
    onRetry={() => {
      const { calleeId, type } = call.state;
      call.resetCall();               // ✅ resetCall đã xóa error (T2) trước khi gọi lại
      void call.initiateCall(calleeId!, type!);
    }}
    onClose={call.resetCall}
  />
)}
```

**Thứ tự z-index**: `CallErrorModal` phải **đè lên** `CallScreen` (vì CallScreen đang overlay toàn màn hình). Native `<dialog>` render trong top-layer nên tự động đè — không cần canh `z-index`. **Nhưng không render cả hai cùng lúc**: khi `CallErrorModal` mở, overlay `CallScreen` terminal vẫn nằm dưới — chấp nhận được vì dialog khóa tương tác nền (modal).

**Hiện message tiếng Việt từ đâu**:
- Watchdog timeout (T1): truyền `"Không thể thiết lập kết nối. Vui lòng thử lại."` vào `terminateSession("ended", msg)`.
- ICE `failed` (`useCall.ts:205-211`): truyền `"Kết nối bị gián đoạn."`.
- `describeMediaError` (`useCall.ts:223-241`) đã có message tiếng Việt sẵn — giữ nguyên, chỉ cần gắn vào `state.error` (đã có).

**Phương án bị loại**: toast — biến mất sau vài giây, người dùng không kịp đọc, và không focus-trap. Modal ép user phải xác nhận.

**Lưu ý**: trạng thái `busy`/`offline`/`rejected` không nên hiện modal lỗi — đây là phản hồi nghiệp vụ bình thường, không phải lỗi kỹ thuật. Modal chỉ hiện khi `state.error !== null`. Trạng thái `busy` hiện đã được `terminateSession("busy")` đặt error = null (T2 đặt `error: null` cho mọi terminal) — nên modal tự nhiên không hiện. Cần **bảo lưu error cho các terminal thật sự có lỗi**: phân biệt bằng tham số truyền vào `terminateSession`, không phải trạng thái.

**Các nút điều khiển trong modal theo trạng thái**:

| Trạng thái | Tiêu đề | Nút hiển thị |
|---|---|---|
| watchdog timeout / ICE failed | "Không thể kết nối" | Thử lại + Đóng |
| lỗi thiết bị (camera/micro) | "Không truy cập được thiết bị" | Thử lại + Đóng |
| `busy` / `offline` / `rejected` | — | **không hiện modal** (hiện statusMessage + nút Đóng ở CallScreen) |

### 3.7 Cấu hình TURN server (fix RC-1 — tầng gốc)

**Vấn đề**: `webrtc-config.ts:5-9` hiện chỉ STUN của Google. Trên symmetric NAT / firewall công ty / CGNAT, hai peer không kết nối P2P được → ICE chết lặng → watchdog đóng cuộc gọi sau 10s nhưng cuộc gọi vẫn **không hoạt động**. Watchdog (T1) chỉ biến "treo vĩnh viễn" thành "đóng sau 10s + modal báo lỗi". **TURN mới là tầng giúp cuộc gọi thực sự kết nối.**

**Thiết kế**:

```ts
// webrtc-config.ts
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  // TURN chỉ thêm khi cấu hình môi trường có — nếu không sẽ giữ hành vi cũ (STUN-only)
  ...(import.meta.env.VITE_TURN_URL
    ? [{
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
      }]
    : []),
];
```

**Biến môi trường mới** (thêm vào `frontend/.env.example`):

```bash
# === WebRTC TURN Server — Relay qua NAT khắc nghiệt (symmetric NAT / firewall) ===
# Khi để trống: chỉ dùng STUN, cuộc gọi có thể không kết nối được qua NAT khắc nghiệt.
# Khuyến nghị: Open Relay (miễn phí) https://www.metered.ca/tools/openrelay/ hoặc tự host coturn.
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

**Tại sao tách env thay vì hardcode**: open relay miễn phí có rate-limit và không SLA — dùng cho dev/production-small. Khi scale, user tự thay credentials mà không phải sửa code (Dependency Guard: không thêm package, chỉ dùng `import.meta.env` đã có sẵn Vite).

**Tại sao hỗ trợ empty (fallback STUN-only)**: không phá vỡ môi trường dev local hiện tại (LAN, STUN đủ). Nếu hardcode TURN khi env rỗng sẽ crash hoặc leak credentials.

**Rủi ro bảo mật**: TURN credentials trong Vite env bị bundle vào client code — đây là giới hạn cố hữu của WebRTC browser (credentials phải gửi tới client). Giảm thiểu: dùng TURN với TTL credential ngắn + restricted IP. Không hardcode credentials vào git.

**Phương án bị loại** (ghi lại để rõ ràng):
- Hardcode Open Relay URL — leak credentials vào repo public, vi phạm bảo mật.
- Bỏ hẳn STUN Google — STUN vẫn cần cho NAT nhẹ (phần lớn trường hợp).

---

## 4. Danh Sách Công Việc (Task Breakdown)

| Task | Mô tả | File đính kèm | Tier phụ trách | Phụ thuộc |
|---|---|---|---|---|
| **T1** | Watchdog 10s cho `connecting`: thêm `connectionTimeoutRef`, `startConnectionWatchdog()`, clear trong `cleanupMediaAndPeer` + branch ICE `connected`. Gắn vào `handleAccepted` sau khi tạo PC. | `useCall.ts` | `feature-builder` | — |
| **T2** | `terminateSession` reset trọn vẹn (thêm `callId`, `type`, `hasLocalVideo`...) + `callIdRef.current = null`; `resetCall` cũng xóa ref. | `useCall.ts` | `feature-builder` | — |
| **T3** | `endCall` idempotent guard (terminal → return sớm). | `useCall.ts` | `feature-builder` | T2 |
| **T4** | `CallScreenNonVideo`: nút đóng cho mọi trạng thái non-active; terminal dùng `onClose`, connecting/dialing dùng `onEnd`/`onCancel`. | `CallScreen.tsx` | `feature-builder` | T3 |
| **T5** | `CallScreen`: `getStatusMessage()` ưu tiên `state.error`; `CallTimer active` theo status thật. | `CallScreen.tsx` | `feature-builder` | T4 |
| **T5b** | Tạo `CallErrorModal` (molecule, native `<dialog>` + a11y); gắn vào `CallProvider` khi `state.error` + terminal. Nút **Thử lại** gọi `resetCall()` + `initiateCall(calleeId, type)`. | `CallErrorModal.tsx` (mới), `CallProvider.tsx` | `feature-builder` | T2, T5 |
| **T10** | Cấu hình TURN qua `VITE_TURN_URL`/`USERNAME`/`CREDENTIAL` (fallback STUN-only khi trống) + cập nhật `.env.example`. | `webrtc-config.ts`, `.env.example` | `feature-builder` | T1 |
| **T6** | BE `call.service.endCall` idempotent khi đã terminal (trả về + clear registry, không throw). | `call.service.ts` | `feature-builder` | T3 |
| **T7** | BE disconnect answered → `callSvc.endCall` + emit `call:peer_disconnected`. | `call.handlers.ts` | `feature-builder` | T6 |
| **T8** | Cập nhật test: `call.service.test.ts` (test endCall idempotent thay vì throw), `call.handlers.test.ts` (disconnect answered gọi endCall). Thêm unit test watchdog FE nếu khả thi. | 2 file test | `feature-builder` | T6, T7 |
| **T9** | Xác minh toàn diện: `tsc --noEmit` FE + BE, `npm test` BE, React Doctor (`npx react-doctor@latest`), test thủ công 2 trình duyệt (kể cả test gọi qua tethering/mobile NAT). | — | `feature-builder` | T1–T8, T10 |

**Thứ tự đề nghị**: T2 → T3 → T6 → T7 → T8 (BE先行, vì FE guard dựa trên behavior BE mới) → T1 → T10 → T4 → T5 → T5b → T9.

---

## 5. Test Gate

### T1 — Watchdog
- [x] Tạo PC nhưng KHÔNG mô phỏng ICE connected → sau 10s state phải là `ended`, `state.error` có message.
- [x] Tạo PC + ICE `connected` trong 5s → watchdog bị clear, cuộc gọi tiếp tục `active`.
- [x] `cleanupMediaAndPeer` xóa watchdog (kiểm `connectionTimeoutRef.current === null`).

### T2 — Reset trọn vẹn
- [x] Sau `terminateSession("ended")`: `callId === null`, `type === null`, `hasLocalVideo === false`, `callIdRef.current === null`.
- [x] Sau `resetCall()`: `callIdRef.current === null`.

### T3 — Idempotent endCall
- [x] `endCall()` khi `status === "ended"` → KHÔNG emit socket nào.
- [x] `endCall()` khi `status === "dialing"` → emit `call:cancel` đúng 1 lần.
- [x] `endCall()` khi `status === "active"` → emit `call:end` đúng 1 lần.

### T4/T5 — UI
- [x] Audio call kẹt `connecting` → **có nút "Hủy cuộc gọi"** bấm được (trước fix: không có nút).
- [x] Trạng thái terminal → có nút "Đóng", bấm → overlay biến mất ngay (không chờ 2s).
- [x] `state.error` có giá trị → hiển thị message lỗi thay vì message mặc định.
- [x] Timer dừng đếm khi `ended`.

### T5b — CallErrorModal
- [x] Watchdog timeout (T1) kích hoạt → modal hiện message tiếng Việt + nút **Thử lại** + **Đóng**.
- [x] Bấm **Thử lại** → `resetCall()` chạy (state về `idle`, `callIdRef` rỗng) rồi `initiateCall(calleeId, type)` tới đúng người/type cũ.
- [x] Bấm **Đóng** / phím Escape → state về `idle`, overlay + modal biến mất hoàn toàn.
- [x] Phím Enter → Thử lại; focus mặc định vào nút Thử lại.
- [x] `busy` / `offline` / `rejected` → **KHÔNG hiện modal** (chỉ hiện statusMessage ở CallScreen).
- [x] a11y: `role="alertdialog"`, `aria-live="assertive"`, `aria-modal="true"`, focus-trap hoạt động (tab không thoát ra CallScreen bên dưới).
- [x] Modal đè lên CallScreen và khóa tương tác nền (native top-layer `<dialog>`).

### T10 — TURN
- [x] `VITE_TURN_URL` để trống → `ICE_SERVERS` chỉ chứa STUN (giữ hành vi cũ, không crash).
- [x] Có đủ 3 biến TURN → `ICE_SERVERS` chứa 1 STUN + 1 TURN kèm `username`/`credential`.
- [ ] Gọi giữa 2 peer qua NAT khắc nghiệt (hotspot mobile / 2 dải mạng khác) → **kết nối thành công** (ICE relay qua TURN, không phải P2P).
- [x] Không có credentials nào bị hardcode trong git (chỉ `.env` local + `.env.example` placeholder trống).

### T6/T7 — BE
- [x] `endCall` trên call `status: "ended"` → trả về call, `registry.isBusy` false, KHÔNG throw.
- [x] `endCall` trên call `status: "answered"` → tính đúng `durationSec`.
- [x] Disconnect khi answered → `mockCallSvc.endCall` được gọi + `call:peer_disconnected` emit.
- [x] `npm test` ở `backend/` pass toàn bộ (hiện 41/42 → phải đạt 42/42).

### T9 — Gate cuối
- [x] `cd frontend && npx tsc --noEmit` — 0 error.
- [x] `cd backend && npx tsc --noEmit` — 0 error.
- [x] `cd backend && npm test` — tất cả pass.
- [x] **`cd frontend && npx react-doctor@latest`** (bắt buộc theo frontend.md §6). Nếu không chạy được: báo "CHƯA verify được React Doctor", không im lặng bỏ qua.
- [ ] Test thủ công 2 tab: gọi → nghe → kết thúc → overlay đóng trong <3s, gọi lại ngay được.
- [ ] Test thủ công: gọi → simulate ICE fail (tắt mạng 1 phía) → overlay đóng trong <15s, **modal báo lỗi + nút Thử lại**.
- [ ] Test thủ công qua NAT khắc nghiệt (hotspot mobile / mạng công ty): cuộc gọi **kết nối thành công** nhờ TURN relay.

---

## 6. Rủi Ro & Phương Án Lùi

### R6.1: Watchdog đóng cuộc gọi đang hoạt động tốt (RỦI RO CHÍNH)

**Kịch bản**: ICE connect chậm hơn 10s trên mạng yếu (mobile edge, roaming quốc tế) → watchdog firing sai, đóng cuộc gọi mà user đã nghe.

**Giảm thiểu**:
- Clear watchdog ngay khi nhận ICE `connected`/`completed` (đã có branch) — đảm bảo cuộc gọi vào `active` thì timer chết.
- Clear trong `cleanupMediaAndPeer` — đảm bảo unmount không firing timer mồ côi.
- 10s là chuẩn `iceRestartTimeout`, hợp lý hơn 30s.

**Phương án lùi**: nếu vẫn false-positive, tăng lên 15s hoặc thêm layer "ICE restart 1 lần trước khi timeout" (`pc.restartIce()` nếu có remote description) — Ponytail: ICE restart cần remote description, không phải lúc nào khả dụng.

### R6.2: TURN credentials bị bundle vào client (bảo mật)

**Vấn đề**: `VITE_TURN_*` trong Vite env bị inline vào JS bundle gửi xuống trình duyệt — bất kỳ ai xem source cũng lấy được. Đây là giới hạn cố hữu của WebRTC browser (credentials phải có mặt ở client để authorice relay).

**Giảm thiểu**:
- Dùng TURN credential **hạn chế thời gian** (TTL ngắn, generate phía server) thay vì static credential.
- Restrict TURN theo IP nguồn khi relay hỗ trợ.
- Tuyệt đối **không hardcode** credentials vào git (chỉ qua `.env` local, không commit).
- `.env.example` chỉ để placeholder trống — không chứa giá trị thật.

**Khi `VITE_TURN_URL` trống**: code fallback STUN-only (giữ hành vi hiện tại, không crash, không leak).

### R6.3: BE endCall idempotent có thể che giấu lỗi nghiệp vụ

**Vấn đề**: trước đây throw ConflictError là tín hiệu "có gì đó gọi endCall 2 lần" (double-end, race). Im lặng sẽ làm mất khả năng debug.

**Giảm thiểu**: log warning nội bộ khi nhánh idempotent kích hoạt (`logger.warn`), không trả lỗi cho client. Client không cần biết — đây là hành vi đóng, lặp lại luôn an toàn.

### R6.4: Test thủ công phải qua 2 trình duyệt thật + nhiều loại mạng

Test tự động không thể mô phỏng hết NAT traversal và ICE state. Cần xác nhận bằng tay: gọi thành công + kết thúc gọn, và gọi thất bại (tắt mạng) + đóng gọn. **Bắt buộc test ít nhất 1 case qua NAT khắc nghiệt** (hotspot mobile, mạng công ty, hoặc 2 máy khác dải mạng) để xác nhận TURN thật sự relay được. Đây là tầng cuối quyết định task done hay chưa.

---

## 7. Giả Định Cần Xác Nhận

1. **10 giây** cho watchdog connecting là chấp nhận được (mặc định ICE restart timeout). Nếu user thường gọi trên mạng rất chậm, có thể tăng.
2. **BE `endCall` chuyển sang idempotent** là thay đổi contract có chủ đích — xử lý BE/FE bất đồng bộ trạng thái. Test `call.service.test.ts:468` hiện kỳ vọng throw phải đổi.
3. **TURN credentials**: plan dùng open relay miễn phí (Metered Open Relay) cho `.env` — giới hạn rate/SLA, phù hợp MVP. Khi scale cần tự host `coturn` hoặc TURN trả phí. Bạn có URL/credentials TURN sẵn không, hay để placeholder trống trong `.env.example` (tự điền)?
4. **Modal lỗi chỉ dành cho lỗi kỹ thuật** (watchdog timeout, ICE `failed`, lỗi thiết bị camera/micro). Các trạng thái `busy` / `offline` / `rejected` là phản hồi nghiệp vụ bình thường → vẫn hiện `statusMessage` + nút Đóng ở `CallScreen`, **không hiện modal**. Xác nhận cách phân xử này.
