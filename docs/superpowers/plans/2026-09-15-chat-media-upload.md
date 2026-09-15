# Chat Media Upload (Ảnh/Video/File) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this codebase task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép người dùng đính kèm ảnh, video và file (pdf/doc) vào tin nhắn chat, hiển thị preview khi soạn và render đúng loại media trong dòng tin nhắn.

**Architecture:** Flow 2 bước — client upload file lên `POST /api/upload/chat` (multer memoryStorage → sharp resize ảnh / ffmpeg cắt thumbnail video → lưu disk qua interface `StorageProvider`), nhận về danh sách `attachments[]`, rồi gửi tin nhắn qua API `POST /conversations/:id/messages` hiện có (schema không đổi). Frontend: store giữ `pendingFiles`, MessageInput render `MediaPreviewBar`, DiscordMessageItem render `MediaMessage` phân loại theo mimeType.

**Tech Stack:** Express + TypeScript + Multer + Sharp + fluent-ffmpeg/ffmpeg-static + Mongoose + Socket.IO (backend, vitest); React + TypeScript + Zustand + Radix UI + Tailwind (frontend).

**Spec:** `docs/superpowers/specs/2026-09-15-chat-media-upload-design.md`

## Global Constraints

- KHÔNG dùng `EnterWorktree` (cấm theo `.claude/rules/task-routing.md` §7). Làm việc trên branch `feat/chat-media-upload` tạo từ `main` của repo tại `D:\appmessaging`.
- Mọi code sinh mới bắt buộc có chú thích Tiếng Việt (CLAUDE.md — không được cắt comment để tiết kiệm token).
- Không phỏng đoán package: dependencies mới CHỈ thêm đúng danh sách đã duyệt: `fluent-ffmpeg`, `ffmpeg-static`, `@types/fluent-ffmpeg`.
- Không đổi hành vi luồng upload cũ: `MAX_FILE_SIZE` (5MB) và middleware `upload` hiện tại (avatar/banner) giữ nguyên.
- Ảnh GIF chat lưu NGUYÊN BẢN (không qua sharp — mất animation).
- Frontend không hardcode mã màu; chỉ dùng tokens `uupm-*` hiện có.
- Verification mỗi task: backend `npm run type-check` + `npm test`; frontend `npx tsc --noEmit`.

---

## Task 0: Khởi tạo branch

**Files:**
- Không sửa file — chỉ tạo branch.

- [ ] **Step 1: Tạo branch từ main**

```bash
git checkout -b feat/chat-media-upload
```

- [ ] **Step 2: Commit docs đã có (spec)**

```bash
git add docs/superpowers/specs/2026-09-15-chat-media-upload-design.md
git commit -m "docs(chat): add media upload design spec"
```

---

## Task 1: Cài dependencies video thumbnail (backend)

**Files:**
- Modify: `backend/package.json` (qua npm)

**Interfaces:**
- Produces: module `fluent-ffmpeg` (hàm `ffmpeg`), `ffmpeg-static` (export đường dẫn binary) khả dụng cho Task 3.

- [ ] **Step 1: Xác nhận với user rồi cài (user đã duyệt thêm FFmpeg)**

```bash
cd backend && npm install fluent-ffmpeg ffmpeg-static && npm install -D @types/fluent-ffmpeg
```

- [ ] **Step 2: Verify binary ffmpeg chạy được trên Windows**

```bash
node -e "const p=require('ffmpeg-static'); const {execFileSync}=require('child_process'); console.log(execFileSync(p,['-version']).toString().split('\n')[0])"
```
Expected: in ra dòng `ffmpeg version ...`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(backend): add fluent-ffmpeg and ffmpeg-static for video thumbnails"
```

---

## Task 2: Mở rộng config upload + StorageProvider abstraction

**Files:**
- Modify: `backend/src/config/upload.ts`
- Create: `backend/src/utils/storage.ts`
- Test: `backend/src/utils/__tests__/storage.test.ts`

**Interfaces:**
- Produces:
  - `CHAT_IMAGE_MAX_SIZE: number`, `CHAT_VIDEO_MAX_SIZE: number`, `CHAT_FILE_MAX_SIZE: number`
  - `ALLOWED_IMAGE_MIME`, `ALLOWED_VIDEO_MIME`, `ALLOWED_FILE_MIME`: `readonly string[]`
  - `IMAGE_PRESETS.chatImage = { width: 1920, height: 1920, fit: "inside" }`, `IMAGE_PRESETS.videoThumb = { width: 320, height: 320, fit: "cover" }` (type `ImageKind` tự mở rộng qua `keyof typeof`)
  - `interface StorageProvider { save(buffer: Buffer, fileName: string): Promise<string>; delete(url: string): Promise<void> }`
  - `class LocalDiskStorage implements StorageProvider`, singleton `export const storage: StorageProvider`

- [ ] **Step 1: Viết failing test cho LocalDiskStorage**

Tạo `backend/src/utils/__tests__/storage.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Trỏ UPLOAD_DIR sang thư mục tạm TRƯỚC khi import module config (module đọc env lúc import)
const tmpDir = path.join(os.tmpdir(), `upl-test-${Date.now()}`);
process.env.UPLOAD_DIR = tmpDir;

import { LocalDiskStorage } from "../storage";
import { UPLOAD_URL_PREFIX } from "../../config/upload";

describe("LocalDiskStorage", () => {
  const storage = new LocalDiskStorage();

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });
  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("save() ghi tệp và trả URL công khai có tiền tố /api/uploads", async () => {
    const url = await storage.save(Buffer.from("hello"), "test-hello.txt");
    expect(url).toBe(`${UPLOAD_URL_PREFIX}/test-hello.txt`);
    const onDisk = await fs.readFile(path.join(tmpDir, "test-hello.txt"), "utf8");
    expect(onDisk).toBe("hello");
  });

  it("delete() xoá tệp thuộc UPLOAD_DIR và không ném lỗi với URL ngoài hệ thống", async () => {
    await storage.save(Buffer.from("x"), "test-del.txt");
    await storage.delete(`${UPLOAD_URL_PREFIX}/test-del.txt`);
    await expect(fs.access(path.join(tmpDir, "test-del.txt"))).rejects.toThrow();
    // URL lạ (không phải của hệ thống) -> bỏ qua, không ném lỗi
    await storage.delete("https://evil.example.com/../secret");
    await storage.delete(null as unknown as string);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận FAIL**

Run: `cd backend && npx vitest run src/utils/__tests__/storage.test.ts`
Expected: FAIL — `Cannot find module '../storage'`

- [ ] **Step 3: Thêm constants vào `config/upload.ts`**

Thêm vào CUỐI file (giữ nguyên toàn bộ code cũ):

```typescript
/* ===== CẤU HÌNH UPLOAD MEDIA CHAT (spec §3.1) ===== */

// Trần dung lượng riêng cho media chat — KHÔNG đụng MAX_FILE_SIZE cũ (avatar/banner giữ 5MB)
export const CHAT_IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10MB ảnh
export const CHAT_VIDEO_MAX_SIZE = 50 * 1024 * 1024; // 50MB video
export const CHAT_FILE_MAX_SIZE = 20 * 1024 * 1024; // 20MB tài liệu

// Nhóm MIME chấp nhận khi upload media chat, tách theo loại để định trần dung lượng
export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm"] as const;
export const ALLOWED_FILE_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
```

Và mở rộng `IMAGE_PRESETS` (thêm 2 key mới vào object literal hiện có):

```typescript
export const IMAGE_PRESETS = {
  avatar: { width: 256, height: 256, fit: "cover" as const },
  banner: { width: 1200, height: 400, fit: "inside" as const },
  // Ảnh chat: thu nhỏ tối đa 1920px giữ nguyên tỉ lệ, không cắt
  chatImage: { width: 1920, height: 1920, fit: "inside" as const },
  // Thumbnail video: khung thu nhỏ trong bubble chat, cắt vuông để đồng bộ tỉ lệ hiển thị
  videoThumb: { width: 320, height: 320, fit: "cover" as const },
} as const;
```

- [ ] **Step 4: Tạo `backend/src/utils/storage.ts`**

```typescript
import fs from "fs/promises";
import path from "path";
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from "../config/upload";
import { logger } from "../core/logger";

/**
 * Hợp đồng tầng lưu trữ tệp (StorageProvider) — điểm trừu tượng hoá duy nhất
 * giữa logic nghiệp vụ và nơi chứa vật lý (spec §3.2).
 * MVP dùng LocalDiskStorage; sau này swap sang S3/Cloudinary chỉ cần
 * thêm implement mới, KHÔNG đụng các hàm gọi `storage`.
 */
export interface StorageProvider {
  /** Ghi buffer xuống nơi lưu với tên tệp chỉ định, trả về URL công khai */
  save(buffer: Buffer, fileName: string): Promise<string>;
  /** Xoá tệp theo URL công khai; im lặng bỏ qua URL không thuộc hệ thống */
  delete(url: string | null | undefined): Promise<void>;
}

/**
 * Implement lưu đĩa cục bộ: thư mục UPLOAD_DIR, phục vụ tĩnh qua /api/uploads.
 */
export class LocalDiskStorage implements StorageProvider {
  async save(buffer: Buffer, fileName: string): Promise<string> {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
    return `${UPLOAD_URL_PREFIX}/${fileName}`;
  }

  async delete(url: string | null | undefined): Promise<void> {
    if (!url) return;
    // Chốt an toàn: chỉ xoá URL do hệ thống sinh ra, chống path traversal
    if (!url.startsWith(`${UPLOAD_URL_PREFIX}/`)) return;
    const fileName = path.basename(url.slice(UPLOAD_URL_PREFIX.length + 1));
    if (!fileName) return;
    try {
      await fs.unlink(path.join(UPLOAD_DIR, fileName));
    } catch (error) {
      // Tệp có thể đã tồn tại trước đó — chỉ ghi log, không phá hỏng request chính
      logger.warn(`Không xoá được tệp: ${fileName}`, error);
    }
  }
}

/** Thể hiện mặc định cho toàn bộ luồng upload */
export const storage: StorageProvider = new LocalDiskStorage();
```

- [ ] **Step 5: Chạy test PASS + type-check**

Run: `cd backend && npx vitest run src/utils/__tests__/storage.test.ts && npm run type-check`
Expected: PASS, type-check sạch

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/upload.ts backend/src/utils/storage.ts backend/src/utils/__tests__/storage.test.ts
git commit -m "feat(backend): add chat upload config limits and StorageProvider abstraction"
```

---

## Task 3: Thumbnail video (ffmpeg) + xử lý media chat + refactor image-storage dùng storage

**Files:**
- Create: `backend/src/utils/video-thumbnail.ts`
- Create: `backend/src/utils/media-storage.ts`
- Modify: `backend/src/utils/image-storage.ts`
- Test: `backend/src/utils/__tests__/video-thumbnail.test.ts`

**Interfaces:**
- Consumes: `storage` (Task 2), `IMAGE_PRESETS` mới (Task 2), sharp (đã có).
- Produces:
  - `generateVideoThumbnail(buffer: Buffer): Promise<Buffer>` — ném `ValidationError` nếu ffmpeg fail/timeout.
  - `processImageToWebp(buffer: Buffer, kind: ImageKind): Promise<Buffer>` — hàm thuần sharp (refactor từ `saveImage`).
  - `saveChatMedia(file: Express.Multer.File, userId: string): Promise<ChatAttachmentResult>` với
    `interface ChatAttachmentResult { url: string; name: string; size: number; mimeType: string; thumbnailUrl?: string }`.

- [ ] **Step 1: Viết failing test đường lỗi của generateVideoThumbnail**

Tạo `backend/src/utils/__tests__/video-thumbnail.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateVideoThumbnail } from "../video-thumbnail";
import { ValidationError } from "../../core/errors";

// Không cần file video thật cho test này: buffer rác chắc chắn không decode được,
// ffmpeg phải trả lỗi và hàm phải dịch sang ValidationError theo hợp đồng.
describe("generateVideoThumbnail", () => {
  it("ném ValidationError khi buffer không phải video hợp lệ", async () => {
    await expect(generateVideoThumbnail(Buffer.from("not-a-video"))).rejects.toThrow(ValidationError);
  }, 30000); // ffmpeg khởi động + fail có thể mất vài giây trên CI Windows
});
```

- [ ] **Step 2: Chạy test xác nhận FAIL**

Run: `cd backend && npx vitest run src/utils/__tests__/video-thumbnail.test.ts`
Expected: FAIL — `Cannot find module '../video-thumbnail'`

- [ ] **Step 3: Tạo `backend/src/utils/video-thumbnail.ts`**

```typescript
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";
import os from "os";
import path from "path";
import { ValidationError } from "../core/errors";

/**
 * Trỏ fluent-ffmpeg tới binary đóng gói sẵn của ffmpeg-static
 * để KHÔNG phải cài ffmpeg vào hệ điều hành máy chủ.
 */
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

// Thời điểm cắt thumbnail: 1 giây — đủ vượt màn hình đen/mở đầu của đa số video
const THUMBNAIL_TIMESTAMP = 1;
// Trần thời gian cho một lần cắt — video lỗi có thể treo pipeline, phải cắt sớm
const FFMPEG_TIMEOUT_MS = 15000;

/**
 * Cắt một khung hình từ nội dung video trong RAM, trả về ảnh JPEG buffer (spec §3.4).
 *
 * Dùng API `.screenshots` ghi file tạm rồi đọc ngược lên buffer — đường đi
 * file-based này ỔN ĐỊNH NHẤT trên Windows (pipe-to-pipe của fluent-ffmpeg
 * thường lỗi trên win32). JPEG (không phải webp) làm định dạng trung gian;
 * bước webp hoá cuối cùng do sharp đảm nhiệm ở media-storage.
 *
 * @throws ValidationError khi ffmpeg không decode được video (file hỏng/giả mạo) hoặc hết giờ
 */
export function generateVideoThumbnail(buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `thumb-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`);
    // Đồng hồ an toàn: video lỗi có thể khiến ffmpeg treo vô hạn
    const timer = setTimeout(() => {
      try { fs.unlinkSync(tmpFile); } catch { /* noop */ }
      reject(new ValidationError("Hết thời gian xử lý video"));
    }, FFMPEG_TIMEOUT_MS);

    ffmpeg(buffer)
      // -ss ĐẶT TRƯỚC input để ffmpeg nhảy nhanh tới frame, không giải mã cả file
      .inputOptions(["-ss", String(THUMBNAIL_TIMESTAMP)])
      .screenshots({
        timestamps: [THUMBNAIL_TIMESTAMP],
        filename: path.basename(tmpFile),
        folder: path.dirname(tmpFile),
        size: "320x320", // ép khung vuông, sharp sẽ crop lại chính xác ở bước sau
      })
      .on("end", () => {
        try {
          const out = fs.readFileSync(tmpFile);
          fs.unlinkSync(tmpFile);
          clearTimeout(timer);
          resolve(out);
        } catch {
          clearTimeout(timer);
          reject(new ValidationError("Không đọc được khung hình cắt ra từ video"));
        }
      })
      .on("error", () => {
        clearTimeout(timer);
        try { fs.unlinkSync(tmpFile); } catch { /* noop */ }
        reject(new ValidationError("Tệp video không hợp lệ hoặc không cắt được khung hình đại diện"));
      });
  });
}
```

- [ ] **Step 4: Chạy test PASS**

Run: `cd backend && npx vitest run src/utils/__tests__/video-thumbnail.test.ts`
Expected: PASS

- [ ] **Step 5: Refactor `image-storage.ts` — tách hàm thuần sharp + dùng storage**

Trong `backend/src/utils/image-storage.ts`: thay phần `saveImage` để tái sử dụng, GIỮ NGUYÊN signature `saveImage(buffer, kind, userId)` và `deleteImageByUrl(url)` (user.controller đang import 2 hàm này):

```typescript
import { storage } from "./storage";

/**
 * Xử lý buffer ảnh bằng sharp theo preset: resize + ép webp.
 *sharp đồng thời là lớp XÁC THỰC THẬT: tệp không giải mã được sẽ ném lỗi.
 * Tách thành hàm thuần để media-storage (Task này) và saveImage (avatar/banner) cùng dùng.
 */
export async function processImageToWebp(buffer: Buffer, kind: ImageKind): Promise<Buffer> {
  const preset = IMAGE_PRESETS[kind];
  try {
    return await sharp(buffer)
      .resize(preset.width, preset.height, { fit: preset.fit, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ValidationError("Tệp tải lên không phải là ảnh hợp lệ hoặc đã bị hỏng");
  }
}

// saveImage cũ giữ nguyên hành vi, thân hàm gọi qua processImageToWebp + storage.save:
export async function saveImage(buffer: Buffer, kind: ImageKind, userId: string): Promise<string> {
  const processed = await processImageToWebp(buffer, kind);
  // Phần ngẫu nhiên khiến URL ĐỔI mỗi lần thay ảnh -> cache immutable an toàn
  const suffix = crypto.randomBytes(4).toString("hex");
  return storage.save(processed, `${kind}-${userId}-${suffix}.webp`);
}

// deleteImageByUrl chuyển thân hàm về storage.delete (giữ chữ ký cũ)
export async function deleteImageByUrl(url: string | null | undefined): Promise<void> {
  await storage.delete(url);
}
```
Xoá các import `fs`/`UPLOAD_DIR`/`UPLOAD_URL_PREFIX` không còn dùng trong file này.

- [ ] **Step 6: Tạo `backend/src/utils/media-storage.ts`**

```typescript
import path from "path";
import crypto from "crypto";
import { ValidationError } from "../core/errors";
import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_VIDEO_MIME,
  ALLOWED_FILE_MIME,
  CHAT_IMAGE_MAX_SIZE,
  CHAT_VIDEO_MAX_SIZE,
  CHAT_FILE_MAX_SIZE,
} from "../config/upload";
import { processImageToWebp } from "./image-storage";
import { generateVideoThumbnail } from "./video-thumbnail";
import { storage } from "./storage";

/**
 * Kết quả một tệp media chat sau khi xử lý — khớp AttachmentSchema
 * của message.schema.ts (url, name, size, mimeType) + thumbnailUrl cho video.
 */
export interface ChatAttachmentResult {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
}

/** Tra kích thước trần theo nhóm MIME; trả null nếu MIME không được phép */
function sizeLimitFor(mime: string): number | null {
  if ((ALLOWED_IMAGE_MIME as readonly string[]).includes(mime)) return CHAT_IMAGE_MAX_SIZE;
  if ((ALLOWED_VIDEO_MIME as readonly string[]).includes(mime)) return CHAT_VIDEO_MAX_SIZE;
  if ((ALLOWED_FILE_MIME as readonly string[]).includes(mime)) return CHAT_FILE_MAX_SIZE;
  return null;
}

/**
 * Xử lý MỘT tệp upload trong chat (spec §3.3):
 * - ảnh tĩnh (jpeg/png/webp): resize tối đa 1920px + ép webp
 * - gif: GIỮ NGUYÊN BẢN vì sharp convert webp sẽ mất animation
 * - video (mp4/webm): lưu nguyên bản + cắt frame 1s bằng ffmpeg làm thumbnail webp
 * - tài liệu (pdf/doc/docx): lưu nguyên bản, chỉ kiểm trần dung lượng
 *
 * @throws ValidationError khi MIME lạ, vượt trần, hoặc tệp hỏng
 */
export async function saveChatMedia(
  file: Express.Multer.File,
  userId: string
): Promise<ChatAttachmentResult> {
  const limit = sizeLimitFor(file.mimetype);
  if (limit === null) {
    throw new ValidationError(`Định dạng tệp không được hỗ trợ: ${file.mimetype}`);
  }
  if (file.size > limit) {
    throw new ValidationError(`Tệp "${file.originalname}" vượt trần ${Math.round(limit / 1024 / 1024)}MB`);
  }

  const suffix = crypto.randomBytes(4).toString("hex");
  const isImage = (ALLOWED_IMAGE_MIME as readonly string[]).includes(file.mimetype);
  const isVideo = (ALLOWED_VIDEO_MIME as readonly string[]).includes(file.mimetype);

  // ===== Video: lưu nguyên bản rồi cắt thumbnail (ffmpeg có thể fail -> không để lại file mồ côi) =====
  if (isVideo) {
    const ext = path.extname(file.originalname).toLowerCase() === ".webm" ? "webm" : "mp4";
    const videoUrl = await storage.save(file.buffer, `chat-video-${userId}-${suffix}.${ext}`);
    try {
      const thumbJpeg = await generateVideoThumbnail(file.buffer);
      const thumbWebp = await processImageToWebp(thumbJpeg, "videoThumb");
      const thumbnailUrl = await storage.save(thumbWebp, `chat-thumb-${userId}-${suffix}.webp`);
      return { url: videoUrl, name: file.originalname, size: file.size, mimeType: file.mimetype, thumbnailUrl };
    } catch (err) {
      // Rollback tệp video đã ghi khi thumbnail lỗi để không rác đĩa
      await storage.delete(videoUrl);
      throw err;
    }
  }

  // ===== Ảnh tĩnh: xác thực + nén bằng sharp (ngoại lệ GIF giữ nguyên) =====
  if (isImage && file.mimetype !== "image/gif") {
    const webp = await processImageToWebp(file.buffer, "chatImage");
    const url = await storage.save(webp, `chat-img-${userId}-${suffix}.webp`);
    return { url, name: file.originalname, size: webp.length, mimeType: "image/webp" };
  }
  if (file.mimetype === "image/gif") {
    const url = await storage.save(file.buffer, `chat-gif-${userId}-${suffix}.gif`);
    return { url, name: file.originalname, size: file.size, mimeType: "image/gif" };
  }

  // ===== Tài liệu: chỉ ghi đĩa, phần mở rộng lấy từ tên gốc đã sanitize =====
  const safeExt = (path.extname(file.originalname).match(/^\.[a-z0-9]{1,8}$/i)?.[0] ?? ".bin").toLowerCase();
  const url = await storage.save(file.buffer, `chat-file-${userId}-${suffix}${safeExt}`);
  return { url, name: file.originalname, size: file.size, mimeType: file.mimetype };
}
```

- [ ] **Step 7: Verification toàn backend**

Run: `cd backend && npx vitest run && npm run type-check`
Expected: test cũ (auth/friend/message... nếu có) vẫn PASS; type-check sạch

- [ ] **Step 8: Commit**

```bash
git add backend/src/utils/
git commit -m "feat(backend): chat media pipeline - ffmpeg video thumbnail + media storage + storage-backed image refactor"
```

---

## Task 4: Middleware upload chat + route + controller + wiring

**Files:**
- Create: `backend/src/schemas/upload.schema.ts`
- Create: `backend/src/controllers/upload.controller.ts`
- Create: `backend/src/routes/upload.routes.ts`
- Modify: `backend/src/middlewares/upload.ts` (thêm export mới, giữ nguyên `upload` cũ)
- Modify: `backend/src/routes/index.ts`
- Test: `backend/src/routes/__tests__/upload.routes.test.ts`

**Interfaces:**
- Consumes: `saveChatMedia` + `ChatAttachmentResult` (Task 3), `requireAuth` (đã có), `ValidationError` (đã có).
- Produces:
  - `uploadChatMedia` (multer instance, `array("files", 10)`)
  - `POST /api/upload/chat` → `201 { success: true, data: ChatAttachmentResult[] }` | `400 { success:false, error:{...} }` | `401`
  - `uploadRoutes` exported từ `routes/upload.routes.ts`

- [ ] **Step 1: Mở rộng `middlewares/upload.ts`**

GIỮ NGUYÊN export `upload` cũ. Thêm cuối file:

```typescript
import { ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME, ALLOWED_FILE_MIME, CHAT_VIDEO_MAX_SIZE } from "../config/upload";

// Danh sách MIME đầy đủ cho media chat (hợp nhất 3 nhóm ảnh/video/tài liệu)
const CHAT_ALLOWED_MIME: readonly string[] = [
  ...ALLOWED_IMAGE_MIME, ...ALLOWED_VIDEO_MIME, ...ALLOWED_FILE_MIME,
];

/**
 * Middleware riêng cho luồng upload media chat: nhiều tệp (tối đa 10) mỗi request,
 * trần dung lượng thô theo video (loại lớn nhất) — ảnh/tài liệu được chặn lại
 * theo trần riêng trong saveChatMedia (media-storage) sau khi multer nhận đủ byte.
 * Tệp vẫn nằm trong RAM (memoryStorage) để pipeline sharp/ffmpeg xử lý, không ghi đĩa tạm.
 */
export const uploadChatMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_VIDEO_MAX_SIZE, files: 10 },
  fileFilter: (_req, file, cb) => {
    // Lớp lọc sớm rẻ tiền theo mimetype khai báo; lớp xác thực thật là sharp/ffmpeg
    if (!CHAT_ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new ValidationError("Định dạng tệp không được hỗ trợ"));
    }
    cb(null, true);
  },
});
```

- [ ] **Step 2: Tạo `schemas/upload.schema.ts`**

```typescript
import { z } from "zod";

/**
 * Schema validate PHẦN METADATA của request upload chat (multipart/form-data).
 * KHÔNG validate tệp (req.files do multer điền sau); giữ đúng bài học ở user.routes:
 * validate chạy trên body chỉ chứa field text đi kèm form.
 */
export const UploadChatSchema = z.object({
  body: z.object({
    // conversationId optional: client có thể gửi kèm để log truy vết; không bắt buộc
    conversationId: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID cuộc trò chuyện không hợp lệ").optional(),
  }),
});
```

- [ ] **Step 3: Viết failing integration test**

Tạo `backend/src/routes/__tests__/upload.routes.test.ts` — pattern theo các test route hiện có (nếu chưa có test app nào, tự dựng app tối giản):

```typescript
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { uploadRoutes } from "../upload.routes";
import { errorHandler } from "../../middlewares/error-handler";

// Stub middleware auth: test chỉ kiểm LuỒNG UPLOAD + VALIDATION, không test JWT
vi.mock("../../middlewares/auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => { _req.user = { userId: "507f1f77bcf86cd799439011" }; next(); },
}));

describe("POST /api/upload/chat", () => {
  const app = express();
  app.use("/upload", uploadRoutes);
  app.use(errorHandler);

  it("trả 400 khi không có tệp nào", async () => {
    const res = await request(app).post("/upload/chat");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("trả 400 khi MIME không được hỗ trợ", async () => {
    const res = await request(app)
      .post("/upload/chat")
      .attach("files", Buffer.from("#!/bin/sh\nrm -rf /"), { filename: "evil.sh", contentType: "application/x-sh" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/không được hỗ trợ/i);
  });

  it("upload ảnh png thành công -> 201 với attachment webp", async () => {
    const sharp = (await import("sharp")).default;
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
    const res = await request(app).post("/upload/chat").attach("files", png, "red.png");
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
    const att = res.body.data[0];
    expect(att.url).toMatch(/^\/api\/uploads\/chat-img-/);
    expect(att.mimeType).toBe("image/webp");
    expect(att.name).toBe("red.png");
  });
});
```

- [ ] **Step 4: Chạy test xác nhận FAIL**

Run: `cd backend && npx vitest run src/routes/__tests__/upload.routes.test.ts`
Expected: FAIL — `Cannot find module '../upload.routes'`

- [ ] **Step 5: Tạo `controllers/upload.controller.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import { saveChatMedia, ChatAttachmentResult } from "../utils/media-storage";
import { storage } from "../utils/storage";
import { ValidationError } from "../core/errors";

/**
 * Controller xử lý upload media chat (spec §3.7).
 * POST /api/upload/chat — multipart: các tệp ở req.files (field "files").
 *
 * Chiến lược nguyên tử theo batch: xử lý song song mọi tệp bằng Promise.allSettled;
 * nếu BẤT KỲ tệp nào lỗi, xoá toàn bộ URL đã ghi (rollback) rồi ném 400 —
 * client gửi lại cả batch sạch thay vì suy đoán tệp nào sống tệp nào chết.
 * Phản hồi 201 kèm mảng attachment (url, name, size, mimeType[, thumbnailUrl])
 * để frontend ghép vào payload sendMessage.
 */
export class UploadController {
  async uploadChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        throw new ValidationError("Chưa có tệp nào được tải lên");
      }
      if (files.length > 10) {
        throw new ValidationError("Tối đa 10 tệp mỗi lần tải lên");
      }

      const userId = req.user!.userId;

      // allSettled giữ cả kết quả lẫn lỗi (không nuốt rejection như all + then)
      const settled = await Promise.allSettled(
        files.map((f) => saveChatMedia(f, userId))
      );

      // Kiểm tra có tệp nào lỗi không
      const hasFailure = settled.some((r) => r.status === "rejected");
      if (hasFailure) {
        // Thu thập mọi URL đã ghi thành công (kể cả thumbnailUrl) để rollback
        const urlsToDelete: string[] = [];
        for (const result of settled) {
          if (result.status === "fulfilled") {
            urlsToDelete.push(result.value.url);
            if (result.value.thumbnailUrl) urlsToDelete.push(result.value.thumbnailUrl);
          }
        }
        // Rollback song song — KHÔNG ném lỗi nếu delete lỗi (storage.delete đã im lặng)
        await Promise.all(urlsToDelete.map((u) => storage.delete(u)));

        // Ném lỗi đầu tiên để báo cho client
        const firstFailure = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
        throw firstFailure?.reason instanceof Error
          ? firstFailure.reason
          : new ValidationError("Có tệp không hợp lệ trong batch upload");
      }

      // Mọi tệp thành công → trả attachment
      const attachments: ChatAttachmentResult[] = settled.map(
        (r) => (r as PromiseFulfilledResult<ChatAttachmentResult>).value
      );
      res.status(201).json({ success: true, data: attachments });
    } catch (error) {
      next(error);
    }
  }
}

/** Thể hiện mặc định (Singleton) của UploadController */
export const uploadController = new UploadController();
```

- [ ] **Step 6: Tạo `routes/upload.routes.ts`**

```typescript
import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { uploadChatMedia } from "../middlewares/upload";
import { UploadChatSchema } from "../schemas/upload.schema";

const router = Router();

// Toàn bộ luồng upload media chat yêu cầu đăng nhập (JWT) — chống người lạ đổ tệp vào đĩa server
router.use(requireAuth);

/**
 * [POST /api/upload/chat]
 * Upload nhiều tệp media (tối đa 10) cho tin nhắn chat.
 * Thứ tự middleware: multer TRƯỚC validate — với multipart, req.body chỉ đầy đủ
 * sau khi multer parse xong (bài học đã ghi chú ở user.routes avatar/banner).
 * Phản hồi 201 kèm mảng attachment để client nhét vào payload SendMessage.
 */
router.post("/chat", uploadChatMedia.array("files", 10), validate(UploadChatSchema), uploadController.uploadChat);

export const uploadRoutes = router;
```

- [ ] **Step 7: Wiring vào `routes/index.ts`**

```typescript
import { uploadRoutes } from "./upload.routes";
// ...
apiRouter.use("/upload", uploadRoutes);
```

- [ ] **Step 8: Chạy test PASS**

Run: `cd backend && npx vitest run src/routes/__tests__/upload.routes.test.ts && npm run type-check`
Expected: PASS (test 401 không nằm trong batch này vì đã mock auth)

- [ ] **Step 9: Commit**

```bash
git add backend/src/middlewares/upload.ts backend/src/schemas/upload.schema.ts backend/src/controllers/upload.controller.ts backend/src/routes/upload.routes.ts backend/src/routes/index.ts backend/src/routes/__tests__/upload.routes.test.ts
git commit -m "feat(backend): POST /api/upload/chat multipart endpoint with rollback and tests"
```

---

## Task 5: Frontend — types + service + store

**Files:**
- Modify: `frontend/src/types/chat.types.ts` (thêm `thumbnailUrl?` vào `MessageAttachment`)
- Modify: `frontend/src/features/chat/services/chat.service.ts` (thêm `uploadFiles`)
- Modify: `frontend/src/features/chat/stores/chat.store.ts` (state `pendingFiles`/`isUploading`, action `addPendingFiles`/`removePendingFile`/`clearPendingFiles`, đổi luồng `sendMessage`)
- Test: không có test FE cho service/store thuần (repo chưa setup RTL) → verify bằng `npx tsc --noEmit`.

**Interfaces:**
- Consumes: `POST /api/upload/chat` (Task 4).
- Produces:
  - `chatService.uploadFiles(files: File[]): Promise<MessageAttachment[]>`
  - `ChatState.pendingFiles: File[]`, `ChatState.isUploading: boolean`
  - `ChatState.addPendingFiles(files: File[]): void` / `removePendingFile(index: number): void` / `clearPendingFiles(): void`
  - `sendMessage` giữ chữ ký cũ — FE component gọi như cũ, store tự gộp pendingFiles.

- [ ] **Step 1: `chat.types.ts` — thêm thumbnailUrl**

```typescript
export interface MessageAttachment {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  // Khung hình đại diện video do backend cắt (chỉ có với video), rỗng với loại khác
  thumbnailUrl?: string;
}
```

- [ ] **Step 2: `chat.service.ts` — thêm uploadFiles**

```typescript
  /**
   * Upload nhiều tệp media (tối đa 10) lên /api/upload/chat.
   * Trả về mảng attachment (đã gồm url công khai + thumbnailUrl với video)
   * để caller ghép vào payload sendMessage. Không tự gửi tin nhắn.
   */
  async uploadFiles(files: File[]): Promise<MessageAttachment[]> {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await apiClient.post<ApiResponse<MessageAttachment[]>>(
        "/upload/chat",
        formData
        // KHÔNG tự set Content-Type: axios tự thêm boundary của multipart khi gặp FormData
      );
      if (!response.data.success || !Array.isArray(response.data.data)) {
        throw new Error(response.data.error?.message || "Không tải tệp lên được");
      }
      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không tải tệp lên được. Vui lòng thử lại."));
    }
  },
```
(đồng thời import thêm `MessageAttachment` vào dòng import types đầu file nếu chưa có)

- [ ] **Step 3: `chat.store.ts` — state + actions pendingFiles**

Trong `ChatState` interface thêm:

```typescript
  // Danh sách tệp đang chờ gửi (preview trong MediaPreviewBar, chưa upload)
  pendingFiles: File[];
  // Cờ đã gửi yêu cầu upload tới server trong lúc sendMessage chạy
  isUploading: boolean;
  // Hành động: thêm / xoá / dọn tệp chờ gửi
  addPendingFiles: (files: File[]) => void;
  removePendingFile: (index: number) => void;
  clearPendingFiles: () => void;
```

Trong `create<ChatState>()` thêm implementation:

```typescript
  pendingFiles: [],
  isUploading: false,

  addPendingFiles: (files) =>
    set((state) => ({ pendingFiles: [...state.pendingFiles, ...files].slice(0, 10) })),
  removePendingFile: (index) =>
    set((state) => ({ pendingFiles: state.pendingFiles.filter((_, i) => i !== index) })),
  clearPendingFiles: () => set({ pendingFiles: [] }),
```

- [ ] **Step 4: `chat.store.ts` — nâng cấp sendMessage**

Chữ ký cũ `sendMessage(conversationId, content, type?, attachments?)` GIỮ NGUYÊN và gọi thêm branch pendingFiles:

```typescript
  sendMessage: async (conversationId, content, type, attachments) => {
    const { pendingFiles } = get();
    try {
      let finalAttachments = attachments ?? [];
      let finalType = type ?? "TEXT";

      // Bước 1: nếu có tệp chờ -> upload song song, gom kết quả vào attachments
      if (pendingFiles.length > 0) {
        set({ isUploading: true });
        const uploaded = await chatService.uploadFiles(pendingFiles);
        finalAttachments = [...finalAttachments, ...uploaded];
        finalType = type ?? (finalAttachments.length > 0 ? "IMAGE" : "TEXT");
        set({ isUploading: false, pendingFiles: [] });
      }

      // Bước 2: gửi tin nhắn REST với attachments đã gồm url media
      const message = await chatService.sendMessage(conversationId, {
        content,
        type: finalType,
        attachments: finalAttachments,
      } satisfies SendMessagePayload);

      // ... existing code: tối ưu danh sách tin nhắn + conversation sau khi gửi thành công ...
```
(Phần body cũ xử lý kết quả giữ nguyên; `isUploading=false` cũng phải set trong `catch`)

- [ ] **Step 5: Verify type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: sạch

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/chat.types.ts frontend/src/features/chat/services/chat.service.ts frontend/src/features/chat/stores/chat.store.ts
git commit -m "feat(frontend): upload media pipeline in chat service/store with pendingFiles state"
```

---

## Task 6: Frontend — FileUploadButton + MediaPreviewBar + MessageInput wiring

**Files:**
- Create: `frontend/src/features/chat/components/FileUploadButton.tsx`
- Create: `frontend/src/features/chat/components/MediaPreviewBar.tsx`
- Modify: `frontend/src/features/chat/components/MessageInput.tsx`
- Verify: `npx tsc --noEmit` (không có test RTL trong repo này — xác nhận bằng build + chạy app)

**Interfaces:**
- Consumes: `addPendingFiles`/`removePendingFile`/`pendingFiles`/`isUploading` (Task 5).
- Produces:
  - `<FileUploadButton onFilesChosen={(files: File[]) => void} />`
  - `<MediaPreviewBar />` (đọc store trực tiếp — molecule nối store, đặt trong organisms MessageInput)

- [ ] **Step 1: Tạo `FileUploadButton.tsx`**

```typescript
import React, { useRef } from "react";
import { Plus } from "lucide-react";
import { toast } from "../../../stores/toast.store";
import { useChatStore } from "../stores/chat.store";

// Bộ lọc MIME hai lớp (client-side, UX): khớp whitelist backend ở config/upload.ts
const ACCEPT_ATTR = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,.pdf,.doc,.docx";

// Trần dung lượng client-side theo loại (đồng bộ CHAT_*_MAX_SIZE backend — Task 2)
const MAX_SIZE: Record<"image" | "video" | "file", number> = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  file: 20 * 1024 * 1024,
};

/**
 * Nút đính kèm tệp media kiểu Discord (FileUploadButton) — thay thế toast placeholder.
 * Bọc <input type=file multiple> ẩn; validate nhanh sơ bộ ở client ( MIME + dung lượng )
 * rồi đẩy tệp hợp lệ vào pendingFiles của chat store để MediaPreviewBar hiển thị.
 * Logic nặng (upload thật) KHÔNG nằm ở đây — store + service đảm nhiệm khi bấm Gửi.
 */
export const FileUploadButton: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const addPendingFiles = useChatStore((s) => s.addPendingFiles);
  const pendingCount = useChatStore((s) => s.pendingFiles.length);

  const classify = (file: File): "image" | "video" | "file" =>
    file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    const accepted: File[] = [];
    for (const file of chosen) {
      const kind = classify(file);
      // Chặn sớm tệp quá trần để người dùng không chờ upload rồi mới nhận 400 từ server
      if (file.size > MAX_SIZE[kind]) {
        toast.error(`"${file.name}" vượt quá ${Math.round(MAX_SIZE[kind] / 1024 / 1024)}MB`);
        continue;
      }
      accepted.push(file);
    }
    if (pendingCount + accepted.length > 10) {
      toast.error("Tối đa 10 tệp mỗi lần gửi");
      return;
    }
    if (accepted.length > 0) addPendingFiles(accepted);
    // Reset input để chọn lại đúng cùng một tệp vẫn fire change
    e.target.value = "";
  };

  return (
    <>
      <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTR} hidden onChange={handleChange} aria-hidden="true" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-8 h-8 rounded-xs bg-uupm-surface-strong hover:bg-uupm-accent hover:text-uupm-accent-text border-2 border-uupm-line shadow-uupm-active flex items-center justify-center text-uupm-accent-text shrink-0 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2"
        title="Tải lên tệp hoặc ảnh"
        aria-label="Tải lên tệp hoặc ảnh"
      >
        <Plus className="w-4 h-4 font-black" />
      </button>
    </>
  );
};
```

- [ ] **Step 2: Tạo `MediaPreviewBar.tsx`**

```typescript
import React, { useEffect, useState } from "react";
import { FileText, Film, ImageIcon, X } from "lucide-react";
import { useChatStore } from "../stores/chat.store";

// Định dạng dung lượng đẹp mắt cho card preview tệp tài liệu
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * Thanh preview các tệp đang chờ gửi (MediaPreviewBar) — xuất hiện phía trên ô nhập.
 * Đọc pendingFiles từ chat store (molecule nối state, không nhận data qua props).
 * Ảnh: thumbnail qua object URL; Video: khung hình đầu bằng <video preload="metadata">
 * (thumbnail webp chỉ có SAU khi server cắt — lúc chờ gửi chỉ cần khung đầu);
 * File: icon + tên + dung lượng. Mỗi item có nút xoá.
 */
export const MediaPreviewBar: React.FC = () => {
  const pendingFiles = useChatStore((s) => s.pendingFiles);
  const removePendingFile = useChatStore((s) => s.removePendingFile);
  // Bản đồ URL tạm (blob) tạo khi mount — HỦY tất cả khi unmount/danh sách đổi để chống rò bộ nhớ
  const [objectUrls, setObjectUrls] = useState<string[]>([]);
  const prevFiles = React.useRef<File[]>([]);

  useEffect(() => {
    const urls = pendingFiles.map((f) => URL.createObjectURL(f));
    setObjectUrls(urls);
    prevFiles.current = pendingFiles;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingFiles]);

  if (pendingFiles.length === 0) return null; // Empty state: ẩn hoàn toàn, không chiếm chỗ layout

  return (
    <div className="flex flex-wrap gap-2 px-3 md:px-4 py-2 bg-uupm-surface border-t-2 border-uupm-line">
      {pendingFiles.map((file, index) => {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        return (
          <div
            key={`${file.name}-${index}`}
            className="relative w-20 h-20 rounded-xs border-2 border-uupm-line shadow-uupm-active overflow-hidden bg-uupm-page flex items-center justify-center"
            title={file.name}
          >
            {isImage && <img src={objectUrls[index]} alt={file.name} className="w-full h-full object-cover" />}
            {isVideo && <video src={objectUrls[index]} preload="metadata" muted className="w-full h-full object-cover pointer-events-none" />}
            {!isImage && !isVideo && (
              <div className="flex flex-col items-center justify-center gap-1 px-1 text-center">
                {file.type.includes("pdf") || file.type.includes("word") ? <FileText className="w-6 h-6 text-uupm-ink-muted" /> : <Film className="w-6 h-6 text-uupm-ink-muted" />}
                <span className="text-[9px] font-bold text-uupm-ink-muted truncate max-w-full">{formatSize(file.size)}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => removePendingFile(index)}
              aria-label={`Xoá tệp ${file.name}`}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-xs bg-uupm-surface-strong border border-uupm-line flex items-center justify-center text-uupm-ink hover:bg-uupm-accent cursor-pointer transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
      <div className="self-center text-[10px] font-bold text-uupm-ink-muted">
        {pendingFiles.length} tệp đang chờ gửi
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Wiring vào `MessageInput.tsx`**

Thay block nút `+` placeholder toast bằng `<FileUploadButton />` (import từ `./FileUploadButton`). Bao toàn bộ return cũ trong một wrapper dọc `flex flex-col`, render `<MediaPreviewBar />` ở trên dòng khung nhập, chỉ hiển thị khi có tệp (component tự xử lý). Nút Gửi:

```typescript
// Bật nút Gửi khi có nội dung HOẶC có tệp chờ gửi (chấp nhận gửi media không kèm text)
const canSend = Boolean(content.trim()) || pendingFiles.length > 0;
```
`disabled={disabled || !canSend || isUploading}` và trong `handleSend`:

```typescript
  const handleSend = async () => {
    const trimmed = content.trim();
    if ((!trimmed && pendingFiles.length === 0) || disabled) return;
    setContent("");
    onTyping(false);
    // Store tự phát hiện pendingFiles -> upload trước rồi mới gửi tin nhắn (Task 5)
    await onSendMessage(trimmed);
    textareaRef.current?.focus();
  };
```
(đọc `pendingFiles`, `isUploading` từ `useChatStore` trong component)

- [ ] **Step 4: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: sạch lỗi type

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chat/components/
git commit -m "feat(frontend): attach files button + media preview bar wired into MessageInput"
```

---

## Task 7: Frontend — MediaMessage render attachments trong DiscordMessageItem

**Files:**
- Create: `frontend/src/features/chat/components/MediaMessage.tsx`
- Create: `frontend/src/features/chat/components/MediaLightbox.tsx`
- Modify: `frontend/src/features/chat/components/DiscordMessageItem.tsx`
- Verify: `npx tsc --noEmit`

**Interfaces:**
- Consumes: `MessageAttachment` gồm `thumbnailUrl?` (Task 5).
- Produces:
  - `<MediaMessage attachments={MessageAttachment[]} isSticker={boolean} />`
  - Phân loại bằng mimeType (spec §4.4): ảnh/video/tài liệu. Quy ước sticker: `attachments.length === 1 && content === "" && mimeType === "image/webp"` — DiscordMessageItem tính sẵn cờ `isSticker`.

- [ ] **Step 1: Tạo `MediaLightbox.tsx`**

```typescript
import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface MediaLightboxProps {
  open: boolean;
  onClose: () => void;
  /** URL media cần phóng to (ảnh hoặc video) */
  url: string;
  mimeType: string;
  alt: string;
  thumbnailUrl?: string;
}

/**
 * Khung phóng to media toàn màn hình (MediaLightbox) — Radix Dialog,
 * dùng cho ảnh và video trong bong bóng tin nhắn. Nút đóng + click nền để thoát,
 * media giữ tỉ lệ trong khung nhìn, viền theo theme uupm.
 */
export const MediaLightbox: React.FC<MediaLightboxProps> = ({ open, onClose, url, mimeType, alt, thumbnailUrl }) => {
  const isVideo = mimeType.startsWith("video/");
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[92vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-xs border-2 border-uupm-line bg-uupm-surface p-2 shadow-uupm-2 focus:outline-none">
          {/* Dialog.Title ẩn khỏi thị giác nhưng giữ chuẩn a11y cho screen reader */}
          <Dialog.Title className="sr-only">{alt}</Dialog.Title>
          {isVideo ? (
            <video src={url} poster={thumbnailUrl} controls autoPlay className="w-full max-h-[80vh] rounded-xs" />
          ) : (
            <img src={url} alt={alt} className="w-full max-h-[80vh] object-contain mx-auto select-none" draggable={false} />
          )}
          <Dialog.Close aria-label="Đóng khung xem media" className="absolute right-3 top-3 w-7 h-7 rounded-xs bg-uupm-surface-strong border border-uupm-line flex items-center justify-center text-uupm-ink hover:bg-uupm-accent cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
```

- [ ] **Step 2: Tạo `MediaMessage.tsx`**

```typescript
import React, { useState } from "react";
import { Download, FileText } from "lucide-react";
import { MessageAttachment } from "../../../types/chat.types";
import { MediaLightbox } from "./MediaLightbox";
import { cn } from "../../../lib/utils";

/** Định dạng dung lượng gọn cho file card */
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

interface MediaMessageProps {
  attachments: MessageAttachment[];
  /** Sticker từ kho Klipy: hiển thị ảnh lớn trong suốt không bong bóng (giữ giao diện cũ) */
  isSticker?: boolean;
}

/**
 * Khối render danh sách tệp đính kèm trong tin nhắn (MediaMessage):
 * - isSticker=true: lưới ảnh sticker kiểu Discord cũ (w-32 object-contain, không nền)
 * - ảnh thường: thumbnail bo viền, click mở MediaLightbox
 * - video: khung play phủ poster thumbnailUrl (server cắt), click mở lightbox có controls
 * - tài liệu: card icon + tên + dung lượng + nút tải xuống
 */
export const MediaMessage: React.FC<MediaMessageProps> = ({ attachments, isSticker = false }) => {
  // Ảnh/video đang mở lightbox (lưu attachment để đủ url + mime + thumb)
  const [activeMedia, setActiveMedia] = useState<MessageAttachment | null>(null);

  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 py-1 max-w-full">
      {attachments.map((att) => {
        const isImage = att.mimeType.startsWith("image/");
        const isVideo = att.mimeType.startsWith("video/");

        // ===== Sticker: giữ đúng giao diện Discord 128px trong suốt, không lightbox =====
        if (isSticker && isImage) {
          return (
            <img key={att.url} src={att.url} alt={att.name} loading="lazy" className="w-32 h-32 object-contain select-none" draggable={false} />
          );
        }

        // ===== Ảnh chat: thumbnail bấm phóng to =====
        if (isImage) {
          return (
            <button
              key={att.url}
              type="button"
              onClick={() => setActiveMedia(att)}
              aria-label={`Phóng to ảnh ${att.name}`}
              className="block max-w-[280px] cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <img src={att.url} alt={att.name} loading="lazy" className="max-h-60 w-auto rounded-xs border-2 border-uupm-line shadow-uupm-active object-contain" draggable={false} />
            </button>
          );
        }

        // ===== Video: khung preview có poster + overlay nút play =====
        if (isVideo) {
          return (
            <button
              key={att.url}
              type="button"
              onClick={() => setActiveMedia(att)}
              aria-label={`Phát video ${att.name}`}
              className={cn("relative w-60 h-36 rounded-xs border-2 border-uupm-line shadow-uupm-active overflow-hidden bg-black cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2")}
            >
              {/* poster = thumbnail server cắt; preload none để không tốn băng thông khi chỉ lướt lịch sử */}
              <video src={att.url} poster={att.thumbnailUrl} preload="none" muted className="w-full h-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-10 h-10 rounded-full bg-uupm-accent/90 border-2 border-uupm-line flex items-center justify-center text-uupm-accent-text text-sm font-black">▶</span>
              </span>
              <span className="absolute bottom-1 right-1 px-1 rounded-xs bg-black/70 text-[9px] font-bold text-white">{formatSize(att.size)}</span>
            </button>
          );
        }

        // ===== Tài liệu: card tải xuống (anchor download trình duyệt tự xử lý) =====
        return (
          <a
            key={att.url}
            href={att.url}
            download={att.name}
            aria-label={`Tải xuống tệp ${att.name}`}
            className="flex items-center gap-2 max-w-[280px] px-3 py-2 rounded-xs border-2 border-uupm-line bg-uupm-surface hover:bg-uupm-accent-soft shadow-uupm-active transition-colors"
          >
            <FileText className="w-8 h-8 text-uupm-accent shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-bold text-uupm-ink truncate">{att.name}</span>
              <span className="block text-[10px] font-semibold text-uupm-ink-muted">{formatSize(att.size)}</span>
            </span>
            <Download className="w-4 h-4 text-uupm-ink-muted shrink-0" />
          </a>
        );
      })}

      <MediaLightbox
        open={activeMedia !== null}
        onClose={() => setActiveMedia(null)}
        url={activeMedia?.url ?? ""}
        mimeType={activeMedia?.mimeType ?? ""}
        alt={activeMedia?.name ?? "media"}
        thumbnailUrl={activeMedia?.thumbnailUrl}
      />
    </div>
  );
};
```

- [ ] **Step 3: Sửa `DiscordMessageItem.tsx`**

Thay block điều kiện render attachments cũ (đoạn `message.attachments && ...` đang dùng `<img>` raw sticker) bằng:

```tsx
{/* Có tệp đính kèm: MediaMessage tự phân loại ảnh/video/file/sticker theo mimeType (spec §4.4) */}
{message.attachments && message.attachments.length > 0 ? (
  <MediaMessage
    attachments={message.attachments}
    // Sticker Klipy: 1 attachment webp, không văn bản -> giữ giao diện sticker trong suốt cũ
    isSticker={message.attachments.length === 1 && !message.content && message.attachments[0].mimeType === "image/webp"}
  />
) : (
  /* Nội dung văn bản */
  <p className="text-sm font-semibold text-uupm-ink whitespace-pre-wrap break-words leading-relaxed">
    {message.content}
  </p>
)}
```
Thêm import `MediaMessage` ở đầu file. (GIF chat có thể đi kèm caption: khi `content` có text, `isSticker` false → render như ảnh thường, đúng ý đồ.)

- [ ] **Step 4: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: sạch

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chat/components/MediaMessage.tsx frontend/src/features/chat/components/MediaLightbox.tsx frontend/src/features/chat/components/DiscordMessageItem.tsx
git commit -m "feat(frontend): render image/video/file attachments in messages with lightbox"
```

---

## Task 8: Kiểm thử thủ công end-to-end + cập nhật OpenAPI

**Files:**
- Modify: `backend/src/docs/openapi.ts` (thêm path `/upload/chat`)
- Không sửa source khác

**Interfaces:**
- Consumes: toàn bộ pipeline.
- Produces: tài liệu API đầy đủ.

- [ ] **Step 1: Chạy backend + frontend dev, test tay các kịch bản**

Chạy `! cd backend && npm run dev` và `! cd frontend && npm run dev` (user chạy), lần lượt test:
1. Gửi 1 ảnh → thumbnail hiển thị trong preview trước gửi → ảnh trong tin nhắn → click phóng to.
2. Gửi video mp4 → sau khi gửi, `<video>` có poster thumbnail.
3. Gửi file pdf → file card tải xuống.
4. Chọn file >50MB / MIME lạ (exe) → toast chặn phía client.
5. Gửi tin nhắn kèm caption + 2 ảnh.
6. Thu hồi tin nhắn có media → "đã thu hồi".

- [ ] **Step 2: Thêm OpenAPI path `/upload/chat`** (theo pattern các path sẵn có trong `docs/openapi.ts`, multipart requestBody với `files: array<binary>`, response 201 `ChatAttachmentResult[]` — schema `AttachmentResponseSchema` thêm mới với `thumbnailUrl` optional).

- [ ] **Step 3: Chạy toàn bộ test suite**

```bash
cd backend && npx vitest run && npm run type-check
cd ../frontend && npx tsc --noEmit
```
Expected: toàn bộ PASS/sạch

- [ ] **Step 4: Commit**

```bash
git add backend/src/docs/openapi.ts
git commit -m "docs(api): document /upload/chat endpoint"
```

---

## Task 9: Merge & dọn dẹp

- [ ] **Step 1: Báo user kết quả, chờ xác nhận merge** (không tự merge khi user chưa xác nhận tính năng chạy đúng)
- [ ] **Step 2: Sau khi user xác nhận OK**

```bash
git checkout main && git merge --no-ff feat/chat-media-upload -m "merge: chat media upload (image/video/file) feature" && git branch -d feat/chat-media-upload
```
