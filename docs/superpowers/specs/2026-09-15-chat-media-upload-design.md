# Thiết kế: Upload Ảnh / Video / File cho Chat

> **Ngày**: 2026-09-15
> **Tác giả**: Claude (deep-architect dispatch)
> **Phạm vi**: Tính năng đính kèm media (ảnh, video, tệp) vào tin nhắn chat.
> **Trạng thái**: Draft — chờ user review.

---

## 1. Tổng quan & Quyết định đã chốt

Dựa trên phân tích hiện trạng và 4 câu hỏi đã thống nhất với user:

| Quyết định | Lựa chọn |
| :--- | :--- |
| Loại media hỗ trợ | **Ảnh + Video + File** (pdf/doc/docx) |
| Nơi lưu trữ | **Local disk + trừu tượng hoá** (interface `StorageProvider`, MVP dùng local, sau này đổi S3 không động code gọi) |
| Xử lý video thumbnail | **Backend tự cắt qua ffmpeg** (cài `fluent-ffmpeg` + `ffmpeg-static`) |
| Dependency mới | Được phép thêm `fluent-ffmpeg`, `ffmpeg-static`, `@types/fluent-ffmpeg` (sẽ hỏi xác nhận trước khi `npm install`) |

### Hiện trạng tái sử dụng (đã có sẵn)
- `backend/src/config/upload.ts`: `UPLOAD_DIR`, `UPLOAD_URL_PREFIX`, `MAX_FILE_SIZE`, `ALLOWED_MIME`, `IMAGE_PRESETS`, `ImageKind`
- `backend/src/middlewares/upload.ts`: multer `memoryStorage`, `files: 1`, filter theo `ALLOWED_MIME`
- `backend/src/utils/image-storage.ts`: `saveImage()` (sharp resize→webp), `deleteImageByUrl()`
- `backend/src/app.ts`: `express.static(UPLOAD_DIR)` mount tại `/api/uploads` (có CORP cross-origin)
- `frontend/src/features/chat/components/StickerPicker.tsx`: mẫu pattern Radix Popover chuẩn UI
- `frontend MessageInput.tsx`: nút `+` hiện đang `toast.info` — cần gắn flow mới
- `Message` type & `AttachmentSchema` đã hỗ trợ `attachments[]` và `type: IMAGE | FILE`

### Hợp đồng dữ liệu không đổi
- `MessageAttachment { url, name, size, mimeType }` — frontend
- `SendMessageSchema` đã cho phép `attachments[]` + `content` rỗng khi có attachment → **không cần sửa schema gửi tin nhắn**

---

## 2. Kiến trúc luồng (Flow)

### 2.1 Upload flow (2 bước, tách biệt gửi tin nhắn)
```
[Client] chọn file(s) → preview cục bộ
   ↓ (nhấn Gửi)
[Client] POST /api/upload/chat (multipart, files[])
   ↓
[Backend] upload.multiple() → với mỗi file:
   - image/*    → sharp resize→webp → lưu → url
   - video/*    → lưu nguyên → url → ffmpeg cắt frame @1s → thumbnail webp → thumbnailUrl
   - file/*     → lưu nguyên → url
   ↓
[Backend] trả Array<{ url, name, size, mimeType, thumbnailUrl? }>
   ↓
[Client] gọi sendMessage(conversationId, content, type, attachments)
```

**Tại sao tách 2 bước?** Cho phép validate kích thước/file ở client trước khi tốn băng thông, và giữ `SendMessageSchema` nguyên (không cần đưa binary vào payload JSON). Tương tự pattern upload avatar/banner hiện tại (upload trước, lưu URL).

### 2.2 Tại sao thumbnail ở backend (ffmpeg) thay vì client canvas
User chọn option thêm FFmpeg. Ưu điểm: URL ảnh/video + thumbnail đồng bộ sinh cùng lúc, client không cần logic capture, và thumbnail nhất quán (luôn frame @1s). Nhược điểm: tăng CPU server, cần binary ffmpeg (dùng `ffmpeg-static` đóng gói sẵn, không cài hệ thống).

---

## 3. Tầng Backend

### 3.1 `config/upload.ts` — mở rộng
> **Không đụng `MAX_FILE_SIZE` cũ (5MB)**: biến này đang được middleware `upload` dùng cho avatar/banner. Giữ nguyên để không đổi hành vi luồng cũ; thêm trần riêng cho media chat.
```typescript
// Trần dung lượng riêng cho media chat (bytes)
export const CHAT_IMAGE_MAX_SIZE = 10 * 1024 * 1024;   // 10MB ảnh
export const CHAT_VIDEO_MAX_SIZE = 50 * 1024 * 1024;   // 50MB video
export const CHAT_FILE_MAX_SIZE  = 20 * 1024 * 1024;   // 20MB file

// Mở rộng danh sách MIME chấp nhận cho chat
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm"];
export const ALLOWED_FILE_MIME  = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Thêm preset xử lý ảnh chat (giữ tỉ lệ, resize max 1920)
IMAGE_PRESETS.chatImage = { width: 1920, height: 1920, fit: "inside" };
// Thêm preset thumbnail video (cắt vuông 320)
IMAGE_PRESETS.videoThumb = { width: 320, height: 320, fit: "cover" };
```
> **Ngoại lệ GIF**: `image/gif` lưu **nguyên bản, không qua sharp** — sharp convert webp sẽ làm mất animation. Chỉ jpeg/png/webp mới resize→webp.

### 3.2 `utils/storage.ts` — trừu tượng hoá Storage (MỚI)
```typescript
export interface StorageProvider {
  // Lưu buffer vào đích, trả về public URL chuẩn hoá
  save(buffer: Buffer, fileName: string): Promise<string>;
  // Xoá theo public URL (an toàn, chỉ xoá file thuộc UPLOAD_DIR)
  delete(url: string): Promise<void>;
}

// MVP: lưu local disk, tái dùng logic cũ của image-storage
export class LocalDiskStorage implements StorageProvider {
  async save(buffer, fileName) { /* fs.mkdir + writeFile + trả `${UPLOAD_URL_PREFIX}/${fileName}` */ }
  async delete(url) { /* path.basename + unlink, không ném lỗi */ }
}
export const storage: StorageProvider = new LocalDiskStorage();
```
`image-storage.ts` refactor: tách hàm `processImageToWebp(buffer, preset)` (chỉ xử lý sharp) và dùng `storage.save()` thay vì tự writeFile. `deleteImageByUrl` chuyển thành `storage.delete`.

### 3.3 `utils/media-storage.ts` — xử lý media chat (MỚI)
```typescript
// Lưu 1 file media tuỳ loại, trả về attachment + optional thumbnailUrl
export async function saveChatMedia(
  file: Express.Multer.File,
  userId: string
): Promise<{ url: string; name: string; size: number; mimeType: string; thumbnailUrl?: string }>
```
- `image/*`: `processImageToWebp(buffer, "chatImage")` → `storage.save()`
- `video/*`: `storage.save()` nguyên bản → `generateVideoThumbnail(buffer)` (ffmpeg) → `processImageToWebp(thumb, "videoThumb")` → `storage.save()`
- `file/*`: `storage.save()` nguyên bản (giữ đuôi gốc, không convert)

### 3.4 `utils/video-thumbnail.ts` (MỚI)
```typescript
// Dùng fluent-ffmpeg + ffmpeg-static. Cắt frame tại 1s → buffer webp.
// Nếu ffmpeg lỗi (file hỏng) → throw ValidationError, không sinh thumbnail.
export async function generateVideoThumbnail(buffer: Buffer): Promise<Buffer>
```
- Gọi `ffmpeg.setFfmpegPath(ffmpegStatic)` một lần lúc import.
- Timeout 15s, pipe buffer → `-ss 00:00:01 -frames:v 1` → webp.

### 3.5 `middlewares/upload.ts` — mở rộng
Thêm export `uploadChatMedia = multer({ storage: memoryStorage, limits: { fileSize: CHAT_VIDEO_MAX_SIZE, files: 10 }, fileFilter })` với `fileFilter` kiểm mime thuộc `ALLOWED_IMAGE_MIME ∪ ALLOWED_VIDEO_MIME ∪ ALLOWED_FILE_MIME`, đồng thời áp trần dung lượng theo loại (ảnh 10MB / video 50MB / file 20MB — check trong `fileFilter` qua `file.mimetype` kết hợp kích thước khai báo, và re-check `file.size` trong controller sau khi multer nhận).

### 3.6 `schemas/upload.schema.ts` (MỚI) + `routes/upload.routes.ts` (MỚI)
`UploadChatSchema` chỉ validate metadata JSON đi kèm (không đọc file): `conversationId` optional (ObjectId regex — để kiểm thành viên sớm nếu cần), và trường `expectCount` optional. Giữ pattern như avatar/banner: route upload **không** chạy validate bắt buộc trên body rỗng.
```typescript
router.use(requireAuth);
router.post(
  "/chat",
  uploadChatMedia.array("files", 10),
  validate(UploadChatSchema),
  uploadController.uploadChat
);
```

### 3.7 `controllers/upload.controller.ts` (MỚI)
- Lấy `req.files` (array), gọi `saveChatMedia` cho từng file (song song `Promise.all`, không lặp tuần tự — tránh N+1).
- Trả `201 Created` + `data: Attachment[]` (có thêm `thumbnailUrl` tuỳ chọn).
- Bắt lỗi per-file: nếu 1 file lỗi, xoá các file đã lưu (rollback) rồi trả `400`.

### 3.8 `routes/index.ts` — đăng ký
```typescript
apiRouter.use("/upload", uploadRoutes);  // → /api/upload/chat
```

### 3.9 `docs/openapi.ts` — cập nhật
Thêm schema `UploadChatResponse` (dùng `@asteasolutions/zod-to-openapi` như các schema khác).

---

## 4. Tầng Frontend

### 4.1 `types/chat.types.ts`
Bổ sung optional field vào `MessageAttachment`:
```typescript
export interface MessageAttachment {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;  // thumbnail video do backend sinh
}
```

### 4.2 `services/chat.service.ts`
Thêm method:
```typescript
async uploadFiles(files: File[]): Promise<MessageAttachment[]> {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  const res = await apiClient.post<ApiResponse<MessageAttachment[]>>("/upload/chat", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data!;
}
```

### 4.3 `stores/chat.store.ts`
- State mới: `pendingFiles: File[]`, `isUploading: boolean`.
- `sendMessage(conversationId, content, type?, attachments?, files?)`:
  - Nếu `files?.length` → `await chatService.uploadFiles(files)` → gộp vào `attachments`.
  - Xác định `type = attachments.some(a => video)? "IMAGE" : (file? "FILE" : "IMAGE")` (DiscordMessageItem phân biệt bằng mimeType, giữ type IMAGE cho media).
  - Gọi API gửi tin nhắn hiện tại.
- Reset `pendingFiles` sau gửi.

### 4.4 Components (MỚI + sửa)

**`components/molecules/FileUploadButton.tsx`** (thay thế nút `+` toast):
- Bọc `<input type="file" multiple accept="image/*,video/mp4,video/webm,.pdf,.doc,.docx" hidden>`.
- `onChange` → đẩy file vào `chatStore.pendingFiles`.

**`components/molecules/MediaPreviewBar.tsx`**:
- Hiển thị danh sách `pendingFiles` phía trên MessageInput (ảnh: object-cover thumbnail; video: `<video>` frame đầu; file: icon + tên + size).
- Mỗi item có nút xoá (gỡ khỏi `pendingFiles`).
- Xử lý 4 UI states: loading preview, empty (ẩn bar), error (file quá lớn → toast), success.

**`components/molecules/MediaMessage.tsx`** (render attachment trong DiscordMessageItem):
- `image/*` → `<img>` responsive, click mở lightbox (dùng Radix Dialog như pattern StickerPicker).
- `video/*` → `<video controls poster={thumbnailUrl}>` responsive.
- `file/*` → file card (icon loại file + tên + size + nút tải xuống).

**Sửa `DiscordMessageItem.tsx`**: block render attachments hiện tại (128px sticker) thay bằng `<MediaMessage attachments={message.attachments} />` phân loại theo mimeType. Giữ nguyên sticker (webp không nền từ Klipy) hiển thị riêng nếu `type==="IMAGE" && không có content && mimeType webp & tên chứa "sticker"` — hoặc đơn giản: sticker là attachment webp nền trong suốt, ảnh chat là attachment image bình thường; phân biệt bằng `mimeType.startsWith("image/")` + kích thước. **Quyết định**: sticker giữ render như cũ (128px contain, không bong bóng); ảnh chat dùng MediaMessage. Phân biệt bằng flag: tin nhắn sticker có `content===""` và `attachments.length===1` webp.

**Sửa `MessageInput.tsx`**: thay nút `+` toast bằng `<FileUploadButton>` + render `<MediaPreviewBar>` ngay trên textarea. Nút Gửi enabled khi `content.trim() || pendingFiles.length`.

### 4.5 Accessibility (theo frontend.md)
- `FileUploadButton`: `aria-label="Tải lên tệp hoặc ảnh"`, focus-visible ring.
- `MediaPreviewBar` items: `aria-label` mô tả file + nút xoá `aria-label="Xoá tệp {name}"`.
- Lightbox: Radix Dialog có sẵn focus trap + Esc.

---

## 5. Xử lý lỗi & Boundary

| Trường hợp | Xử lý |
| :--- | :--- |
| File vượt trần (multer) | `fileFilter` từ chối sớm → `400 ValidationError` |
| Ảnh giả mimetype (không decode được) | sharp ném lỗi → `400 "Tệp không phải ảnh hợp lệ"` |
| Video hỏng (ffmpeg lỗi) | `ValidationError`, xoá các file đã lưu (rollback) |
| Upload thất bại giữa chừng | `Promise.all` bắt lỗi → xoá file đã save → `400` |
| Lỗi serve file | `express.static` 404, frontend fallback icon |
| Thu hồi tin nhắn có media | Giữ nguyên logic `isDeleted` (URL vẫn tồn tại trên disk; không xoá file để tránh mất data lịch sử — ghi chú để sau) |

---

## 6. Phân trang & Hiệu năng
- Upload tối đa 10 file/lần (multer `files: 10`).
- Ảnh chat resize max 1920px → webp (giảm dung lượng truyền).
- `loading="lazy"` cho `<img>` trong lịch sử (đã có trong DiscordMessageItem).
- Video không autoplay, `controls` + `preload="metadata"`.

---

## 7. Kế hoạch triển khai (tóm tắt, chi tiết ở writing-plans)

1. Backend config + storage abstraction (`config/upload.ts`, `utils/storage.ts`)
2. Backend video thumbnail + media storage (`video-thumbnail.ts`, `media-storage.ts`)
3. Backend upload route + controller + middleware (`upload.routes.ts`, `upload.controller.ts`, `upload.ts`)
4. Backend wiring (`routes/index.ts`, `openapi.ts`)
5. Frontend types + service (`chat.types.ts`, `chat.service.ts`)
6. Frontend store (`chat.store.ts`)
7. Frontend components (`FileUploadButton`, `MediaPreviewBar`, `MediaMessage`)
8. Frontend wiring (`MessageInput.tsx`, `DiscordMessageItem.tsx`)
9. Cài dependencies (`fluent-ffmpeg`, `ffmpeg-static`, `@types/fluent-ffmpeg`) — hỏi user trước
10. Test: unit (media-storage, video-thumbnail), integration (upload route), type-check cả 2 project

---

## 8. Rủi ro & Chưa rõ

- **ffmpeg-static binary**: trên Windows build có thể cần native binary; `ffmpeg-static` thường đóng gói sẵn cho win32-x64. Cần verify sau install.
- **Sticker vs Ảnh chat phân biệt**: cần quy ước rõ (dùng `content==="" && webp` làm sticker). Sẽ tinh chỉnh ở bước implement.
- **Xoá file khi thu hồi**: MVP chưa xoá file vật lý khi thu hồi tin nhắn (tránh mất data). Có thể bổ sung cleanup job sau.
- **CSRF**: upload route dùng `csrfOriginGuard` (origin check) — client cùng origin nên pass. Multipart không dùng cookie CSRF token, phù hợp thiết kế hiện tại.
