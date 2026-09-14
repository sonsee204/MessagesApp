# Design Spec: Tải ảnh & video trong khung chat (nút attach MessageInput)

> **Ngày**: 2026-09-14 · **Trạng thái**: Đã duyệt qua brainstorming
> **Phạm vi**: Mở rộng pipeline upload đã có (avatar/banner) thành pipeline media của tin nhắn chat. Ảnh xử lý đồng bộ bằng sharp; video transcode server-side bằng ffmpeg qua hàng đợi BullMQ + Redis.

---

## 1. Bối cảnh & hạ tầng đã tồn tại

| Thành phần | Hiện trạng | Vai trò trong feature này |
| :--- | :--- | :--- |
| `backend/src/config/upload.ts` | `UPLOAD_DIR`, `UPLOAD_URL_PREFIX = /api/uploads`, trần 5MB, `IMAGE_PRESETS` (avatar/banner) | Mở rộng thêm preset `chat` + trần video 50MB |
| `backend/src/middlewares/upload.ts` | multer memoryStorage + fileFilter mimetype | Tái sử dụng pattern, thêm filter riêng cho chat |
| `backend/src/utils/image-storage.ts` | `saveImage()` sharp resize→webp, `deleteImageByUrl()` | Thêm nhánh xử lý ảnh chat |
| `backend/src/app.ts:45` | `express.static(UPLOAD_DIR)` — đã hỗ trợ HTTP Range | Serve video seek được, không cần code mới |
| `AttachmentSchema` (message.schema.ts) | `{url, name, size, mimeType}` | Thêm 2 field optional: `posterUrl?`, `duration?` |
| `chat.store.sendMessage` → `POST` → `emitToConversation("new_message")` | Luồng gửi tin nhắn hoàn chỉnh | Video dùng lại đúng luồng này sau khi transcode xong |
| `DiscordMessageItem.tsx:128` | Render attachments bằng `<img>` | Thêm nhánh `<video>` |
| `StickerPicker` | Đã gửi `onSendMessage("", "IMAGE", [attachment])` | Chứng minh frontend đã nhận đường gửi tin IMAGE |

**Khoảng trống duy nhất**: endpoint upload media cho chat, worker transcode video, UI attach, render video.

## 2. Quyết định kiến trúc đã chốt

1. **Video**: transcode server-side bằng ffmpeg (người dùng chọn), KHÔNG lưu raw.
2. **Hàng đợi**: BullMQ + Redis (người dùng chọn), KHÔNG dùng job in-process.
3. **Trần dung lượng**: ảnh **5MB** (giữ nguyên), video **50MB** (đã xác nhận).
4. **Ai gửi tin nhắn video**: chính người gửi, sau khi nhận socket event `media_ready`. Worker không bao giờ trực tiếp tạo Message → `message.service` vẫn là lối duy nhất ghi tin nhắn.

## 3. Kiến trúc tổng thể

```
[MessageInput +]
   ├─ ảnh   ──POST /api/chat/uploads──▶ validate magic bytes ─▶ sharp preset "chat"
   │                                        └─201 {attachment}─▶ onSendMessage(text,"IMAGE",[att])
   │                                                              └─▶ message.service ─▶ new_message
   └─ video ─POST /api/chat/uploads──▶ lưu tmp raw ─▶ MediaAsset(QUEUED) ─▶ BullMQ add
                └─202 {mediaId}─▶ pending tray (thumbnail blob + progress + hủy)
                                     [media-worker] ffmpeg transcode + poster + ffprobe duration
                                        └─READY─▶ socket "media_ready"{mediaId, attachment}
                                                    └─▶ onSendMessage("", "IMAGE", [attachment])
```

## 4. Chi tiết Backend

### 4.1 Cấu hình (`config/upload.ts`)

- `CHAT_IMAGE_MAX_SIZE = 5MB` (tái dụng `MAX_FILE_SIZE`), `CHAT_VIDEO_MAX_SIZE = 50MB`.
- `IMAGE_PRESETS.chat = { width: 1280, height: 1280, fit: "inside" }` — không cắt, chỉ thu nhỏ khi vượt ngưỡng; webp q80. GIF ảnh động: giữ nguyên bytes (sharp động GIF chưa ổn định), chỉ kiểm tra dung lượng + magic bytes.
- Thư mục tạm video: `UPLOAD_DIR/tmp/`; video thành phẩm + poster: `UPLOAD_DIR/media/`.

### 4.2 Validator magic bytes (`utils/media-signature.ts` — module mới, pure function)

Không tin `file.mimetype` (client giả được). Đọc header buffer:
- `jpg`: `FF D8 FF` · `png`: `89 50 4E 47` · `webp`: `RIFF....WEBP` · `gif`: `GIF87a/GIF89a`
- `mp4/mov`: offset 4 == `ftyp` · `webm/mkv`: EBML `1A 45 DF A3`

Trả về `MediaKind | null`. Đây là lớp xác thực thật — tương đương vai trò "sharp decode fail ⇒ không phải ảnh" của pipeline hiện tại.

### 4.3 Endpoint `POST /api/chat/uploads` (controller `media.controller.ts`, routes mới)

Middleware: auth guard → multer (memoryStorage, `limits: { fileSize: 50MB, files: 1 }`, field `file`) → validate.

| Loại | Điều kiện | Xử lý | Phản hồi |
| :--- | :--- | :--- | :--- |
| Ảnh | kind ∈ {jpg,png,webp,gif} và size ≤ 5MB | sharp resize/nén (trừ GIF) → `media/img-<hex>.webp` | `201 { attachment: {url,name,size,mimeType} }` |
| Video | kind ∈ {mp4,mov,webm} và size ≤ 50MB | ghi `tmp/<hex>.<ext>`, tạo doc `MediaAsset{status:"QUEUED"}`, `queue.add("transcode", {...})` | `202 { mediaId, status:"QUEUED" }` |
| Khác | — | `400` theo chuẩn error response (`INVALID_MEDIA_TYPE` / `FILE_TOO_LARGE`), không ghi đĩa |

- Tên tệp do server sinh (`crypto.randomBytes`), không dùng tên client — chống path traversal; `name` trong attachment chỉ là nhãn hiển thị đã sanitize.
- Rate-limit: reuse `express-rate-limit`, gói chặt cho upload (vd. 20 req/phút/user).
- `express.static` đang phục vụ cả `UPLOAD_DIR`: thư mục `tmp/` và `media/` nằm trong đó nên tự serve được; đặt `Cache-Control: immutable` cho `media/` (URL đổi mỗi tệp mới, cùng chiến lược avatar).

### 4.4 Model `MediaAsset` (`models/media-asset.model.ts`)

```ts
{ uploaderId: ObjectId, status: "QUEUED"|"PROCESSING"|"READY"|"FAILED",
  originalExt: string, finalAttachment?: Attachment, error?: string,
  createdAt (TTL index 24h cho FAILED/QUEUED cũ — tận dụng mongo TTL đã bật ở dev) }
```
Chỉ `uploaderId` được query `GET /api/chat/uploads/:mediaId` (404 nếu của người khác).

### 4.5 Worker (`backend/src/workers/media-worker.ts`, script `npm run worker:media`)

- BullMQ Worker `concurrency: 1`, `connection: REDIS_URL`.
- Pipeline: `spawn("ffmpeg", -i tmp → libx264 CRF28 veryfast, scale='min(1280,iw)':-2, +faststart, aac)` → `media/<hex>.mp4`; lần lượt `ffmpeg -ss 1 -i <out> -frames:v 1` → poster webp; `ffprobe` → `duration`.
- Exit code ≠ 0 hoặc quá hạn 10 phút (timer kill) → `status=FAILED`, dọn file.
- Thành công → `status=READY` + `finalAttachment {url,name,size,mimeType:"video/mp4",posterUrl,duration}`, **xoá raw tmp** (kể cả nhánh lỗi), rồi `emitToUser(uploaderId, "media_ready", {mediaId, attachment})` qua socket (tồn tại trong cùng tiến trình API? Không — worker là tiến trình riêng, nên emit qua Redis pub/sub adapter mỏng của socket.io hoặc HTTP internal call. **Chốt: `@socket.io/redis-adapter` đã không có → dùng kênh phụ: worker `publish` Redis channel `media_ready:<userId>`, API server subscribe và emit socket.** ~20 dòng trong `socket/index.ts`).
- `try/catch` quanh job: job lỗi → BullMQ retry tối đa 2 lần rồi đánh dấu FAILED.
- `ponytail:` restart giữa chừng để job treo PROCESSING — upgrade path: `queue.on('failed')` + `stalled` handling đã đủ cho retry mặc định của BullMQ.

### 4.6 Mở rộng schema tin nhắn

`AttachmentSchema` thêm optional: `posterUrl: z.string().url().optional()`, `duration: z.number().min(0).optional()`. Mongoose `IAttachment` thêm 2 field tương ứng. KHÔNG đổi `type` — video chat vẫn đi `type: "IMAGE"` như sticker (frontend render theo `mimeType`, không theo `type`). Lý do giữ nguyên enum: tránh migration + tránh gãy client cũ.

## 5. Chi tiết Frontend

### 5.1 `MessageInput.tsx`

- Nút `+` (đã có, thay toast placeholder): mở `<input type="file" multiple accept="image/*,video/*">` ẩn qua `ref.click()`.
- Handler chọn tệp → `useMediaUpload` hook mới (`features/chat/hooks/useMediaUpload.ts`) — tách logic theo headless pattern:
  - Ảnh: `POST` → `onSendMessage(content, "IMAGE", [att])`, xoá text input. Nhiều ảnh = nhiều attachment trong MỘT tin nhắn (`max 4`, theo trần UX Discord-lite).
  - Video: `POST` → pending tray.
- **Pending tray** (phía trên khung nhập): thumbnail `<video muted preload="metadata">` từ blob URL local, nhãn "Đang xử lý video…", nút hủy (hủy UI; server tự dọn theo TTL). Gửi video do store tự kích hoạt khi `media_ready` về — text đã gõ lúc upload bị bỏ (video 1 tin nhắn riêng, giống sticker).
- 4 trạng thái UI: loading (progress bar upload), error (toast + nút Thử lại trên tray), empty (ẩn tray), success (ẩn tray, tin nhắn xuất hiện).

### 5.2 `chat.store.ts` + socket

- Action `uploadMedia(file)` trong store (axios `lib/axios.ts` có sẵn, timeout riêng 120s cho video).
- Listener `media_ready` (đã subscribe `new_message`/`typing`...): nhận `{mediaId, attachment}` → `void get().sendMessage(conversationId_of_pending, "", "IMAGE", [attachment])`. `conversationId` của pending lưu trong map `pendingMedia: Map<mediaId, conversationId>`.

### 5.3 `DiscordMessageItem.tsx` (dòng 128)

```tsx
{att.mimeType.startsWith("video/") ? (
  <video controls preload="metadata" poster={att.posterUrl} className="...cùng khung ảnh hiện tại">
    <source src={att.url} type={att.mimeType} />
  </video>
) : ( <img ... /> // giữ nguyên
)}
```
Click ảnh → lightbox mở tabs (đã có ảnh sticker, reused nếu tồn tại; nếu chưa có thì ảnh vẫn mở tab mới — không build lightbox mới trong scope này).

### 5.4 `chat.types.ts`

`MessageAttachment` thêm `posterUrl?: string; duration?: string;` (đồng bộ schema backend).

## 6. Hạ tầng

- `docker-compose.dev.yml` + `docker-compose.yml`: service `redis: {image: redis:7-alpine, ports 6379}`; backend env `REDIS_URL=redis://redis:6379`; prod compose thêm service `worker` (`command: npm run worker:media`, cùng image, dùng chung volume `uploads`).
- `backend/Dockerfile` runner: `apk add --no-cache ffmpeg` (cả build stage để ffprobe có mặt khi dev chạy tsx — ghi chú trong DOCKER.md).
- Package mới duy nhất: `bullmq` (backend). `fluent-ffmpeg` KHÔNG cần — `spawn` trực tiếp đủ, ít dependency.
- `.env.example`: `REDIS_URL`.

## 7. Xử lý lỗi & biên giới bảo mật

| Rủi ro | Biện pháp |
| :--- | :--- |
| Giả mimetype / giả đuôi tệp | magic bytes (§4.2) + sharp decode fail; video không decode được → ffmpeg exit ≠ 0 → FAILED |
| Path traversal qua tên tệp | Server tự sinh tên, `path.basename` khi xóa (pattern `deleteImageByUrl` đã có) |
| Đĩa phình to | TTL 24h doc FAILED/QUEUED; raw tmp bị xoá ngay sau transcode (mọi nhánh); attachment ảnh/video không có cơ chế xoá tự động trong scope này — `ponytail:` bổ sung khi có tính năng thu hồi/xoá tệp |
| User khác đọc mediaId | GET theo uploaderId; socket event chỉ emit cho room của uploader |
| flood upload | rate-limit §4.3 + trần 50MB |
| Video file hỏng/gắn virus | Không scan AV trong scope (không có hạ tầng); chỉ phát cho thành viên cuộc trò chuyện, serve tĩnh không execute |

## 8. Kiểm thử

- **Unit (vitest, không cần Redis/ffmpeg)**: `media-signature` magic bytes (chuỗi bytes thật cho từng loại + chuỗi rác); sanitize tên; logic chọn preset chat.
- **Integration**: `POST /api/chat/uploads` với buffer ảnh thật → 201 + file webp tồn tại; buffer đuôi `.mp4` nội dung rác → 400 `INVALID_MEDIA_TYPE`; vượt 50MB → 400. (multipart dựng bằng supertest form-data.)
- **E2E manual (cần Redis + ffmpeg)**: upload mp4 → xem log worker → tin nhắn video hiện ở cả 2 client → seek được (Range).
- **Self-check chạy được**: `backend/src/utils/media-signature.ts` kèm block `assert` nhỏ hoặc 1 file `*.test.ts` duy nhất.

## 9. Thứ tự triển khai (mỗi bước self-contained)

1. `media-signature` + preset `chat` + endpoint ảnh (201) + frontend nút `+` cho **riêng ảnh** → ship được giá trị sớm nhất.
2. Render `<video>` + mở rộng `AttachmentSchema`/model (posterUrl, duration).
3. Redis + BullMQ + MediaAsset + worker + `media_ready` + pending tray frontend (video full pipeline).
4. Dockerfile/compose/README cập nhật + rate-limit + QA error paths.
