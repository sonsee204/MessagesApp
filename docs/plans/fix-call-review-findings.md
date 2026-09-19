# Implementation Plan: Fix Code Review Findings — Tính năng Call/WebRTC

> Nguồn: Code review toàn diện 30 file changed (call feature) bởi `deep-architect`.
> 15 findings: 2 Critical, 4 High, 5 Medium, 4 Low.

---

## 1. Bối cảnh & Mục tiêu

- **Vấn đề**: Tính năng call/WebRTC vừa hoàn thiện (Task 1–6) có 2 bug blocking (cuộc gọi `answered` treo chặn gọi lại vĩnh viễn), 1 race condition FE, 1 circular import BE, cùng các vi phạm rules (N+1, `any`, god file).
- **Phạm vi làm**: Fix C1–C2, H1–H4, M1–M4. L2/L3 (tách god file) và L4 (dynamic import firebase) **out-of-scope** — ghi vào nợ kỹ thuật, làm riêng để tránh diff lớn trộn lẫn bugfix.
- **Phạm vi KHÔNG làm**: Không refactor kiến trúc, không thêm tính năng mới, không đổi API contract hay Socket.IO event payload (FE-BE contract đang chạy phải giữ nguyên).

---

## 2. Thiết kế kỹ thuật

### 2.1 Trạng thái cuộc gọi — mở rộng self-heal

Luồng hiện tại (call.service.ts:86–108): busy registry treo → tra CSDL → nếu `ended|declined|missed|ringing_stale(60s)` thì clear, ngược lại throw ConflictError.

**Bổ sung `answered` ở 2 lớp phòng thủ** (backend, không đổi schema):

| Lớp | File | Logic |
|---|---|---|
| Lớp 1 — self-heal runtime | `call.service.ts` | Thêm `isStaleAnswered`: `answered` + `answeredAt` quá 30 phút → clear. Không clear `answered` non-stale vì đó là cuộc gọi đang diễn ra thật. |
| Lớp 2 — startup sweep | `call.handlers.ts` `cleanupOrphanCalls` | `ringing → missed` (giữ nguyên), `answered → ended` kèm `endedAt`. Tách 2 lệnh `updateMany` vì status đích khác nhau. |

**Trade-off**: Timeout 30 phút cho `answered` là heuristic — nếu user gọi >30 phút mà bị treo registry thì vẫn bị block tới khi hết 30 phút. Phương án bị loại: dùng heartbeat Socket.IO để detect active chính xác (tốn scope, cần thêm event round-trip). 30 phút đủ an toàn vì registry in-memory đã mất sau restart, và `_lrubusy` chỉ tồn tại khi server sống.

### 2.2 N+1 → batch query

Thu thập `busyCallIds` (max 2 do loop qua `[callerId, calleeId]`), gọi `callRepo.findByIds(ids)` (thêm method dùng `$in`), map kết quả theo id. Rule backend.md §4.

### 2.3 Circular import

Tách `isParticipant` từ `socket/index.ts` → `backend/src/utils/participant.util.ts` (hàm thuần, không side-effect import). `socket/index.ts` và `upload.service.ts` cùng import từ utils mới.

### 2.4 Disconnect khi đang ringing

Trong disconnect handler, khi `call.status === "ringing"`: bọc `callSvc.cancelCall(activeCallId, userId)` trong try/catch (đã có DB → `missed` + emit `call:canceled`), sau đó mới `clearCall`. Không thay thứ tự clearCall vì phải lấy `activeCallId` trước.

### 2.5 Guard incoming call

`handleIncoming` thêm guard đầu: `if (stateRef.current.status !== "idle") return;` — cuộc gọi đến khi đang active sẽ bị bỏ qua (server-side đã chặn ConflictError, đây là lớp phòng thứ 2 cho race khi 2 client emit gần như đồng thời).

### 2.6 Các fix nhỏ

| # | File | Fix |
|---|---|---|
| M1 | `CallScreen.tsx` | `<audio>` mount khi `status !== "idle"` (thay vì `=== "active"`) để bắt kịp remote stream đến sớm ở `connecting`. |
| M2 | `useCall.ts` | `toggleVideo` upgrade: tạo `new MediaStream(stream.getTracks())` để React state đổi reference → effect deps re-fire. |
| M3 | `upload.service.test.ts` | `as any` → `as unknown as ConversationDocument` (hard-bans §1). |
| M4 | `app.ts` | `trust proxy` chỉ bật khi `env.NODE_ENV !== "production"` (hoặc config `TRUST_PROXY`). |
| M5 | `vite.config.ts` | `allowedHosts` gate `process.env.NODE_ENV !== "production"`. |

---

## 3. Danh sách công việc (Task Breakdown)

> Thứ tự phụ thuộc: **T1 → T2** (cùng sửa call.service.ts). Còn lại song song được.

### T1 — BE: Ghost self-heal mở rộng `answered` + N+1 fix (Critical C2 + High H1)
- **Tier**: `feature-builder`
- **File**: `backend/src/services/call.service.ts`, `backend/src/repositories/call.repository.ts` (thêm `findByIds`), `backend/src/services/call.service.test.ts`
- **Chi tiết**:
  1. Thêm `isStaleAnswered` (xem §2.1) vào `isGhostEntry`.
  2. Thu thập `busyCallIds` → batch `findByIds` → map. Thay `findById` inline trong loop.
  3. Test mới: "tự chữa entry ma: `answered` treo quá 30 phút → clear + tạo call mới thành công" và "`answered` non-stale → vẫn throw ConflictError".
- **Test Gate**: `npm test -- call.service` pass; 2 test case mới xanh.

### T2 — BE: cleanupOrphanCalls xử lý `answered` (Critical C1)
- **Tier**: `feature-builder`
- **File**: `backend/src/socket/call.handlers.ts` (hàm `cleanupOrphanCalls`), test nếu có
- **Chi tiết**: Tách thành 2 `updateMany`: `{status:"ringing"}` → `missed`; `{status:"answered"}` → `ended` + `endedAt`.
- **Phụ thuộc**: Sau T1 (cùng vùng code self-heal, tránh conflict khi merge).
- **Test Gate**: `npm test -- call.handlers` pass.

### T3 — BE: Tách `isParticipant` ra utils (High H2)
- **Tier**: `feature-builder`
- **File**: tạo `backend/src/utils/participant.util.ts`; sửa `backend/src/socket/index.ts` (re-export để giữ backward compat nếu cần), `backend/src/services/upload.service.ts`
- **Test Gate**: `npm test -- upload.service` pass; `tsc --noEmit` sạch; không còn import `isParticipant` từ `../socket` trong service layer.

### T4 — BE: Disconnect handler cập nhật DB khi ringing (High H3)
- **Tier**: `feature-builder`
- **File**: `backend/src/socket/call.handlers.ts` (disconnect handler), `call.handlers.test.ts`
- **Chi tiết**: Khi `call.status === "ringing"` → try/catch `callSvc.cancelCall(activeCallId, userId)` rồi mới `clearCall`.
- **Test Gate**: Test mới "disconnect giữa ringing → DB chuyển `missed` + emit `call:canceled`".

### T5 — BE: trust proxy + vite allowedHosts gate env (Medium M4, M5)
- **Tier**: `feature-builder`
- **File**: `backend/src/app.ts`, `frontend/vite.config.ts`
- **Chi tiết**: `app.set("trust proxy", env.NODE_ENV === "production" ? false : 1)`; vite `allowedHosts` chỉ khi `mode !== "production"`.
- **Test Gate**: Backend boot được ở cả 2 mode; `vite build` không lỗi host.

### T6 — FE: Guard handleIncoming + toggleVideo reference + audio mount (High H4, Medium M1, M2)
- **Tier**: `feature-builder`
- **File**: `frontend/src/features/call/hooks/useCall.ts`, `frontend/src/features/call/components/organisms/CallScreen.tsx`
- **Chi tiết**:
  1. `handleIncoming`: guard `stateRef.current.status !== "idle"` → return (kèm comment Tiếng Việt lý do race).
  2. `toggleVideo`: `new MediaStream(stream.getTracks())` khi setState upgrade camera.
  3. `CallScreen`: `<audio>` mount khi `state.status !== "idle"`.
- **Test Gate**: `tsc --noEmit` sạch; React Doctor chạy và báo kết quả; `npm run build` pass.

### T7 — Dọn dẹp hard-bans (Medium M3)
- **Tier**: `feature-builder` (hoặc inline vì ≤5 dòng — nhưng T6 đã động file test nên gộp luôn)
- **File**: `backend/src/services/upload.service.test.ts`
- **Chi tiết**: `as any` → `as unknown as ConversationDocument` (type có sẵn trong repo).
- **Test Gate**: `npm test -- upload.service` pass; grep `as any` trong diff trả 0.

---

## 4. Test Gate (Tổng)

| Gate | Lệnh | Áp dụng sau |
|---|---|---|
| Unit test BE | `cd backend && npm test` | T1, T2, T3, T4, T5, T7 |
| Type check BE | `cd backend && npx tsc --noEmit` | T1–T5, T7 |
| Type check FE | `cd frontend && npx tsc --noEmit` | T6 |
| Build FE | `cd frontend && npm run build` | T6 |
| React Doctor | `cd frontend && npx react-doctor@latest` | T6 (bắt buộc theo frontend.md §6) |
| Hard-bans grep | grep `as any` / `@ts-ignore` trong diff | Tất cả task |
| God file check | `useCall.ts`, `CallScreen.tsx` không tăng dòng hiệu dụng | T6 |

**Lưu ý React Doctor**: Nếu không chạy được (mất mạng/registry lỗi), báo trung thực "CHƯA verify được React Doctor", không im lặng bỏ qua (frontend.md §6).

---

## 5. Rủi ro & Phương án lùi

| Rủi ro | Giảm thiểu |
|---|---|
| `answered → ended` ở startup sweep đánh đồng cuộc gọi thật >30 phút với call treo | Chỉ chạy lúc server khởi động (không có user active); registry in-memory đã clearAll nên mọi `answered` còn lại chắc chắn là mồ côi. |
| `isStaleAnswered` 30 phút quá ngắn với cuộc gọi dài thực tế | Khi registry treo do double-disconnect, 2 user đều mất kết nối → họ không thể đang gọi thật. Mốc 30 phút là cận an toàn cho edge case tab crash rồi mở lại. |
| Tách `isParticipant` có thể break import khác | Giữ re-export từ `socket/index.ts` (`export { isParticipant } from "../utils/participant.util"`) trong bản này, xoá re-export sau khi xác nhận không ai dùng. |
| `new MediaStream(...)` tạo object mới mỗi lần toggle | Chỉ tạo khi upgrade (chưa có video track), không tạo khi toggle enabled — chi phí nhỏ, không leak vì track cũ được reuse. |
| Rollback | Mỗi task là 1 commit riêng, scope nhỏ, có thể revert độc lập. Không có migration DB (chỉ đổi logic query + status có sẵn trong schema). |

---

## Giả định cần xác nhận

1. **Timeout 30 phút cho stale `answered`** — cần bạn xác nhận hoặc điều chỉnh (15 phút? 30 phút? 30 phút?).
2. **`answeredAt` field đã tồn tại** trên CallModel — review report cho là có; T1 sẽ verify, nếu thiếu phải thêm field + backfill.
3. **`ConversationDocument` type** có tên chính xác trong repo để thay `as any` (T7).
4. **L2/L3 (tách god file `useCall.ts` 692 dòng, `CallScreen.tsx` 526 dòng)** — out-of-scope theo kế hoạch này. Bạn muốn tạo plan riêng cho việc tách này không?

---

## Output Contract

```
TRẠNG THÁI: DONE
ĐƯỜNG DẪN PLAN: docs/plans/fix-call-review-findings.md
TÓM TẮT KIẾN TRÚC:
- Self-heal mở rộng ra `answered` (runtime 30 phút heuristic + startup sweep 2 lệnh updateMany).
- N+1 → batch `findByIds($in)`; `isParticipant` tách ra utils thuần cắt circular import.
- Disconnect ringing → cancelCall ghi DB missed; FE guard incoming + fix MediaStream reference.
- Gate trust proxy / vite allowedHosts theo NODE_ENV.
Bảng task → tier → phụ thuộc:
T1 (C2+H1, feature-builder) → T2 (C1, feature-builder, phụ thuộc T1)
T3 (H2), T4 (H3), T5 (M4+M5), T6 (H4+M1+M2, FE), T7 (M3) — song song
GIẢ ĐỊNH CẦN XÁC NHẬN: 4 mục ở trên (timeout 30 phút, answeredAt field, tên type, có tách god file không).
```
