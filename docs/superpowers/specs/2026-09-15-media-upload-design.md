# Design Spec: Media Upload (Ảnh + Video + File) qua Cloudinary

> **Ngày**: 2026-09-15 · **Trạng thái**: Chờ duyệt · **Phân loại**: Architectural
> **Người dùng**: `sonsee204` · **Quyết định đã chốt**: Full scope (ảnh + video + file) · Signed direct upload · Giới hạn tiêu chuẩn

---

## 1. Bối cảnh & Mục tiêu

Nút "+" đính kèm trong `MessageInput` hiện chỉ là placeholder `toast.info`
(`frontend/src/features/chat/components/MessageInput.tsx:123-136`). Hệ thống đã có
nền tảng sẵn: schema `Message.attachments[]` (BE + FE), Zod `SendMessageSchema` chấp nhận
attachments, và REST `POST /api/conversations/:id/messages`.

**Mục tiêu**: Cho phép người dùng tải ảnh, video và tệp đính kèm lên Cloudinary trong
cuộc trò chuyện, hiển thị preview trước khi gửi và render đa phương tiện trong bubble tin nhắn.

**Out-of-scope (không làm đợt này)**:
- Chỉnh sửa/nén media phía client (compress video, crop ảnh).
- Xoá/thu hồi media độc lập với tin nhắn (recall message đã có, kế thừa behaviour cũ).
- GIF kho tích hợp (Giphy/Tenor) — nút GIF giữ nguyên placeholder.
- Upload many-file trong 1 tin nhắn vượt quá 10 tệp.

---

## 2. Kiến trúc tổng thể

### 2.1 Luồng Signed Direct Upload

```
User chọn file (input[type=file] kéo-thả)
  → FE MediaPreview: validate MIME + size theo bảng giới hạn (§3)
  → FE gọi POST /api/uploads/sign { resourceType, folder }   (REST, auth guard)
  → BE ký: signature = SHA1(sorted params + API_SECRET)      (không lộ secret)
  → FE upload THẲNG lên Cloudinary (cloudinary-js / XHR) với signed params,
     hiển thị progress % thật từ XHR upload_progress
  → Cloudinary trả { secure_url, thumbnail_url?, public_id }
  → FE gom attachments[] → gửi message qua REST sẵn có (không đổi hợp đồng)
```

**Video/file lớn không đi qua backend** → không timeout, không cháy RAM, không tốn
egress server. Backend vẫn kiểm soát được `folder`, `resource_type`, hạn mức qua signature.

### 2.2 Quyết định đã trade-off

| Quyết định | Phương án chọn | Lý do loại phương án khác |
|---|---|---|
| Đường upload | **Signed direct** | Relay-qua-backend timeout/cháy RAM với video 50MB; unsigned preset không kiểm soát được folder → lộ endpoint công khai. |
| Storage | **Cloudinary** | Local disk không scale + backend hiện chỉ có image pipeline (sharp, 5MB); S3/R2 cần tự dựng video transcode + poster. |
| Gửi message | **REST như hiện tại** | Socket `send_message` không truyền attachments; đổi sang socket emit là refactor realtime không cần thiết cho tính năng này. |

---

## 3. Giới hạn & Phân loại

| Loại | MIME cho phép | Max size | resource_type | Ghi chú |
|---|---|---|---|---|
| Ảnh | `image/jpeg,png,webp,gif` | **10MB** | `image` | Cloudinary auto-optimize (`fetch_format`, `quality: auto`) |
| Video | `video/mp4,webm,quicktime` | **50MB** | `video` | Tự sinh poster frame `thumbnail_url` |
| Tệp | `pdf, doc(x), xls(x), ppt(x), zip, rar, 7z, txt, csv` | **25MB** | `raw` | Render dạng card tải xuống |

- **Giới hạn số tệp/tin nhắn**: tối đa **10** attachments.
- **Giới hạn vùng chứa**: validate client-side + **server-side lại một lần nữa** trong
  `/api/uploads/sign` (Zero-Trust, chặn gọi thẳng API).
- File không đúng whitelist MIME → toast lỗi, không cho vào queue.

---

## 4. Backend (kiến trúc 3 tầng — `backend.md` §1)

### 4.1 Tầng Repository/Config

**Mới — `src/config/cloudinary.ts`**:
```ts
// Đọc biến môi trường Cloudinary, khởi tạo cloudinary.config một lần duy nhất.
// Cấm hardcode API_SECRET; thiếu env → app fail-fast lúc boot.
export const CLOUDINARY = { cloudName, apiKey, apiSecret };
```

**Env mới** (khai trong `backend/.env.example`): `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

### 4.2 Tầng Service

**Mới — `src/services/upload.service.ts`**:

| Hàm | Chữ ký | Mô tả nghiệp vụ |
|---|---|---|
| `signUpload` | `(userId: string, dto: SignUploadDTO) => SignedParams` | Kiểm tra user nằm trong **`participants`** của conversation (field `conversation.participants`, truy 1 lần, không N+1) → sinh `{ timestamp, folder, resource_type, max_file_size, access_mode:'public', signature }`. |

- Signature: Cloudinary signing string = `folder=...&resource_type=...&timestamp=...` + `API_SECRET`, SHA-1.
- `max_file_size` (bytes) nhúng vào signature → **Cloudinary từ chối quá cỡ ở tầng storage**,
  FE bypass cũng không upload được.
- Folder whitelist: chỉ khớp regex `^chat/[a-f0-9]{24}$` (conversationId MongoDB ObjectId).
  Thư mục avatar/banner cũ không đụng tới.

### 4.3 Tầng Controller + Routes

**Mới — `src/controllers/upload.controller.ts`** + `src/routes/upload.routes.ts`:

```
POST /api/uploads/sign           [requireAuth, validate(SignUploadSchema)]
  body:   { resourceType: 'image'|'video'|'raw', folder: 'chat/<ObjectId>' }
  200 OK: { success: true, data: { cloudName, apiKey, timestamp, folder,
                                   resourceType, maxFileSize, signature } }
  400 VALIDATION_ERROR  ·  403 FORBIDDEN (không phải thành viên conv)
```

- **Không có endpoint "xác nhận upload"**: message send đã là bước ghi nhận final
  (`SendMessageSchema` validate url/name/size/mimeType mỗi attachment). Orphan file trên
  Cloudinary chấp nhận được (không có DB record) — xử lý bằng retention rule sau này.

### 4.4 Schema (Zod — Zero-Trust)

**Mới — `src/schemas/upload.schema.ts`**:
```ts
export const SignUploadSchema = z.object({
  resourceType: z.enum(['image', 'video', 'raw']),
  folder: z.string().regex(/^chat\/[a-f0-9]{24}$/),
}).strict();   // .strict() chặn Mass Assignment fields lạ
```

### 4.5 Model — thay đổi tối thiểu

`backend/src/models/message.model.ts` — thêm field optional vào `IAttachment`:
- `thumbnailUrl?: string` — poster frame video (Cloudinary trả `thumbnail_url`).
- `publicId?: string` — để xoá file về sau (nullable, không bắt buộc ở đợt 1).
- `size`/`mimeType` giữ nguyên. **Không cần migration** (field optional, Mongo schemaless).

`SendMessageSchema` attachments[]: thêm `thumbnailUrl: z.string().url().optional()`,
`publicId: z.string().optional()`. Bỏ trần 5MB cũ nếu có validate size ở schema.

---

## 5. Frontend (Atomic Design + Headless — `frontend.md` §1-2)

### 5.1 Types

`frontend/src/types/chat.types.ts` — mở rộng `MessageAttachment`:
```ts
export interface MessageAttachment {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;   // poster frame video (Cloudinary)
  publicId?: string;       // định danh file trên Cloudinary
}
```

### 5.2 Headless logic — Hook `useMediaUpload`

**Mới — `frontend/src/features/chat/hooks/useMediaUpload.ts`** (toàn bộ logic, không nằm trong JSX):

```ts
interface UseMediaUploadResult {
  items: UploadItem[];                                  // queue hiển thị
  pickFiles(files: FileList): void;                     // validate MIME + size + limit 10
  removeItem(id: string): void;                         // cancel trước/sau khi xong
  uploadAll(): Promise<MessageAttachment[]>;            // sign → upload → trả attachments
  clear(): void;                                        // reset sau khi gửi thành công
  isUploading: boolean;
}
interface UploadItem {
  id: string; file: File;
  status: 'queued' | 'uploading' | 'done' | 'error';
  progress: 0-100;
  attachment?: MessageAttachment;
  error?: string;
}
```

- Upload qua `XMLHttpRequest` (không dùng `fetch`) để lấy `upload.onprogress` % thật.
- Endpoint base Cloudinary: `https://api.cloudinary.com/v1_1/{cloudName}/{resourceType}/upload`.
- Không có API key/secret nào nằm trong FE bundle — FE chỉ giữ signed params.

### 5.3 Atoms/Molecules/Organisms

| Tầng | Component | Vai trò |
|---|---|---|
| atoms | `MediaPreviewChip` (`components/atoms/MediaPreviewChip.tsx`) | Thumbnail nhỏ 1 tệp + progress ring + nút ✕ |
| molecules | `MediaPreviewBar` (`components/MediaPreviewBar.tsx`) | Dãy chips phía trên input, scroll ngang |
| organisms | `AttachmentRenderer` (`components/AttachmentRenderer.tsx`) | Render attachments trong bubble tin nhắn (xem §5.4) |

### 5.4 `AttachmentRenderer` — 4 UI states (`frontend.md` §4)

- **Ảnh**: grid ≤4 ảnh (1 hàng/2×2 như Discord), click mở **`LightboxModal`** (fullscreen,
  chuyển ảnh bằng phím ←/→, đóng Esc). `loading="lazy"`, skeleton trong lúc tải.
- **Video**: thẻ `<video controls poster={thumbnailUrl}>` bo góc, duration badge; click fullscreen.
- **File**: card `Tên · dung lượng · icon theo phần mở rộng` → nút tải xuống (`download` attr).
- **Empty**: không render gì khi `attachments` rỗng.
- **Error**: ảnh/video lỗi tải → placeholder "Không tải được tệp" + nút Thử lại.

`DiscordMessageItem.tsx` hiện render `<img>` 32×32 cứng (`:128-140`) → **thay bằng
`<AttachmentRenderer attachments={...} />`**. `MessageBubble.tsx` xác nhận có dùng cho
luồng hiển thị nào không trong lúc khảo sát implementation plan; nếu có thì dùng cùng component.

### 5.5 Sửa `MessageInput.tsx`

- Nút `+` → mở `<input type="file" multiple accept=...>` ẩn (giữ `aria-label` cũ).
- Hỗ trợ **kéo-thả file vào vùng chat** (`onDragOver/onDrop` trên message area của `ChatLayout`
  → cùng `pickFiles`).
- Có `items.length > 0` → hiện `MediaPreviewBar` phía trên khung input (input container
  chuyển từ hàng dọc cố định 84px sang cột khi có preview; giữ style Tactile Neo-Brutalist
  `border-uupm-line`, `rounded-xs`, `shadow-uupm-active`).
- Bấm **Gửi**: `uploadAll()` → merge `attachments` vào payload hiện có
  (`onSendMessage(content, type, attachments)`); disable nút khi `isUploading`.
- **Mixed content**: cho phép text + attachments trong cùng tin nhắn (`type` suy ra:
  toàn ảnh → `IMAGE`, có tệp/video → `FILE`, không có gì → `TEXT`). Sticker flow cũ giữ nguyên.
- Lỗi upload → `toast.error` + item đỏ trong preview bar, không chặn các item khác.

### 5.6 Dependency mới

- FE: `cloudinary-core` (hoặc gọi thẳng REST endpoint bằng XHR — không cần SDK;
  chốt phương án **không thêm package**, dùng XHR thô).
- BE: `cloudinary` (npm).

---

## 6. Data Flow tổng hợp

```
[MessageInput +]→ file picker → useMediaUpload.pickFiles (validate FE)
    → MediaPreviewBar (queued chips)
    → Gửi? → useMediaUpload.uploadAll
        → POST /api/uploads/sign (BE check participants → signature)
        → XHR → Cloudinary (progress %) → { secure_url, thumbnail_url, public_id }
    → onSendMessage(content, type, attachments)
        → chat.store.sendMessage (REST, sẵn có)
        → BE MessageService.sendMessage: validate attachments[] + transaction
          (message + conversation.lastMessage) → 201/200
        → socket 'new_message' room → đối phương render qua AttachmentRenderer
```

**Transaction DB**: không phát sinh bảng mới → giữ nguyên transaction `sendMessage` hiện tại
(`message.service.ts:102-178`).

---

## 7. Test Gate (nghiệm thu đo được)

**Backend**
- [ ] `POST /api/uploads/sign` trả 200 + đúng 7 field signed params khi hợp lệ (curl checklist).
- [ ] Folder không khớp `^chat/oid$` → 400; không phải thành viên → 403; token thiếu → 401.
- [ ] `resourceType: 'exe'` → 400.
- [ ] Upload video >50MB bị Cloudinary chặn bằng `max_file_size` đã ký (400 từ Cloudinary).

**Frontend**
- [ ] Chọn 11 file → toast báo vượt limit, queue dừng ở 10.
- [ ] Chọn `.exe` → bị loại ở FE validate, không gọi sign.
- [ ] Upload ảnh thật → progress tăng 0→100 → message hiển thị grid ảnh, click mở Lightbox.
- [ ] Gửi tin nhắn video → đối phương (tab khác) nhận `new_message`, thấy poster + play được.
- [ ] Gửi `.pdf` kèm text → message `type=FILE`, card download tải đúng file.
- [ ] `tsc --noEmit` sạch cả FE + BE; `npm run build` pass.

**Contract FE↔BE**
- [ ] Attachment object FE build ra khớp `SendMessageSchema.attachments` từng field
      (`url,name,size,mimeType,thumbnailUrl?,publicId?`).

---

## 8. Rủi ro & Phương án lùi

| Rủi ro | Giảm thiểu |
|---|---|
| **XSS qua SVG/HTML file** | Không cho upload SVG; raw files chỉ render card download, không iframe/preview. |
| **Orphan files trên Cloudinary** (upload xong nhưng không gửi message) | Chấp nhận ở đợt 1; về sau: Cloudinary retention rule hoặc job đối chiếu `public_id` với DB. |
| **Signature replay** (timestamp dùng lại) | `timestamp`有效期 1h mặc định Cloudinary; folder đã khoá sẵn trong signature → không dùng lại được cho conv khác. |
| **Leak API secret** | Secret **chỉ** nằm backend; FE không có package `cloudinary` server-side; review `.env` không commit. |
| **Video lớn làm nghẽn XHR trên mạng yếu** | Abort qua nút ✕ (hủy request), toast + retry. |
| **Rollback** | Tính năng tách endpoint + hook mới hoàn toàn; revert = ẩn nút `+` (giữ nguyên toast cũ), message schema tương thích ngược (2 field optional). |

---

## 9. Giả định (assumptions)

1. Bạn sẽ tạo Cloudinary account + cung cấp `CLOUDINARY_*` env values (free tier đủ dùng).
2. Conversation hiện chỉ có DIRECT 1-1 và GROUP; membership check dùng `conversation.participants` (field `participants: Types.ObjectId[]` trong model, **không phải** `members`).
3. Recall message (`isDeleted`) chưa cần xoá file vật lý trên Cloudinary.
4. Không yêu cầu upload khi offline / resume upload.
5. Dark/light theme hiện tại (`uupm-*` tokens) áp dụng cho mọi component mới.
