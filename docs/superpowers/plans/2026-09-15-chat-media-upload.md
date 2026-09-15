# Chat Media Upload (Ảnh/Video/File qua Cloudinary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this codebase task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép người dùng đính kèm ảnh, video và tệp vào tin nhắn chat, preview trước khi gửi, và render đa phương tiện đúng loại trong bubble — upload thẳng lên Cloudinary qua signed direct upload.

**Architecture:** Flow 2 bước — client gọi `POST /api/uploads/sign` (BE check `participants` + ký signature SHA-1), rồi upload thẳng file lên Cloudinary qua XHR (progress % thật), cuối cùng gửi message qua `POST /api/conversations/:id/messages` hiện có (schema chỉ thêm 2 field optional). Video/file lớn không qua backend → không timeout, không cháy RAM.

**Tech Stack:** Express + TypeScript + Mongoose + Socket.IO + Zod (backend, vitest + supertest); React + TypeScript + Zustand + Tailwind (frontend, `tsc --noEmit`). Cloudinary npm (backend only).

**Spec:** `docs/superpowers/specs/2026-09-15-media-upload-design.md`

## Global Constraints

- KHÔNG dùng `EnterWorktree` (cấm theo `.claude/rules/task-routing.md` §7). Làm việc trên branch `feat/chat-media-upload` tạo từ `main`.
- Mọi code sinh mới bắt buộc có chú thích Tiếng Việt (CLAUDE.md — KHÔNG cắt comment để tiết kiệm token).
- Dependency mới chỉ thêm đúng: backend `cloudinary` (npm). FE: KHÔNG thêm package (dùng XHR thô).
- Auth guard tên thực tế là `requireAuth` (không phải `authGuard`), nằm `middlewares/auth.ts`.
- Trường membership là `conversation.participants` (không phải `members`).
- Giới hạn: ảnh 10MB / video 50MB / file 25MB; tối đa 10 tệp/tin nhắn; folder whitelist `^chat/[a-f0-9]{24}$`.
- Frontend không hardcode mã màu; chỉ dùng tokens `uupm-*` hiện có.
- Verification mỗi task backend: `npm run type-check` + `npm test`; frontend: `npx tsc --noEmit`.

---

## Task 0: Khởi tạo branch & commit spec

**Files:**
- Không sửa source — chỉ branch + commit spec đã duyệt.

- [ ] **Step 1: Tạo branch từ main**

```bash
git checkout -b feat/chat-media-upload
```

- [ ] **Step 2: Commit design spec đã cập nhật (requireAuth, participants)**

```bash
git add docs/superpowers/specs/2026-09-15-media-upload-design.md
git commit -m "docs(chat): lock media upload design spec (Cloudinary signed upload)"
```

---

## Task 1: Cloudinary config + env (backend)

**Files:**
- Create: `backend/src/config/cloudinary.ts`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: `CLOUDINARY` object `{ cloudName, apiKey, apiSecret }` đã khởi tạo, sẵn cho Task 3 (service).

- [ ] **Step 1: Viết failing test khởi tạo config**

```ts
// backend/src/config/cloudinary.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { loadEnv } from "../config/env"; // giả sử có loader; nếu không, mock process.env trực tiếp

describe("Cloudinary config", () => {
  afterEach(() => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  it("throws nếu thiếu CLOUDINARY_CLOUD_NAME", () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect(() => require("../config/cloudinary")).toThrow();
  });
});
```

- [ ] **Step 2: Chạy test, kỳ vọng FAIL (file chưa tồn tại)**

```bash
cd backend && npx vitest run src/config/cloudinary.test.ts
```

- [ ] **Step 3: Viết `src/config/cloudinary.ts` (fail-fast nếu thiếu env)**

```ts
// Cấu hình Cloudinary: đọc biến môi trường một lần duy nhất lúc boot.
// Cấm hardcode API_SECRET; thiếu bất kỳ env nào → throw để app fail-fast.
import "dotenv/config";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    "[Cloudinary] Thiếu biến môi trường CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET"
  );
}

// Đối tượng cấu hình dùng chung cho toàn bộ tầng Service khi ký signature.
// KHÔNG chứa logic upload — chỉ metadata + secret cần thiết để tạo SHA-1 signature.
export const CLOUDINARY = {
  cloudName,
  apiKey,
  apiSecret,
} as const;
```

- [ ] **Step 4: Chạy test, kỳ vọng PASS**

```bash
cd backend && npx vitest run src/config/cloudinary.test.ts
```

- [ ] **Step 5: Thêm env vars vào `.env.example`**

```bash
echo "" >> .env.example
echo "# Cloudinary (Signed Direct Upload cho media chat)" >> .env.example
echo "CLOUDINARY_CLOUD_NAME=" >> .env.example
echo "CLOUDINARY_API_KEY=" >> .env.example
echo "CLOUDINARY_API_SECRET=" >> .env.example
```

- [ ] **Step 6: type-check**

```bash
npm run type-check
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/config/cloudinary.ts backend/src/config/cloudinary.test.ts backend/.env.example
git commit -m "feat(cloudinary): add fail-fast config + env example"
```

---

## Task 2: SignUploadSchema (backend, Zero-Trust)

**Files:**
- Create: `backend/src/schemas/upload.schema.ts`
- Test: `backend/src/schemas/upload.schema.test.ts`

**Interfaces:**
- Produces: `SignUploadSchema` (Zod) dùng trong Task 4 (route). Shape: `{ resourceType: 'image'|'video'|'raw', folder: string }`, `.strict()`.

- [ ] **Step 1: Viết failing test**

```ts
import { describe, it, expect } from "vitest";
import { SignUploadSchema } from "./upload.schema";

describe("SignUploadSchema", () => {
  it("accept hợp lệ", () => {
    const r = SignUploadSchema.safeParse({ resourceType: "image", folder: "chat/64f6c0a1e1b2c3d4e5f60718" });
    expect(r.success).toBe(true);
  });

  it("reject resourceType 'exe'", () => {
    const r = SignUploadSchema.safeParse({ resourceType: "exe", folder: "chat/64f6c0a1e1b2c3d4e5f60718" });
    expect(r.success).toBe(false);
  });

  it("reject folder sai regex", () => {
    const r = SignUploadSchema.safeParse({ resourceType: "raw", folder: "avatar/123" });
    expect(r.success).toBe(false);
  });

  it("reject field lạ (strict)", () => {
    const r = SignUploadSchema.safeParse({ resourceType: "image", folder: "chat/64f6c0a1e1b2c3d4e5f60718", extra: 1 });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, kỳ vọng FAIL**

```bash
cd backend && npx vitest run src/schemas/upload.schema.test.ts
```

- [ ] **Step 3: Viết schema**

```ts
import { z } from "zod";

// Schema xác thực yêu cầu ký upload (Zero-Trust).
// Chỉ chấp nhận 3 loại resource Cloudinary: image / video / raw (file).
// folder bắt buộc khớp whitelist: chỉ được upload vào thư mục chat/<ObjectId>,
// ngăn chặn upload vào thư mục avatar/banner hay bất kỳ path nào khác.
// .strict() chặn Mass Assignment — từ chối mọi field không khai báo.
export const SignUploadSchema = z
  .object({
    resourceType: z.enum(["image", "video", "raw"]),
    folder: z.string().regex(/^chat\/[a-f0-9]{24}$/, "Folder phải có dạng chat/<ObjectId>"),
  })
  .strict();

export type SignUploadDTO = z.infer<typeof SignUploadSchema>;
```

- [ ] **Step 4: Chạy test, kỳ vọng PASS**

```bash
cd backend && npx vitest run src/schemas/upload.schema.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/schemas/upload.schema.ts backend/src/schemas/upload.schema.test.ts
git commit -m "feat(upload): add SignUploadSchema (Zero-Trust, strict)"
```

---

## Task 3: upload.service.ts — ký signature (backend)

**Files:**
- Create: `backend/src/services/upload.service.ts`
- Test: `backend/src/services/upload.service.test.ts`

**Interfaces:**
- Consumes: `CLOUDINARY` (Task 1), `conversationRepository.findById` (model sẵn có).
- Produces: `signUpload(userId, dto) => SignedParams` dùng trong Task 4 (controller).
  - `SignedParams = { cloudName, apiKey, timestamp: number, folder, resourceType, maxFileSize: number, signature: string }`

- [ ] **Step 1: Viết failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";

// mock repo trước khi import service
vi.mock("../repositories/conversation.repository", () => ({
  conversationRepository: {
    // participant khớp userId
    findById: vi.fn().mockResolvedValue({ participants: [{ toString: () => "u1" }] }),
  },
}));

const { signUpload } = await import("../services/upload.service");
const { CLOUDINARY } = await import("../config/cloudinary");

describe("signUpload", () => {
  it("trả đủ 7 field + signature đúng SHA-1", async () => {
    const folder = "chat/64f6c0a1e1b2c3d4e5f60718";
    const res = await signUpload("u1", { resourceType: "image", folder });
    expect(res.cloudName).toBe(CLOUDINARY.cloudName);
    expect(res.apiKey).toBe(CLOUDINARY.apiKey);
    expect(res.folder).toBe(folder);
    expect(res.resourceType).toBe("image");
    expect(res.maxFileSize).toBe(10 * 1024 * 1024);
    // verify signature = SHA1(sorted "folder=<f>&resource_type=<rt>&timestamp=<t>&max_file_size=<m>" + secret)
    const str = `folder=${res.folder}&max_file_size=${res.maxFileSize}&resource_type=${res.resourceType}&timestamp=${res.timestamp}${CLOUDINARY.apiSecret}`;
    expect(res.signature).toBe(crypto.createHash("sha1").update(str).digest("hex"));
  });

  it("throw ForbiddenError nếu không phải participant", async () => {
    const { conversationRepository } = await import("../repositories/conversation.repository");
    (conversationRepository.findById as any).mockResolvedValueOnce({ participants: [{ toString: () => "other" }] });
    const { signUpload: su2 } = await import("../services/upload.service");
    await expect(su2("u1", { resourceType: "raw", folder: "chat/64f6c0a1e1b2c3d4e5f60718" })).rejects.toThrow("thành viên");
  });
});
```

- [ ] **Step 2: Chạy test, kỳ vọng FAIL**

```bash
cd backend && npx vitest run src/services/upload.service.test.ts
```

- [ ] **Step 3: Viết service**

```ts
import crypto from "node:crypto";
import { CLOUDINARY } from "../config/cloudinary";
import { conversationRepository } from "../repositories/conversation.repository";
import { ForbiddenError, NotFoundError } from "../core/errors";
import type { SignUploadDTO } from "../schemas/upload.schema";

// Giới hạn kích thước theo từng loại resource (bytes) — nhúng vào signature
// để Cloudinary từ chối file quá cỡ ở tầng storage (FE bypass cũng vô ích).
const MAX_SIZE: Record<SignUploadDTO["resourceType"], number> = {
  image: 10 * 1024 * 1024,   // 10MB
  video: 50 * 1024 * 1024,   // 50MB
  raw:   25 * 1024 * 1024,   // 25MB
};

export interface SignedParams {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  resourceType: SignUploadDTO["resourceType"];
  maxFileSize: number;
  signature: string;
}

/**
 * Ký tham số upload cho Cloudinary (Signed Direct Upload).
 * @param userId - ID người gọi, dùng để check membership conversation.
 * @param dto - { resourceType, folder } đã qua validate (Zero-Trust).
 * @returns Tham số đã ký sẵn để FE upload thẳng lên Cloudinary.
 * @throws NotFoundError nếu conversation không tồn tại.
 * @throws ForbiddenError nếu user không nằm trong participants.
 */
export async function signUpload(userId: string, dto: SignUploadDTO): Promise<SignedParams> {
  // Bước 1: Lấy conversation từ folder (ObjectId nằm sau "chat/").
  const conversationId = dto.folder.split("/")[1];
  const conversation = await conversationRepository.findById(conversationId);
  if (!conversation) {
    throw new NotFoundError("Không tìm thấy cuộc trò chuyện");
  }

  // Bước 2: Chỉ thành viên mới được upload vào thư mục chat này (Zero-Trust).
  const isMember = conversation.participants.some(
    (p: any) => (p?.toString?.() ?? String(p)) === userId
  );
  if (!isMember) {
    throw new ForbiddenError("Bạn không phải thành viên của cuộc trò chuyện này");
  }

  // Bước 3: Sinh timestamp + max_file_size, ký SHA-1 theo thứ tự key tăng dần.
  const timestamp = Math.floor(Date.now() / 1000);
  const maxFileSize = MAX_SIZE[dto.resourceType];
  const paramsToSign = {
    folder: dto.folder,
    max_file_size: maxFileSize,
    resource_type: dto.resourceType,
    timestamp,
  };
  const sorted = Object.keys(paramsToSign)
    .sort()
    .map((k) => `${k}=${paramsToSign[k as keyof typeof paramsToSign]}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(sorted + CLOUDINARY.apiSecret)
    .digest("hex");

  return {
    cloudName: CLOUDINARY.cloudName,
    apiKey: CLOUDINARY.apiKey,
    timestamp,
    folder: dto.folder,
    resourceType: dto.resourceType,
    maxFileSize,
    signature,
  };
}
```

- [ ] **Step 4: Chạy test, kỳ vọng PASS**

```bash
cd backend && npx vitest run src/services/upload.service.test.ts
```

- [ ] **Step 5: type-check**

```bash
npm run type-check
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/upload.service.ts backend/src/services/upload.service.test.ts
git commit -m "feat(upload): signUpload service (membership check + SHA-1 signature)"
```

---

## Task 4: upload.controller + upload.routes (backend)

**Files:**
- Create: `backend/src/controllers/upload.controller.ts`
- Create: `backend/src/routes/upload.routes.ts`
- Modify: `backend/src/routes/index.ts` (thêm `apiRouter.use("/uploads", uploadRoutes)`)

**Interfaces:**
- Consumes: `SignUploadSchema` (Task 2), `signUpload` (Task 3), `requireAuth` (sẵn có).
- Produces: `POST /api/uploads/sign` trả `{ success:true, data: SignedParams }`.

- [ ] **Step 1: Viết controller**

```ts
import { Request, Response, NextFunction } from "express";
import { signUpload } from "../services/upload.service";
import type { SignUploadDTO } from "../schemas/upload.schema";

/**
 * [POST /api/uploads/sign]
 * Trả về tham số đã ký để client upload thẳng lên Cloudinary.
 * Yêu cầu xác thực (requireAuth) + body đã qua validate(SignUploadSchema).
 * 200 OK: { success:true, data: SignedParams }
 */
export const uploadController = {
  async sign(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const dto = req.body as SignUploadDTO;
      const data = await signUpload(userId, dto);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
```

- [ ] **Step 2: Viết routes**

```ts
import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { validate } from "../middlewares/validate";
import { requireAuth } from "../middlewares/auth";
import { SignUploadSchema } from "../schemas/upload.schema";

const router = Router();

// Mọi tuyến upload đều yêu cầu JWT hợp lệ.
router.use(requireAuth);

/**
 * [POST /api/uploads/sign]
 * Cấp chữ ký upload Cloudinary cho 1 file (image/video/raw).
 */
router.post("/sign", validate(SignUploadSchema), uploadController.sign);

export const uploadRoutes = router;
```

- [ ] **Step 3: Đăng ký route trong index.ts** (thêm dòng sau dòng `conversations`)

```ts
import { uploadRoutes } from "./upload.routes";
// ...
apiRouter.use("/uploads", uploadRoutes);
```

- [ ] **Step 4: Viết integration test (supertest)**

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { app } from "../app"; // express app đã khởi tạo (không listen)

vi.mock("../repositories/conversation.repository", () => ({
  conversationRepository: { findById: vi.fn().mockResolvedValue({ participants: [{ toString: () => "u1" }] }) },
}));

describe("POST /api/uploads/sign", () => {
  const token = "Bearer <valid-jwt-for-u1>"; // dùng helper tạo token test nếu có
  it("401 nếu thiếu token", async () => {
    const res = await request(app).post("/api/uploads/sign").send({ resourceType: "image", folder: "chat/64f6c0a1e1b2c3d4e5f60718" });
    expect(res.status).toBe(401);
  });
  it("400 nếu resourceType sai", async () => {
    const res = await request(app).post("/api/uploads/sign").set("Authorization", token).send({ resourceType: "exe", folder: "chat/64f6c0a1e1b2c3d4e5f60718" });
    expect(res.status).toBe(400);
  });
  it("403 nếu không phải thành viên", async () => {
    const { conversationRepository } = await import("../repositories/conversation.repository");
    (conversationRepository.findById as any).mockResolvedValueOnce({ participants: [{ toString: () => "other" }] });
    const res = await request(app).post("/api/uploads/sign").set("Authorization", token).send({ resourceType: "image", folder: "chat/64f6c0a1e1b2c3d4e5f60718" });
    expect(res.status).toBe(403);
  });
  it("200 + 7 field nếu hợp lệ", async () => {
    const res = await request(app).post("/api/uploads/sign").set("Authorization", token).send({ resourceType: "image", folder: "chat/64f6c0a1e1b2c3d4e5f60718" });
    expect(res.status).toBe(200);
    expect(res.body.data.signature).toBeTypeOf("string");
    expect(Object.keys(res.body.data).sort()).toEqual(["apiKey","cloudName","folder","maxFileSize","resourceType","signature","timestamp"].sort());
  });
});
```

- [ ] **Step 5: Chạy test + type-check**

```bash
cd backend && npx vitest run src/routes/upload.routes.test.ts && npm run type-check
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/upload.controller.ts backend/src/routes/upload.routes.ts backend/src/routes/upload.routes.test.ts backend/src/routes/index.ts
git commit -m "feat(upload): add /api/uploads/sign endpoint (auth + validate + controller)"
```

---

## Task 5: Mở rộng model + SendMessageSchema (backend)

**Files:**
- Modify: `backend/src/models/message.model.ts` (thêm `thumbnailUrl?`, `publicId?` vào `IAttachment`)
- Modify: `backend/src/schemas/message.schema.ts` (thêm 2 field optional vào `AttachmentSchema`)

**Interfaces:**
- Produces: `IAttachment.thumbnailUrl?`, `IAttachment.publicId?`; `AttachmentSchema` chấp nhận 2 field mới.

- [ ] **Step 1: Sửa `IAttachment`** (file `message.model.ts`, interface ~dòng 3-8)

```ts
// Trường attachment đính kèm trong tin nhắn (ảnh/video/file).
export interface IAttachment {
  url: string;          // URL file trên Cloudinary
  name: string;         // Tên file gốc
  size: number;         // Kích thước bytes
  mimeType: string;     // MIME type
  thumbnailUrl?: string; // Poster frame video do Cloudinary trả (thumbnail_url)
  publicId?: string;    // Định danh file trên Cloudinary (dùng xoá sau này)
}
```

- [ ] **Step 2: Sửa `AttachmentSchema`** (file `message.schema.ts`, ~dòng 15-20)

```ts
// Mỗi attachment phải khớp hợp đồng: url + name + size + mimeType bắt buộc,
// thumbnailUrl/publicId optional (chỉ có với video / khi cần xoá sau).
export const AttachmentSchema = z.object({
  url: z.string().url(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  mimeType: z.string(),
  thumbnailUrl: z.string().url().optional(),
  publicId: z.string().optional(),
});
```

- [ ] **Step 3: type-check**

```bash
cd backend && npm run type-check
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/message.model.ts backend/src/schemas/message.schema.ts
git commit -m "feat(message): extend Attachment with thumbnailUrl + publicId (optional, backward-compatible)"
```

---

## Task 6: Extension FE types (frontend)

**Files:**
- Modify: `frontend/src/types/chat.types.ts` (thêm `thumbnailUrl?`, `publicId?` vào `MessageAttachment`)

**Interfaces:**
- Produces: `MessageAttachment.thumbnailUrl?`, `MessageAttachment.publicId?` — dùng trong Task 7, 9, 10.

- [ ] **Step 1: Sửa interface `MessageAttachment`** (~dòng 17-22)

```ts
// Đối tượng attachment đính kèm trong tin nhắn (FE ↔ BE khớp hợp đồng).
export interface MessageAttachment {
  url: string;          // URL file trên Cloudinary
  name: string;         // Tên file gốc
  size: number;         // Dung lượng bytes
  mimeType: string;     // Loại MIME
  thumbnailUrl?: string; // Poster video (Cloudinary thumbnail_url)
  publicId?: string;    // Định danh file trên Cloudinary
}
```

- [ ] **Step 2: type-check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/chat.types.ts
git commit -m "feat(chat-types): add thumbnailUrl + publicId to MessageAttachment"
```

---

## Task 7: useMediaUpload hook (frontend, headless)

**Files:**
- Create: `frontend/src/features/chat/hooks/useMediaUpload.ts`

**Interfaces:**
- Consumes: `MessageAttachment` (Task 6), env `VITE_API_BASE_URL` (axios instance sẵn có).
- Produces: hook `useMediaUpload()` → `{ items, pickFiles, removeItem, uploadAll, clear, isUploading }`.
  - `UploadItem = { id, file, status, progress, attachment?, error? }`
  - `uploadAll(): Promise<MessageAttachment[]>`

- [ ] **Step 1: Định nghĩa constants + helper**

```ts
// Bảng giới hạn MIME / kích thước theo đúng spec §3.
const LIMITS = {
  image: { mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"], max: 10 * 1024 * 1024 },
  video: { mimes: ["video/mp4", "video/webm", "video/quicktime"], max: 50 * 1024 * 1024 },
  raw:   { mimes: ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation","application/zip","application/x-rar-compressed","application/x-7z-compressed","text/plain","text/csv"], max: 25 * 1024 * 1024 },
} as const;
const MAX_FILES = 10;
```

- [ ] **Step 2: Viết hàm `classify(file)`** — suy ra `image|video|raw` từ MIME.

- [ ] **Step 3: Viết hook hoàn chỉnh**

```ts
import { useCallback, useRef, useState } from "react";
import { api } from "../../../lib/api"; // axios instance sẵn có trong dự án
import type { MessageAttachment } from "../../../types/chat.types";

export type UploadStatus = "queued" | "uploading" | "done" | "error";

export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;       // 0-100
  attachment?: MessageAttachment;
  error?: string;
}

// Hàm phân loại file thành resource_type Cloudinary.
function classify(file: File): "image" | "video" | "raw" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "raw";
}

/**
 * Hook quản lý upload media (headless): validate, preview queue, upload thẳng Cloudinary.
 * Toàn bộ logic nằm đây, component chỉ render từ `items`.
 */
export function useMediaUpload(conversationId: string) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const xhrs = useRef<Record<string, XMLHttpRequest>>({});

  // Chọn file: validate MIME + size + giới hạn 10 tệp, đẩy vào queue.
  const pickFiles = useCallback((files: FileList | File[]) => {
    setItems((prev) => {
      const room = MAX_FILES - prev.length;
      if (room <= 0) {
        toast.error(`Chỉ được đính kèm tối đa ${MAX_FILES} tệp`);
        return prev;
      }
      const next: UploadItem[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        const kind = classify(file);
        if (!kind) {
          toast.error(`Loại tệp không hỗ trợ: ${file.name}`);
          continue;
        }
        const limit = LIMITS[kind].max;
        if (file.size > limit) {
          toast.error(`Tệp ${file.name} vượt quá ${limit / 1024 / 1024}MB`);
          continue;
        }
        next.push({ id: crypto.randomUUID(), file, status: "queued", progress: 0 });
      }
      return [...prev, ...next];
    });
  }, []);

  // Hủy 1 item (abort XHR nếu đang upload) và xoá khỏi queue.
  const removeItem = useCallback((id: string) => {
    xhrs.current[id]?.abort();
    delete xhrs.current[id];
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Upload 1 file thẳng lên Cloudinary qua XHR (lấy progress thật).
  const uploadOne = (item: UploadItem, sig: SignedParams): Promise<MessageAttachment> =>
    new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", item.file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("folder", sig.folder);
      form.append("resource_type", sig.resourceType);
      form.append("max_file_size", String(sig.maxFileSize));
      form.append("signature", sig.signature);

      const xhr = new XMLHttpRequest();
      xhrs.current[item.id] = xhr;
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const p = Math.round((e.loaded / e.total) * 100);
          setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, progress: p } : i)));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve({
            url: data.secure_url,
            name: item.file.name,
            size: item.file.size,
            mimeType: item.file.type,
            thumbnailUrl: data.thumbnail_url,
            publicId: data.public_id,
          });
        } else {
          reject(new Error(`Upload thất bại (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Lỗi mạng khi upload"));
      xhr.send(form);
    });

  // Upload toàn bộ queue: sign từng loại 1 lần, upload song song, trả attachments.
  const uploadAll = useCallback(async (): Promise<MessageAttachment[]> => {
    if (items.length === 0) return [];
    setIsUploading(true);
    const folder = `chat/${conversationId}`;
    const results: MessageAttachment[] = [];
    try {
      // Group theo resourceType để chỉ sign 1 lần mỗi loại.
      const byKind = new Map<string, UploadItem[]>();
      for (const it of items) {
        const kind = classify(it.file)!;
        byKind.set(kind, [...(byKind.get(kind) ?? []), it]);
      }
      for (const [kind, group] of byKind) {
        const { data: sig } = await api.post("/uploads/sign", { resourceType: kind, folder });
        await Promise.all(
          group.map(async (it) => {
            try {
              const att = await uploadOne(it, sig);
              setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, status: "done", attachment: att } : i)));
              results.push(att);
            } catch (e: any) {
              setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, status: "error", error: e.message } : i)));
            }
          })
        );
      }
    } finally {
      setIsUploading(false);
    }
    return results;
  }, [items, conversationId]);

  const clear = useCallback(() => {
    Object.values(xhrs.current).forEach((x) => x.abort());
    xhrs.current = {};
    setItems([]);
  }, []);

  return { items, pickFiles, removeItem, uploadAll, clear, isUploading };
}
```

> Lưu ý: `toast` import từ thư viện toast dự án (react-hot-toast / sonner tuỳ sẵn có). `SignedParams` là type nội bộ — định nghĩa inline hoặc import từ shared types.

- [ ] **Step 4: type-check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chat/hooks/useMediaUpload.ts
git commit -m "feat(chat): add useMediaUpload hook (validate + signed XHR upload)"
```

---

## Task 8: MediaPreviewChip + MediaPreviewBar (frontend atoms/molecules)

**Files:**
- Create: `frontend/src/features/chat/components/atoms/MediaPreviewChip.tsx`
- Create: `frontend/src/features/chat/components/MediaPreviewBar.tsx`

**Interfaces:**
- Consumes: `UploadItem` (Task 7).
- Produces: `<MediaPreviewChip item onRemove />` + `<MediaPreviewBar items onRemove />`.

- [ ] **Step 1: Viết `MediaPreviewChip.tsx`**

```tsx
import { X } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { UploadItem } from "../hooks/useMediaUpload";

// Chip preview 1 tệp: thumbnail + progress ring + nút huỷ (✕).
export const MediaPreviewChip: React.FC<{ item: UploadItem; onRemove: (id: string) => void }> = ({
  item, onRemove,
}) => {
  const isImg = item.file.type.startsWith("image/");
  return (
    <div className="relative w-16 h-16 rounded-xs border-2 border-uupm-line shadow-uupm-active overflow-hidden shrink-0 bg-uupm-surface">
      {isImg ? (
        <img src={URL.createObjectURL(item.file)} alt={item.file.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] text-uupm-muted text-center px-1">
          {item.file.name.split(".").pop()?.toUpperCase()}
        </div>
      )}
      {/* Lớp phủ progress khi đang upload */}
      {item.status === "uploading" && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold">
          {item.progress}%
        </div>
      )}
      {item.status === "error" && (
        <div className="absolute inset-0 bg-red-600/70 flex items-center justify-center text-white text-[10px]">Lỗi</div>
      )}
      <button
        type="button"
        aria-label="Huỷ tệp"
        onClick={() => onRemove(item.id)}
        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-uupm-ink text-white flex items-center justify-center hover:scale-110"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Viết `MediaPreviewBar.tsx`**

```tsx
import { MediaPreviewChip } from "./atoms/MediaPreviewChip";
import type { UploadItem } from "../hooks/useMediaUpload";

// Dãy chip preview phía trên input, scroll ngang khi nhiều tệp.
export const MediaPreviewBar: React.FC<{ items: UploadItem[]; onRemove: (id: string) => void }> = ({
  items, onRemove,
}) => {
  if (items.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-1" role="list" aria-label="Tệp đính kèm đang chờ gửi">
      {items.map((it) => (
        <MediaPreviewChip key={it.id} item={it} onRemove={onRemove} />
      ))}
    </div>
  );
};
```

- [ ] **Step 3: type-check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/chat/components/atoms/MediaPreviewChip.tsx frontend/src/features/chat/components/MediaPreviewBar.tsx
git commit -m "feat(chat): add MediaPreviewChip + MediaPreviewBar components"
```

---

## Task 9: AttachmentRenderer (frontend organism) + Lightbox

**Files:**
- Create: `frontend/src/features/chat/components/AttachmentRenderer.tsx`
- Create: `frontend/src/features/chat/components/LightboxModal.tsx`

**Interfaces:**
- Consumes: `MessageAttachment` (Task 6).
- Produces: `<AttachmentRenderer attachments onImageClick? />` render 4 UI states (ảnh grid / video / file card / empty + error).

- [ ] **Step 1: Viết `LightboxModal.tsx`** (fullscreen, ←/→/Esc)

```tsx
import { useEffect } from "react";
import { X } from "lucide-react";

// Modal xem ảnh fullscreen, chuyển ảnh bằng ←/→, đóng bằng Esc.
export const LightboxModal: React.FC<{
  images: string[]; index: number; onClose: () => void; onNav: (i: number) => void;
}> = ({ images, index, onClose, onNav }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNav(Math.min(index + 1, images.length - 1));
      if (e.key === "ArrowLeft") onNav(Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [index, images.length, onClose, onNav]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose} role="dialog" aria-modal="true">
      <button aria-label="Đóng" className="absolute top-4 right-4 text-white"><X className="w-6 h-6" /></button>
      <img src={images[index]} alt="" className="max-w-[90vw] max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <div className="absolute bottom-4 text-white text-sm">{index + 1} / {images.length}</div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Viết `AttachmentRenderer.tsx`** (4 states)

```tsx
import { useState } from "react";
import { Download, FileText } from "lucide-react";
import type { MessageAttachment } from "../../types/chat.types";
import { LightboxModal } from "./LightboxModal";

// Render attachments trong bubble tin nhắn theo đúng loại media (4 UI states).
export const AttachmentRenderer: React.FC<{ attachments: MessageAttachment[] }> = ({ attachments }) => {
  const [lightbox, setLightbox] = useState<number | null>(null);
  if (!attachments || attachments.length === 0) return null; // Empty state

  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const videos = attachments.filter((a) => a.mimeType.startsWith("video/"));
  const files = attachments.filter((a) => !a.mimeType.startsWith("image/") && !a.mimeType.startsWith("video/"));

  return (
    <div className="flex flex-col gap-2 mt-2">
      {/* Ảnh: grid ≤4, click mở Lightbox */}
      {images.length > 0 && (
        <div className={cn("grid gap-1", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {images.map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt={img.name}
              loading="lazy"
              onClick={() => setLightbox(i)}
              className="w-full max-w-[240px] rounded-xs border-2 border-uupm-line object-cover cursor-pointer hover:opacity-90"
            />
          ))}
        </div>
      )}
      {lightbox !== null && (
        <LightboxModal images={images.map((i) => i.url)} index={lightbox} onClose={() => setLightbox(null)} onNav={setLightbox} />
      )}

      {/* Video: player có poster */}
      {videos.map((v, i) => (
        <video key={i} controls poster={v.thumbnailUrl} className="w-full max-w-[320px] rounded-xs border-2 border-uupm-line">
          <source src={v.url} type={v.mimeType} />
        </video>
      ))}

      {/* File: card tải xuống */}
      {files.map((f, i) => (
        <a key={i} href={f.url} download={f.name} className="flex items-center gap-2 p-2 rounded-xs border-2 border-uupm-line bg-uupm-surface hover:bg-uupm-accent-soft">
          <FileText className="w-5 h-5 text-uupm-ink shrink-0" />
          <span className="text-sm truncate flex-1">{f.name}</span>
          <span className="text-xs text-uupm-muted">{(f.size / 1024).toFixed(0)}KB</span>
          <Download className="w-4 h-4" />
        </a>
      ))}
    </div>
  );
};
```

- [ ] **Step 3: type-check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/chat/components/AttachmentRenderer.tsx frontend/src/features/chat/components/LightboxModal.tsx
git commit -m "feat(chat): add AttachmentRenderer (image grid/video/file) + LightboxModal"
```

---

## Task 10: Gắn AttachmentRenderer vào DiscordMessageItem

**Files:**
- Modify: `frontend/src/features/chat/components/DiscordMessageItem.tsx` (~dòng 128-146)

**Interfaces:**
- Consumes: `AttachmentRenderer` (Task 9).
- Produces: bubble hiển thị đa phương tiện + text đồng thời.

- [ ] **Step 1: Thay block `<img>` cứng bằng `<AttachmentRenderer />`**

Tìm khối:
```tsx
{message.attachments?.length > 0 && (
  <div className="flex flex-wrap gap-2 mt-1">
    {message.attachments.map((att, i) => (
      <img key={i} src={att.url} alt={att.name} className="w-32 h-32 object-contain rounded" loading="lazy" />
    ))}
  </div>
)}
```
Thay bằng:
```tsx
{message.attachments && message.attachments.length > 0 && (
  <AttachmentRenderer attachments={message.attachments} />
)}
```
Và import: `import { AttachmentRenderer } from "./AttachmentRenderer";` (đầu file).

- [ ] **Step 2: Đảm bảo text + attachments hiển thị đồng thời** (xóa nhánh else ẩn content nếu có).

- [ ] **Step 3: type-check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/chat/components/DiscordMessageItem.tsx
git commit -m "feat(chat): render attachments via AttachmentRenderer in DiscordMessageItem"
```

---

## Task 11: Sửa MessageInput — nút +, preview bar, gửi mixed

**Files:**
- Modify: `frontend/src/features/chat/components/MessageInput.tsx` (nút `+` ~dòng 123-136, container `h-[84px]` ~119, `handleSend` ~95-108)

**Interfaces:**
- Consumes: `useMediaUpload` (Task 7), `MediaPreviewBar` (Task 8).
- Produces: nút `+` mở file picker; drag-drop từ ChatLayout gọi `pickFiles`; gửi `onSendMessage(content, type, attachments)`.

- [ ] **Step 1: Thêm hidden input + hook + preview bar**

```tsx
const [fileInputRef] = useRef<HTMLInputElement>(null);
const { items, pickFiles, removeItem, uploadAll, clear, isUploading } = useMediaUpload(conversationId);

// Nút + mở picker (giữ aria-label cũ)
const openPicker = () => fileInputRef.current?.click();
```

- [ ] **Step 2: Sửa nút `+`** (thay `toast.info(...)` bằng `openPicker()`), thêm `<input type="file" multiple hidden ref={fileInputRef} accept="image/*,video/*,.pdf,..." onChange={(e)=>e.target.files && pickFiles(e.target.files)} />`

- [ ] **Step 3: Sửa `handleSend`** để upload trước khi gửi:

```tsx
const handleSend = async () => {
  if (disabled) return;
  const content = inputValue.trim();
  let attachments: MessageAttachment[] = [];
  if (items.length > 0) {
    if (isUploading) return;
    attachments = await uploadAll();
  }
  if (!content && attachments.length === 0) return;
  // Suy ra type: toàn ảnh → IMAGE, có file/video → FILE, không → TEXT
  const type: Message["type"] = attachments.length === 0
    ? "TEXT"
    : attachments.every((a) => a.mimeType.startsWith("image/")) ? "IMAGE" : "FILE";
  await onSendMessage(content, type, attachments);
  clear();
  setInputValue("");
};
```

- [ ] **Step 4: Render `<MediaPreviewBar>` phía trên input khi `items.length > 0`**; container đổi từ `h-[84px]` cố định sang `min-h-[84px]` + flex-col để chứa preview.

- [ ] **Step 5: Disable nút gửi khi `isUploading`**

- [ ] **Step 6: type-check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/chat/components/MessageInput.tsx
git commit -m "feat(chat): wire + button, preview bar, mixed-content send in MessageInput"
```

---

## Task 12: Drag-drop zone trong ChatLayout

**Files:**
- Modify: `frontend/src/features/chat/components/ChatLayout.tsx` (khối activeConversation ~dòng 244-282, `handleSendMessage` ~118-128)

**Interfaces:**
- Consumes: `useMediaUpload` (Task 7) — hoặc nâng state lên ChatLayout để chia sẻ với MessageInput.
- Produces: kéo-thả file vào vùng chat → `pickFiles`.

- [ ] **Step 1: Nâng `useMediaUpload` lên ChatLayout** (đổi MessageInput nhận props `media` thay vì tự hook), hoặc đơn giản hơn: ChatLayout quản lý drag state + gọi 1 instance hook chung.

> Quyết định: Đưa `useMediaUpload(activeConversationId)` lên `ChatLayout`, truyền `{ items, pickFiles, removeItem, uploadAll, clear, isUploading }` xuống `MessageInput` qua props. Cập nhật Task 11 cho MessageInput nhận props thay tự hook.

- [ ] **Step 2: Thêm overlay drag-drop**

```tsx
const [dragOver, setDragOver] = useState(false);
const media = useMediaUpload(activeConversationId ?? "");

// Bọc quanh khối activeConversation
<div
  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
  onDragLeave={() => setDragOver(false)}
  onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) media.pickFiles(e.dataTransfer.files); }}
>
  {dragOver && <div className="absolute inset-0 z-40 flex items-center justify-center bg-uupm-accent-soft/80 border-4 border-dashed border-uupm-line rounded-xs text-uupm-ink font-bold">Thả tệp để đính kèm</div>}
  {/* ...activeConversation... */}
</div>
```

- [ ] **Step 3: Truyền `media` xuống `<MessageInput media={media} ... />`**

- [ ] **Step 4: type-check + build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chat/components/ChatLayout.tsx frontend/src/features/chat/components/MessageInput.tsx
git commit -m "feat(chat): add drag-drop upload zone in ChatLayout, lift media state"
```

---

## Task 13: Verification tổng hợp & cleanup

**Files:**
- Không sửa — chỉ chạy nghiệm thu theo spec §7.

- [ ] **Step 1: Backend type-check + test**

```bash
cd backend && npm run type-check && npm test
```

- [ ] **Step 2: Frontend type-check + build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 3: Manual checklist (theo spec §7)**
- [ ] Chọn 11 file → toast báo vượt limit, queue dừng ở 10.
- [ ] Chọn `.exe` → loại ở FE validate, không gọi sign.
- [ ] Upload ảnh thật → progress 0→100 → grid ảnh, click mở Lightbox.
- [ ] Gửi video → tab khác nhận `new_message`, thấy poster + play được.
- [ ] Gửi `.pdf` kèm text → `type=FILE`, card download tải đúng.

- [ ] **Step 4: Commit final (nếu có chỉnh sửa nhỏ)**

```bash
git add -A && git commit -m "test(chat): media upload end-to-end verification pass"
```

---

## Self-Review Checklist (đối chiếu spec)

- [x] **Spec §4.1 config** → Task 1 (`cloudinary.ts` fail-fast).
- [x] **Spec §4.2 service** → Task 3 (`signUpload`, membership `participants`, SHA-1, max_file_size).
- [x] **Spec §4.3 controller+routes** → Task 4 (`/api/uploads/sign`, `requireAuth`, `validate`).
- [x] **Spec §4.4 schema** → Task 2 (`SignUploadSchema` strict + regex folder).
- [x] **Spec §4.5 model** → Task 5 (`thumbnailUrl?`, `publicId?` vào IAttachment + AttachmentSchema).
- [x] **Spec §5.1 types** → Task 6 (`MessageAttachment` mở rộng).
- [x] **Spec §5.2 hook** → Task 7 (`useMediaUpload`, XHR, progress).
- [x] **Spec §5.3 atoms/molecules** → Task 8 (`MediaPreviewChip`, `MediaPreviewBar`).
- [x] **Spec §5.4 AttachmentRenderer + Lightbox** → Task 9.
- [x] **Spec §5.4 DiscordMessageItem** → Task 10.
- [x] **Spec §5.5 MessageInput** → Task 11.
- [x] **Spec §5.5 drag-drop ChatLayout** → Task 12.
- [x] **Spec §7 test gate** → Task 13.
- [x] **Global: requireAuth / participants** → áp dụng đúng tên thực tế trong Task 3, 4.
