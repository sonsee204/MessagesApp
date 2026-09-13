# Kế hoạch triển khai: Tải ảnh đại diện & ảnh bìa hồ sơ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép người dùng tải tệp ảnh thật lên làm ảnh đại diện và ảnh bìa trang hồ sơ, rồi thiết kế lại tab "Hồ sơ của tôi" theo bố cục Discord.

**Architecture:** Hai endpoint `POST /api/users/avatar` và `/banner` dùng chung một hạ tầng: `multer` memoryStorage (chặn 5MB) → `sharp` resize/nén sang WEBP → ghi đĩa → cập nhật DB → xoá tệp cũ. Tệp được phục vụ tĩnh dưới `/api/uploads` nằm trong tiền tố `/api` mà Vite đã proxy sẵn, nên ảnh cùng origin với trang. Frontend tách logic gọi API vào hook `useImageUpload`, component trình bày thuần nhận props.

**Tech Stack:** Backend Express 4 + TypeScript + Mongoose 8 + zod + vitest/supertest. Frontend React 18 + Vite 6 + Zustand + react-hook-form + Tailwind (token `--uupm-*`).

**Spec:** `docs/superpowers/specs/2026-09-13-tai-anh-dai-dien-va-anh-bia-design.md`

## Global Constraints

- **Chú thích Tiếng Việt bắt buộc** trên mọi khối code mới/sửa (CLAUDE.md). Không lược bỏ comment để tiết kiệm token.
- **Cấm hardcode mã màu** ở frontend (`frontend.md §3`). Chỉ dùng token `--uupm-*` qua class Tailwind (`bg-uupm-surface`, `text-uupm-ink`, …).
- **Dependency guard**: frontend **không thêm package nào**. Backend chỉ thêm `multer`, `@types/multer` (dev), `sharp`.
- **Frontend không có test runner** (đã xác minh) và dependency guard cấm thêm. Kiểm chứng frontend bằng `npx tsc -b --pretty false` sạch + thao tác tay. **Không** tạo test frontend.
- **Diff-first**: không in lại file >30 dòng; dùng `// ... existing code ...`.
- **Chẩn đoán 1 câu trước khi sửa**; dừng sau 2 lần thất bại liên tiếp ở cùng một lỗi.
- Backend chạy test: `cd backend && npm test`. Typecheck: `cd backend && npx tsc -b --pretty false`.
- Frontend typecheck: `cd frontend && npx tsc -b --pretty false`.
- Route upload **không** đi qua `validate()` (multipart body chỉ có sau multer — spec §2.2).
- Thứ tự ghi/xoá: **ghi tệp mới → cập nhật DB → xoá tệp cũ**. URL cũ đọc từ `req.currentUser` **trước** khi ghi DB.
- Commit message kết thúc bằng: `Co-Authored-By: Claude Code <noreply@anthropic.com>`
- **Không bao giờ** `git add -A` / `git add .` từ gốc repo `D:/`. Chỉ stage từ `D:/appmessaging`, và kiểm `git diff --cached --name-only` trước khi commit.

---

## Cấu trúc tệp

**Backend — tạo mới**

| Tệp | Trách nhiệm |
| --- | --- |
| `backend/src/config/upload.ts` | Hằng số: thư mục, tiền tố URL, trần dung lượng, MIME hợp lệ, hình học từng loại ảnh |
| `backend/src/middlewares/upload.ts` | Multer memoryStorage + lọc mimetype sớm |
| `backend/src/utils/image-storage.ts` | `saveImage` (sharp → WEBP → đĩa) và `deleteImageByUrl` (nuốt lỗi) |
| `backend/tests/user.image.test.ts` | Test 2 endpoint upload qua supertest |
| `backend/tests/utils/image-storage.test.ts` | Test `saveImage` / `deleteImageByUrl` |
| `backend/uploads/.gitkeep` | Giữ thư mục sau khi clone |

**Backend — sửa**

| Tệp | Sửa gì |
| --- | --- |
| `src/middlewares/error-handler.ts` | Thêm nhánh `MulterError` → 400 |
| `src/models/user.model.ts` | Thêm `bannerUrl` |
| `src/repositories/user.repository.ts` | Thêm `updateImage`, mở rộng `Pick` của `updateProfile` |
| `src/schemas/user.schema.ts` | Thêm `bannerUrl` vào `UpdateProfileSchema` |
| `src/controllers/user.controller.ts` | `replaceImage` + `uploadAvatar` + `uploadBanner` |
| `src/routes/user.routes.ts` | 2 route POST |
| `src/app.ts` | Mount tĩnh `/api/uploads` |
| `src/docs/openapi.ts` | Đăng ký 2 path + `bannerUrl` |
| `tests/docs.test.ts` | Số path 26 → 28, số operations 29 → 31 |
| `.gitignore` (gốc) | Bỏ qua `backend/uploads/` trừ `.gitkeep` |

**Frontend — tạo mới**

| Tệp | Trách nhiệm |
| --- | --- |
| `src/features/users/hooks/useImageUpload.ts` | Vòng đời tải ảnh: kiểm tra client → gọi API → `setUser` |
| `src/features/users/components/ImageUploadButton.tsx` | `input[type=file]` ẩn + Button, thuần trình bày |
| `src/features/users/components/ProfileBanner.tsx` | Ảnh bìa + avatar lớn đè lên, thuần trình bày |

**Frontend — sửa**

| Tệp | Sửa gì |
| --- | --- |
| `src/types/auth.types.ts` | Thêm `bannerUrl` |
| `src/features/users/services/user.service.ts` | `uploadAvatar` / `uploadBanner` + `Pick` |
| `src/features/users/schemas/user.schema.ts` | Thêm `bannerUrl`; nới `avatarUrl` + `bannerUrl` nhận `/api/uploads/...` |
| `src/features/users/components/UserProfileForm.tsx` | Bố cục mới + đếm ký tự + nút Lưu theo `isDirty` |

---

### Task 1: Hạ tầng tải tệp + ánh xạ lỗi multer

Gộp phần cài đặt, hằng số, middleware và nhánh lỗi vào một task vì chúng chỉ có nghĩa khi đi cùng nhau — một mình `config/upload.ts` không kiểm chứng được gì.

**Files:**
- Create: `backend/src/config/upload.ts`
- Create: `backend/src/middlewares/upload.ts`
- Create: `backend/tests/upload.middleware.test.ts`
- Modify: `backend/src/middlewares/error-handler.ts` (chèn trước nhánh `// 4. Xử lý lỗi trùng lặp khóa duy nhất`)
- Modify: `backend/package.json` (qua `npm i`)

**Interfaces:**
- Produces: `UPLOAD_DIR: string`, `UPLOAD_URL_PREFIX: string`, `MAX_FILE_SIZE: number`, `ALLOWED_MIME: readonly string[]`, `IMAGE_PRESETS: { avatar: {...}; banner: {...} }`, `upload: multer.Multer` (dùng `upload.single("file")` ở Task 4).

- [x] **Step 1: Cài dependency**

```bash
cd backend
npm i multer sharp
npm i -D @types/multer
```

- [x] **Step 2: Viết test thất bại**

`sharp` tự sinh được ảnh, nên test dựng một app Express tối giản dùng **chính middleware thật** — không cần controller của Task 4.

```ts
// backend/tests/upload.middleware.test.ts
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { upload } from "../src/middlewares/upload";
import { errorHandler } from "../src/middlewares/error-handler";
import { MAX_FILE_SIZE } from "../src/config/upload";

// App tối giản: chỉ gắn middleware upload thật + global error handler thật,
// để cô lập hành vi của tầng tải tệp mà không phụ thuộc controller.
function buildApp() {
  const app = express();
  app.post("/upload", upload.single("file"), (_req, res) => {
    res.status(200).json({ success: true });
  });
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe("Middleware tải tệp (upload)", () => {
  it("trả 400 khi không có tệp", async () => {
    const res = await request(app).post("/upload");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("Vui lòng chọn một tệp ảnh");
  });

  it("trả 400 khi mimetype không phải ảnh được chấp nhận", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("not an image"), {
        filename: "evil.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP");
  });

  it("trả 400 LIMIT_FILE_SIZE (KHÔNG phải 500) khi tệp vượt trần dung lượng", async () => {
    // Đây là test bắt lỗi thiếu nhánh MulterError trong global error handler:
    // MulterError có `code` dạng CHUỖI nên không khớp nhánh nào, sẽ rơi xuống 500 nếu thiếu nhánh.
    const oversized = Buffer.alloc(MAX_FILE_SIZE + 1024);

    const res = await request(app)
      .post("/upload")
      .attach("file", oversized, { filename: "big.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("LIMIT_FILE_SIZE");
    expect(res.body.error.message).toContain("dung lượng cho phép");
  });

  it("trả 200 với ảnh PNG hợp lệ", async () => {
    // Ảnh PNG 1x1 hợp lệ tối thiểu
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
      "base64"
    );

    const res = await request(app)
      .post("/upload")
      .attach("file", png, { filename: "ok.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

- [x] **Step 3: Chạy test để chắc chắn nó thất bại**

Run: `cd backend && npx vitest run tests/upload.middleware.test.ts`
Expected: FAIL — `Cannot find module '../src/middlewares/upload'`

- [x] **Step 4: Tạo `backend/src/config/upload.ts`**

```ts
import path from "path";

/**
 * Cấu hình dùng chung cho toàn bộ luồng tải ảnh lên.
 * Gom về một chỗ để trần dung lượng và hình học từng loại ảnh không bị rải rác
 * giữa middleware, tiện ích xử lý ảnh và controller.
 */

// Thư mục lưu tệp trên đĩa. Cho phép ghi đè qua biến môi trường để test dùng thư mục tạm.
export const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");

// Tiền tố URL công khai. Nằm DƯỚI /api để hưởng proxy sẵn có của Vite (xem spec §2.1),
// nhờ đó ảnh cùng origin với trang và không cần nới CORS.
export const UPLOAD_URL_PREFIX = "/api/uploads";

// Trần dung lượng mỗi tệp: 5MB
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Các định dạng ảnh được chấp nhận. Đây chỉ là lớp LỌC SỚM theo mimetype do client
// khai báo (có thể giả mạo); lớp xác thực thật là sharp ở utils/image-storage.ts.
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Hình học xử lý của từng loại ảnh.
 * - avatar: cắt vuông (cover) để ảnh chân dung không bị méo.
 * - banner: chỉ thu nhỏ khi vượt ngưỡng (inside) để giữ nguyên bố cục ngang.
 */
export const IMAGE_PRESETS = {
  avatar: { width: 256, height: 256, fit: "cover" as const },
  banner: { width: 1200, height: 400, fit: "inside" as const },
} as const;

export type ImageKind = keyof typeof IMAGE_PRESETS;
```

- [x] **Step 5: Tạo `backend/src/middlewares/upload.ts`**

```ts
import multer from "multer";
import { ALLOWED_MIME, MAX_FILE_SIZE } from "../config/upload";
import { ValidationError } from "../core/errors";

/**
 * Middleware tải tệp lên dùng chung cho cả ảnh đại diện và ảnh bìa.
 *
 * Dùng memoryStorage: giữ tệp trong RAM để chuyển thẳng cho sharp xử lý.
 * Nhờ trần 5MB nên không có rủi ro tràn bộ nhớ, đổi lại tránh được việc ghi
 * tệp rác xuống đĩa rồi phải dọn khi ảnh không giải mã được.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Lớp 1 (rẻ, phản hồi nhanh): từ chối sớm theo mimetype do client khai báo.
    // Giá trị này KHÔNG đáng tin — lớp xác thực thật là sharp, sẽ ném lỗi
    // khi tệp không giải mã được thành ảnh.
    if (!ALLOWED_MIME.includes(file.mimetype as (typeof ALLOWED_MIME)[number])) {
      return cb(new ValidationError("Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP"));
    }
    cb(null, true);
  },
});
```

- [x] **Step 6: Chạy lại test — 2 test mimetype/dung lượng vẫn phải thất bại**

Run: `cd backend && npx vitest run tests/upload.middleware.test.ts`
Expected: test "không có tệp" PASS, test "mimetype" PASS, test `LIMIT_FILE_SIZE` **FAIL** vì nhận 500 thay vì 400, test "PNG hợp lệ" PASS.

- [x] **Step 7: Thêm nhánh lỗi multer vào `error-handler.ts`**

Chèn **ngay trước** dòng `// 4. Xử lý lỗi trùng lặp khóa duy nhất trong MongoDB (E11000 duplicate key error)`:

```ts
  // 4b. Xử lý lỗi tải tệp do multer ném ra.
  // LƯU Ý: MulterError dùng `code` dạng CHUỖI (ví dụ "LIMIT_FILE_SIZE"), không phải
  // mã số 11000 của MongoDB, nên không khớp nhánh nào phía trên. Nếu thiếu nhánh này,
  // tệp quá lớn sẽ bị báo thành lỗi 500 "sự cố nội bộ" thay vì thông báo đúng nguyên nhân.
  // Dùng err.name thay vì instanceof để không phải import multer vào tầng xử lý lỗi.
  if (err.name === "MulterError") {
    const multerErr = err as unknown as { code: string };

    // Ánh xạ mã lỗi multer sang thông điệp tiếng Việt dễ hiểu cho người dùng cuối
    const MULTER_MESSAGES: Record<string, string> = {
      LIMIT_FILE_SIZE: `Tệp vượt quá dung lượng cho phép (tối đa ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
      LIMIT_UNEXPECTED_FILE: "Tên trường tệp không hợp lệ, chỉ chấp nhận trường 'file'",
      LIMIT_FILE_COUNT: "Chỉ được tải lên một tệp mỗi lần",
    };
    const message = MULTER_MESSAGES[multerErr.code] ?? "Tệp tải lên không hợp lệ";

    logger.logError({
      code: multerErr.code,
      statusCode: 400,
      message,
      method,
      path,
      ip,
    });

    res.status(400).json({
      success: false,
      error: {
        code: multerErr.code,
        message,
        details: [],
      },
    });
    return;
  }
```

Và thêm import ở đầu file:

```ts
import { MAX_FILE_SIZE } from "../config/upload";
```

- [x] **Step 8: Chạy test để xác nhận tất cả PASS**

Run: `cd backend && npx vitest run tests/upload.middleware.test.ts`
Expected: PASS cả 4 test.

- [x] **Step 9: Typecheck + chạy toàn bộ test cũ để chắc không vỡ gì**

Run: `cd backend && npx tsc -b --pretty false && npm test`
Expected: typecheck sạch, toàn bộ test hiện có vẫn PASS.

- [x] **Step 10: Commit**

```bash
cd /d/appmessaging
git add backend/package.json backend/package-lock.json \
        backend/src/config/upload.ts backend/src/middlewares/upload.ts \
        backend/src/middlewares/error-handler.ts backend/tests/upload.middleware.test.ts
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
feat(upload): them ha tang tai tep va anh xa loi multer

Them multer memoryStorage (tran 5MB, loc mimetype som) va config/upload.ts
lam nguon chan ly duy nhat cho dung luong + hinh hoc tung loai anh.

Global error handler bo sung nhanh MulterError: multer dung `code` dang CHUOI
(LIMIT_FILE_SIZE) nen truoc day roi xuong nhanh 500, nguoi dung nhan "su co
noi bo" thay vi thong bao tep qua lon.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Tiện ích xử lý và lưu ảnh

**Files:**
- Create: `backend/src/utils/image-storage.ts`
- Test: `backend/tests/utils/image-storage.test.ts`

**Interfaces:**
- Consumes: `UPLOAD_DIR`, `UPLOAD_URL_PREFIX`, `IMAGE_PRESETS`, `ImageKind` từ Task 1.
- Produces:
  - `saveImage(buffer: Buffer, kind: ImageKind, userId: string): Promise<string>` — trả URL công khai dạng `/api/uploads/<tên>.webp`
  - `deleteImageByUrl(url: string | null | undefined): Promise<void>`

- [x] **Step 1: Viết test thất bại**

Test dùng thư mục tạm qua biến môi trường `UPLOAD_DIR` (đã hỗ trợ ở Task 1), và sinh ảnh thật bằng `sharp` để không phải nhúng base64 dài.

```ts
// backend/tests/utils/image-storage.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import sharp from "sharp";

// Trỏ UPLOAD_DIR vào thư mục tạm TRƯỚC khi import module cần dùng nó
const TMP_DIR = path.join(os.tmpdir(), `uupm-upload-test-${Date.now()}`);
process.env.UPLOAD_DIR = TMP_DIR;

const { saveImage, deleteImageByUrl } = await import("../../src/utils/image-storage");

// Sinh một ảnh PNG lớn hơn kích thước preset để kiểm tra việc resize thật sự diễn ra
async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .png()
    .toBuffer();
}

describe("Tiện ích lưu ảnh (image-storage)", () => {
  beforeAll(async () => {
    await fs.mkdir(TMP_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  it("lưu ảnh và trả về URL công khai đúng tiền tố", async () => {
    const png = await makePng(800, 800);

    const url = await saveImage(png, "avatar", "user123");

    expect(url).toMatch(/^\/api\/uploads\/avatar-user123-[0-9a-f]{8}\.webp$/);

    // Tệp phải thật sự tồn tại trên đĩa
    const fileName = path.basename(url);
    const stat = await fs.stat(path.join(TMP_DIR, fileName));
    expect(stat.size).toBeGreaterThan(0);
  });

  it("resize ảnh đại diện về đúng 256x256 và xuất WEBP", async () => {
    const png = await makePng(1000, 600);

    const url = await saveImage(png, "avatar", "user456");
    const outPath = path.join(TMP_DIR, path.basename(url));

    const meta = await sharp(outPath).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(256);
    expect(meta.height).toBe(256);
  });

  it("không phóng to ảnh bìa nhỏ hơn ngưỡng", async () => {
    const small = await makePng(400, 200);

    const url = await saveImage(small, "banner", "user789");
    const meta = await sharp(path.join(TMP_DIR, path.basename(url))).metadata();

    // withoutEnlargement: ảnh nhỏ hơn preset phải giữ nguyên kích thước gốc
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(200);
  });

  it("mỗi lần lưu cho ra URL khác nhau để phá cache trình duyệt", async () => {
    const png = await makePng(300, 300);

    const first = await saveImage(png, "avatar", "sameuser");
    const second = await saveImage(png, "avatar", "sameuser");

    expect(first).not.toBe(second);
  });

  it("ném lỗi khi tệp không giải mã được thành ảnh", async () => {
    const garbage = Buffer.from("day khong phai la anh");

    await expect(saveImage(garbage, "avatar", "userBad")).rejects.toThrow();
  });

  it("xoá đúng tệp theo URL", async () => {
    const url = await saveImage(await makePng(300, 300), "banner", "userDel");
    const outPath = path.join(TMP_DIR, path.basename(url));

    await deleteImageByUrl(url);

    await expect(fs.stat(outPath)).rejects.toThrow();
  });

  it("KHÔNG xoá gì khi URL nằm ngoài thư mục uploads", async () => {
    // Tạo một tệp nằm ngoài UPLOAD_DIR để chắc chắn hàm không chạm tới
    const outsidePath = path.join(os.tmpdir(), `uupm-outside-${Date.now()}.txt`);
    await fs.writeFile(outsidePath, "du lieu quan trong");

    await deleteImageByUrl("/api/uploads/../../../etc/passwd");
    await deleteImageByUrl("https://example.com/anh.png");
    await deleteImageByUrl(null);
    await deleteImageByUrl(undefined);

    // Tệp ngoài thư mục phải còn nguyên
    await expect(fs.stat(outsidePath)).resolves.toBeDefined();
    await fs.rm(outsidePath, { force: true });
  });
});
```

- [x] **Step 2: Chạy test để chắc chắn nó thất bại**

Run: `cd backend && npx vitest run tests/utils/image-storage.test.ts`
Expected: FAIL — `Cannot find module '../../src/utils/image-storage'`

- [x] **Step 3: Tạo `backend/src/utils/image-storage.ts`**

```ts
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { IMAGE_PRESETS, ImageKind, UPLOAD_DIR, UPLOAD_URL_PREFIX } from "../config/upload";
import { ValidationError } from "../core/errors";
import { logger } from "../core/logger";

/**
 * Xử lý ảnh tải lên và lưu xuống đĩa, trả về URL công khai để lưu vào CSDL.
 *
 * sharp vừa resize/nén vừa đóng vai trò lớp XÁC THỰC THẬT SỰ: mimetype do client
 * khai báo có thể giả mạo, nhưng một tệp không giải mã được thành ảnh sẽ khiến
 * sharp ném lỗi — đó mới là bằng chứng đáng tin.
 *
 * @param buffer Nội dung tệp gốc trong RAM (multer memoryStorage cung cấp)
 * @param kind Loại ảnh, quyết định hình học xử lý
 * @param userId ID người dùng, dùng để đặt tên tệp dễ truy vết
 * @returns URL công khai dạng "/api/uploads/<tên tệp>.webp"
 */
export async function saveImage(buffer: Buffer, kind: ImageKind, userId: string): Promise<string> {
  const preset = IMAGE_PRESETS[kind];

  let processed: Buffer;
  try {
    processed = await sharp(buffer)
      .resize(preset.width, preset.height, {
        fit: preset.fit,
        // Không phóng to ảnh nhỏ hơn ngưỡng — phóng to chỉ làm mờ mà không thêm chi tiết
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    // Không giải mã được thành ảnh => tệp không phải ảnh hợp lệ (dù đuôi/mimetype có thể đã giả)
    throw new ValidationError("Tệp tải lên không phải là ảnh hợp lệ hoặc đã bị hỏng");
  }

  // Phần ngẫu nhiên khiến URL ĐỔI mỗi lần thay ảnh. Nhờ đó có thể đặt cache
  // `immutable` ở tầng phục vụ tĩnh mà trình duyệt vẫn lấy được ảnh mới.
  const suffix = crypto.randomBytes(4).toString("hex");
  const fileName = `${kind}-${userId}-${suffix}.webp`;

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), processed);

  return `${UPLOAD_URL_PREFIX}/${fileName}`;
}

/**
 * Xoá tệp ứng với một URL công khai đã lưu trong CSDL.
 *
 * Hàm này KHÔNG BAO GIỜ ném lỗi ra ngoài: nó chạy sau khi thao tác ghi CSDL đã
 * thành công, nên làm hỏng request chỉ vì không dọn được tệp cũ là cái giá quá đắt.
 * Trường hợp xấu nhất là còn lại một tệp rác — chấp nhận được.
 *
 * @param url URL công khai của tệp cần xoá; bỏ qua nếu rỗng hoặc không thuộc thư mục uploads
 */
export async function deleteImageByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;

  // Chốt an toàn: chỉ xử lý URL do chính hệ thống sinh ra. Nếu URL không bắt đầu
  // bằng tiền tố công khai, đó không phải tệp của chúng ta -> không được chạm vào.
  if (!url.startsWith(`${UPLOAD_URL_PREFIX}/`)) return;

  // Lấy đúng tên tệp, loại bỏ mọi thành phần đường dẫn để không thể thoát khỏi UPLOAD_DIR
  const fileName = path.basename(url.slice(UPLOAD_URL_PREFIX.length + 1));
  if (!fileName) return;

  try {
    await fs.unlink(path.join(UPLOAD_DIR, fileName));
  } catch (error) {
    // Chỉ ghi log: tệp có thể đã bị xoá trước đó hoặc không tồn tại. Không làm hỏng request.
    logger.warn(`Không xoá được tệp ảnh cũ: ${fileName}`, error);
  }
}
```

- [x] **Step 4: Chạy test để xác nhận PASS**

Run: `cd backend && npx vitest run tests/utils/image-storage.test.ts`
Expected: PASS cả 7 test.

- [x] **Step 5: Typecheck**

Run: `cd backend && npx tsc -b --pretty false`
Expected: không có output.

- [x] **Step 6: Commit**

```bash
cd /d/appmessaging
git add backend/src/utils/image-storage.ts backend/tests/utils/image-storage.test.ts
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
feat(upload): them tien ich xu ly va luu anh bang sharp

saveImage resize/nen sang WEBP theo preset tung loai anh, bat
withoutEnlargement de khong phong to anh nho. sharp dong vai tro lop xac
thuc that su vi mimetype do client khai bao co the gia mao.

deleteImageByUrl luon nuot loi va chi ghi log: ham chay sau khi ghi CSDL
thanh cong nen khong duoc lam hong request. Chan theo tien to URL va
basename de khong the thoat khoi thu muc uploads.

Ten tep co phan ngau nhien khien URL doi moi lan thay anh, nho do dat
duoc cache immutable ma trinh duyet van lay anh moi.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Trường `bannerUrl` xuyên các tầng dữ liệu

Gộp model + repository + schema vì đây là **một** thay đổi logic ("trường bannerUrl tồn tại") — tách ra sẽ tạo các task nửa vời không kiểm chứng được.

**Files:**
- Modify: `backend/src/models/user.model.ts` (thêm vào `IUser` và `UserSchema`)
- Modify: `backend/src/repositories/user.repository.ts` (interface + class)
- Modify: `backend/src/schemas/user.schema.ts` (thêm vào `UpdateProfileSchema`)
- Test: `backend/tests/models/user.model.test.ts` (tạo mới), `backend/tests/upload.middleware.test.ts` (không đụng)

**Interfaces:**
- Produces:
  - `IUser.bannerUrl?: string`
  - `userRepository.updateImage(id: string, field: "avatarUrl" | "bannerUrl", url: string | null): Promise<IUser | null>`
  - `UpdateProfileSchema` chấp nhận `bannerUrl`

- [x] **Step 1: Viết test thất bại**

Theo convention của `tests/models/` — dùng `validateSync()`, không cần kết nối CSDL.

```ts
// backend/tests/models/user.model.test.ts
import { describe, it, expect } from "vitest";
import { UserModel } from "../../src/models/user.model";
import { UpdateProfileSchema } from "../../src/schemas/user.schema";

describe("UserModel — trường bannerUrl", () => {
  const base = {
    username: "haxuanson",
    email: "user@example.com",
    passwordHash: "hash",
    displayName: "Hà Xuân Sơn",
  };

  it("mặc định bannerUrl là null khi không truyền", () => {
    const doc = new UserModel(base);
    expect(doc.bannerUrl).toBeNull();
  });

  it("nhận giá trị bannerUrl khi được truyền vào", () => {
    const doc = new UserModel({ ...base, bannerUrl: "/api/uploads/banner-u1-abcd1234.webp" });
    expect(doc.bannerUrl).toBe("/api/uploads/banner-u1-abcd1234.webp");
  });
});

describe("UpdateProfileSchema — trường bannerUrl", () => {
  it("chấp nhận URL ảnh bìa hợp lệ", () => {
    const result = UpdateProfileSchema.safeParse({
      body: { bannerUrl: "/api/uploads/banner-u1-abcd1234.webp" },
    });
    expect(result.success).toBe(true);
  });

  it("chấp nhận null để xoá ảnh bìa", () => {
    const result = UpdateProfileSchema.safeParse({ body: { bannerUrl: null } });
    expect(result.success).toBe(true);
  });

  it("từ chối chuỗi không phải URL", () => {
    const result = UpdateProfileSchema.safeParse({ body: { bannerUrl: "khong-phai-url" } });
    expect(result.success).toBe(false);
  });
});
```

Lưu ý: `UpdateProfileSchema` dùng `z.string().url()`, mà zod coi đường dẫn tương đối là **không** hợp lệ. Xem Step 2 để xử lý.

- [x] **Step 2: Chạy test — xác định chính xác hành vi của zod**

Run: `cd backend && npx vitest run tests/models/user.model.test.ts`
Expected: test `bannerUrl mặc định null` **FAIL** (chưa có trường), các test schema có thể FAIL ở case `/api/uploads/...` vì `z.string().url()` từ chối URL tương đối.

**Nếu case URL tương đối thất bại**, đây là quyết định thiết kế bắt buộc: `avatarUrl` hiện tại cũng dùng `z.string().url()` (`backend/src/schemas/user.schema.ts`), nhưng nay cả hai trường sẽ nhận URL **tương đối** do chính backend sinh ra (`/api/uploads/...`). Phải nới cả hai sang kiểm tra chấp nhận cả URL tuyệt đối lẫn đường dẫn nội bộ bắt đầu bằng `/api/uploads/`. Dùng đúng đoạn sau cho **cả `avatarUrl` và `bannerUrl`** ở Step 4.

- [x] **Step 3: Viết lại 2 test schema cho khớp quy tắc mới**

Thay khối `describe("UpdateProfileSchema — trường bannerUrl")` bằng:

```ts
describe("UpdateProfileSchema — trường bannerUrl", () => {
  it("chấp nhận đường dẫn nội bộ do backend sinh ra", () => {
    const result = UpdateProfileSchema.safeParse({
      body: { bannerUrl: "/api/uploads/banner-u1-abcd1234.webp" },
    });
    expect(result.success).toBe(true);
  });

  it("chấp nhận URL tuyệt đối (dữ liệu cũ hoặc ảnh ngoài)", () => {
    const result = UpdateProfileSchema.safeParse({
      body: { bannerUrl: "https://example.com/anh-bia.png" },
    });
    expect(result.success).toBe(true);
  });

  it("chấp nhận null để xoá ảnh bìa", () => {
    const result = UpdateProfileSchema.safeParse({ body: { bannerUrl: null } });
    expect(result.success).toBe(true);
  });

  it("từ chối chuỗi không phải URL lẫn không phải đường dẫn nội bộ", () => {
    const result = UpdateProfileSchema.safeParse({ body: { bannerUrl: "khong-phai-url" } });
    expect(result.success).toBe(false);
  });

  it("avatarUrl cũng chấp nhận đường dẫn nội bộ (không phá vỡ luồng upload mới)", () => {
    const result = UpdateProfileSchema.safeParse({
      body: { avatarUrl: "/api/uploads/avatar-u1-abcd1234.webp" },
    });
    expect(result.success).toBe(true);
  });
});
```

- [x] **Step 4: Sửa `backend/src/schemas/user.schema.ts`**

Thêm hằng số kiểm tra dùng chung ở đầu file, và thay cả `avatarUrl` lẫn thêm `bannerUrl`:

```ts
/**
 * Kiểm tra đường dẫn ảnh hợp lệ.
 * Chấp nhận HAI dạng:
 *  1. URL tuyệt đối (http/https) — ảnh ngoài hoặc dữ liệu cũ do người dùng dán vào.
 *  2. Đường dẫn nội bộ bắt đầu bằng /api/uploads/ — do chính backend sinh ra sau khi
 *     xử lý tệp tải lên. z.string().url() thuần sẽ TỪ CHỐI dạng này vì nó là đường dẫn
 *     tương đối, nên phải kiểm tra riêng.
 */
const imagePathSchema = z
  .string()
  .refine(
    (val) => /^https?:\/\/\S+$/.test(val) || val.startsWith("/api/uploads/"),
    "Đường dẫn ảnh không hợp lệ"
  );
```

Trong `UpdateProfileSchema`, thay `avatarUrl` và thêm `bannerUrl` ngay sau nó:

```ts
    avatarUrl: imagePathSchema.nullable().optional(),
    // Ảnh bìa trang hồ sơ; null nghĩa là xoá về nền mặc định
    bannerUrl: imagePathSchema.nullable().optional(),
```

- [x] **Step 5: Sửa `backend/src/models/user.model.ts`**

Thêm `bannerUrl?: string;` vào `IUser` ngay sau `avatarUrl?: string;`, và thêm vào `UserSchema` ngay sau khối `avatarUrl`:

```ts
    // Ảnh bìa trang hồ sơ; null = dùng nền mặc định
    bannerUrl: {
      type: String,
      default: null,
    },
```

- [x] **Step 6: Sửa `backend/src/repositories/user.repository.ts`**

Mở rộng `Pick` trong interface **và** trong class (cả hai chỗ):

```ts
  updateProfile(id: string, data: Partial<Pick<IUser, "displayName" | "avatarUrl" | "bannerUrl" | "bio" | "statusMessage">>): Promise<IUser | null>;
```

```ts
  async updateProfile(
    id: string,
    data: Partial<Pick<IUser, "displayName" | "avatarUrl" | "bannerUrl" | "bio" | "statusMessage">>
  ): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }
```

Thêm method mới vào interface:

```ts
  /** Cập nhật riêng ảnh đại diện hoặc ảnh bìa sau khi tệp đã lưu thành công */
  updateImage(id: string, field: "avatarUrl" | "bannerUrl", url: string | null): Promise<IUser | null>;
```

và vào class:

```ts
  /**
   * Cập nhật riêng một trường ảnh (avatarUrl hoặc bannerUrl).
   * Tách khỏi updateProfile vì luồng tải ảnh không đi qua middleware validate,
   * và cần đọc URL cũ trước đó để dọn tệp.
   */
  async updateImage(
    id: string,
    field: "avatarUrl" | "bannerUrl",
    url: string | null
  ): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, { $set: { [field]: url } }, { new: true }).exec();
  }
```

- [x] **Step 7: Chạy test để xác nhận PASS**

Run: `cd backend && npx vitest run tests/models/user.model.test.ts`
Expected: PASS cả 7 test.

- [x] **Step 8: Chạy toàn bộ test + typecheck**

Run: `cd backend && npx tsc -b --pretty false && npm test`
Expected: typecheck sạch, toàn bộ test PASS. **Đặc biệt chú ý `tests/docs.test.ts`** — nếu đỏ ở đây là do Task 6 chưa làm, không phải lỗi của task này.

- [x] **Step 9: Commit**

```bash
cd /d/appmessaging
git add backend/src/models/user.model.ts backend/src/repositories/user.repository.ts \
        backend/src/schemas/user.schema.ts backend/tests/models/user.model.test.ts
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
feat(user): them truong bannerUrl xuyen cac tang du lieu

Model, repository (updateImage) va UpdateProfileSchema deu biet den bannerUrl.

Noi avatarUrl va bannerUrl sang imagePathSchema: z.string().url() thuan
TU CHOI duong dan noi bo /api/uploads/... do chinh backend sinh ra. Quy tac
moi chap nhan ca URL tuyet doi lan duong dan noi bo, neu khong luong upload
moi se bi chinh schema cua minh chan lai.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Hai endpoint tải ảnh

**Files:**
- Modify: `backend/src/controllers/user.controller.ts`
- Modify: `backend/src/routes/user.routes.ts`
- Test: `backend/tests/user.image.test.ts` (tạo mới)

**Interfaces:**
- Consumes: `saveImage`/`deleteImageByUrl` (Task 2), `updateImage` (Task 3), `upload` (Task 1), `ImageKind` (Task 1).
- Produces: `POST /api/users/avatar` và `POST /api/users/banner`, cả hai nhận `multipart/form-data` với trường tên `file`, trả `{ success: true, data: <user> }`.

- [x] **Step 1: Viết test thất bại**

Dùng đúng convention của `tests/auth.test.ts`: `createApp()` + `generateAccessToken` + `vi.spyOn(userRepository, ...)`. Vì `requireAuth` tra CSDL qua `userRepository.findById`, phải spy method này.

```ts
// backend/tests/user.image.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import sharp from "sharp";
import { createApp } from "../src/app";
import { userRepository } from "../src/repositories/user.repository";
import { IUser } from "../src/models/user.model";
import { generateAccessToken } from "../src/utils/auth";

// Dùng thư mục tạm để không ghi rác vào backend/uploads khi chạy test
const TMP_DIR = path.join(os.tmpdir(), `uupm-user-image-${Date.now()}`);
process.env.UPLOAD_DIR = TMP_DIR;

const app = createApp();
const uploadsDir = () => TMP_DIR;

function authHeader() {
  return `Bearer ${generateAccessToken({
    userId: "user_image_1",
    username: "haxuanson",
    email: "user@example.com",
  })}`;
}

function mockUser(overrides: Partial<IUser> = {}): IUser {
  return {
    id: "user_image_1",
    _id: "user_image_1",
    username: "haxuanson",
    email: "user@example.com",
    displayName: "Hà Xuân Sơn",
    avatarUrl: null,
    bannerUrl: null,
    bio: "",
    statusMessage: "",
    role: "USER",
    isOnline: false,
    ...overrides,
  } as unknown as IUser;
}

async function makePng(width = 600, height = 600): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
}

/** Danh sách tên tệp hiện có trong thư mục uploads của bài test */
async function listUploads(): Promise<string[]> {
  try {
    return await fs.readdir(uploadsDir());
  } catch {
    return [];
  }
}

describe("POST /api/users/avatar và /api/users/banner", () => {
  beforeAll(async () => {
    await fs.mkdir(TMP_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("trả 401 khi không có Access Token", async () => {
    const res = await request(app)
      .post("/api/users/avatar")
      .attach("file", await makePng(), { filename: "a.png", contentType: "image/png" });

    expect(res.status).toBe(401);
  });

  it("trả 400 khi không đính kèm tệp", async () => {
    vi.spyOn(userRepository, "findById").mockResolvedValue(mockUser());

    const res = await request(app).post("/api/users/avatar").set("Authorization", authHeader());

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("Vui lòng chọn một tệp ảnh");
  });

  it("tải ảnh đại diện thành công, trả URL và ghi tệp thật lên đĩa", async () => {
    vi.spyOn(userRepository, "findById").mockResolvedValue(mockUser());
    const updateSpy = vi
      .spyOn(userRepository, "updateImage")
      .mockImplementation(async (_id, field, url) => mockUser({ [field]: url } as Partial<IUser>));

    const res = await request(app)
      .post("/api/users/avatar")
      .set("Authorization", authHeader())
      .attach("file", await makePng(), { filename: "a.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.avatarUrl).toMatch(/^\/api\/uploads\/avatar-user_image_1-[0-9a-f]{8}\.webp$/);
    expect(updateSpy).toHaveBeenCalledWith("user_image_1", "avatarUrl", expect.any(String));

    // Tệp phải thật sự nằm trên đĩa
    const files = await listUploads();
    expect(files).toContain(path.basename(res.body.data.avatarUrl));
  });

  it("thay ảnh lần hai thì xoá tệp cũ và giữ lại tệp mới", async () => {
    const oldUrl = "/api/uploads/avatar-user_image_1-deadbeef.webp";
    // Tạo sẵn tệp "cũ" để kiểm tra nó bị dọn
    await fs.writeFile(path.join(TMP_DIR, path.basename(oldUrl)), Buffer.from("anh cu"));

    vi.spyOn(userRepository, "findById").mockResolvedValue(mockUser({ avatarUrl: oldUrl }));
    vi.spyOn(userRepository, "updateImage").mockImplementation(async (_id, field, url) =>
      mockUser({ [field]: url } as Partial<IUser>)
    );

    const res = await request(app)
      .post("/api/users/avatar")
      .set("Authorization", authHeader())
      .attach("file", await makePng(), { filename: "b.png", contentType: "image/png" });

    expect(res.status).toBe(200);

    const files = await listUploads();
    expect(files).not.toContain(path.basename(oldUrl)); // tệp cũ đã bị xoá
    expect(files).toContain(path.basename(res.body.data.avatarUrl)); // tệp mới còn nguyên
  });

  it("KHÔNG mất ảnh cũ khi bước ghi CSDL thất bại", async () => {
    // Đây là test bảo vệ thứ tự ghi-tệp-trước-xoá-tệp-sau (spec §3.6)
    const oldUrl = "/api/uploads/avatar-user_image_1-cafe1234.webp";
    await fs.writeFile(path.join(TMP_DIR, path.basename(oldUrl)), Buffer.from("anh cu"));

    vi.spyOn(userRepository, "findById").mockResolvedValue(mockUser({ avatarUrl: oldUrl }));
    vi.spyOn(userRepository, "updateImage").mockRejectedValue(new Error("CSDL lỗi"));

    const res = await request(app)
      .post("/api/users/avatar")
      .set("Authorization", authHeader())
      .attach("file", await makePng(), { filename: "c.png", contentType: "image/png" });

    expect(res.status).toBe(500);

    // Ảnh cũ PHẢI còn trên đĩa vì CSDL chưa hề trỏ sang ảnh mới
    const files = await listUploads();
    expect(files).toContain(path.basename(oldUrl));
  });

  it("tải ảnh bìa thành công với hình học của preset banner", async () => {
    vi.spyOn(userRepository, "findById").mockResolvedValue(mockUser());
    vi.spyOn(userRepository, "updateImage").mockImplementation(async (_id, field, url) =>
      mockUser({ [field]: url } as Partial<IUser>)
    );

    const res = await request(app)
      .post("/api/users/banner")
      .set("Authorization", authHeader())
      .attach("file", await makePng(2000, 800), { filename: "b.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.data.bannerUrl).toMatch(/^\/api\/uploads\/banner-user_image_1-[0-9a-f]{8}\.webp$/);

    const meta = await sharp(path.join(TMP_DIR, path.basename(res.body.data.bannerUrl))).metadata();
    expect(meta.width).toBe(1200);
  });
});
```

- [x] **Step 2: Chạy test để chắc chắn nó thất bại**

Run: `cd backend && npx vitest run tests/user.image.test.ts`
Expected: FAIL — 404 vì 2 route chưa tồn tại.

- [x] **Step 3: Thêm vào `backend/src/controllers/user.controller.ts`**

Thêm import:

```ts
import { saveImage, deleteImageByUrl } from "../utils/image-storage";
import { ImageKind } from "../config/upload";
import { ValidationError } from "../core/errors";
```

(`ValidationError` gộp vào dòng import `../core/errors` đang có sẵn: `import { NotFoundError, UnauthorizedError, ValidationError } from "../core/errors";`)

Thêm 3 method vào class `UserController`:

```ts
  /**
   * Xử lý chung cho cả ảnh đại diện và ảnh bìa — một luồng, hai tham số hình học.
   *
   * THỨ TỰ BẮT BUỘC: ghi tệp mới -> cập nhật CSDL -> mới xoá tệp cũ.
   * Nếu xoá trước mà bước CSDL thất bại, người dùng MẤT ẢNH HOÀN TOÀN.
   * Làm đúng thứ tự này thì trường hợp xấu nhất chỉ là còn lại một tệp rác.
   *
   * Phản hồi HTTP 200 OK kèm hồ sơ người dùng đã cập nhật.
   */
  private async replaceImage(
    req: Request,
    res: Response,
    next: NextFunction,
    kind: ImageKind
  ): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Kiểm tra tệp đến từ middleware multer hay không
      if (!req.file) {
        throw new ValidationError("Vui lòng chọn một tệp ảnh");
      }

      // Đọc URL CŨ trước khi ghi CSDL — sau khi ghi thì giá trị này đã bị thay
      const field = kind === "avatar" ? "avatarUrl" : "bannerUrl";
      const previousUrl = req.currentUser ? (req.currentUser[field] as string | null) : null;

      // Bước 1: xử lý ảnh và ghi tệp mới xuống đĩa
      const newUrl = await saveImage(req.file.buffer, kind, userId);

      // Bước 2: trỏ CSDL sang tệp mới
      const updatedUser = await userRepository.updateImage(userId, field, newUrl);
      if (!updatedUser) {
        throw new NotFoundError("Không tìm thấy người dùng");
      }

      // Bước 3: dọn tệp cũ. Hàm này không bao giờ ném lỗi nên không thể làm hỏng request.
      await deleteImageByUrl(previousUrl);

      res.status(200).json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST /api/users/avatar]
   * Tải lên ảnh đại diện mới (multipart/form-data, trường tên "file")
   * Phản hồi HTTP 200 OK kèm hồ sơ người dùng đã cập nhật
   */
  async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    return this.replaceImage(req, res, next, "avatar");
  }

  /**
   * [POST /api/users/banner]
   * Tải lên ảnh bìa trang hồ sơ (multipart/form-data, trường tên "file")
   * Phản hồi HTTP 200 OK kèm hồ sơ người dùng đã cập nhật
   */
  async uploadBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    return this.replaceImage(req, res, next, "banner");
  }
```

- [x] **Step 4: Thêm 2 route vào `backend/src/routes/user.routes.ts`**

Thêm import:

```ts
import { upload } from "../middlewares/upload";
```

Chèn ngay sau route `change-password` (dòng 25):

```ts
// Tuyến đường tải ảnh đại diện và ảnh bìa lên máy chủ.
// KHÔNG đi qua middleware validate(): với multipart/form-data, req.body chỉ được
// multer điền SAU khi multer chạy, nên validate đứng trước sẽ thấy body rỗng và
// strip sạch dữ liệu. Hai route này cũng không đọc req.body — tệp nằm ở req.file.
router.post("/avatar", upload.single("file"), userController.uploadAvatar);
router.post("/banner", upload.single("file"), userController.uploadBanner);
```

- [x] **Step 5: Chạy test để xác nhận PASS**

Run: `cd backend && npx vitest run tests/user.image.test.ts`
Expected: PASS cả 6 test.

- [x] **Step 6: Chạy toàn bộ test + typecheck**

Run: `cd backend && npx tsc -b --pretty false && npm test`
Expected: PASS (trừ `docs.test.ts` nếu số path chưa cập nhật — Task 6 lo).

- [x] **Step 7: Commit**

```bash
cd /d/appmessaging
git add backend/src/controllers/user.controller.ts backend/src/routes/user.routes.ts \
        backend/tests/user.image.test.ts
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
feat(user): them hai endpoint tai anh dai dien va anh bia

POST /api/users/avatar va /api/users/banner dung chung helper replaceImage
(mot luong, hai tham so hinh hoc).

Thu tu bat buoc ghi tep moi -> cap nhat CSDL -> xoa tep cu, va URL cu doc tu
req.currentUser TRUOC khi ghi CSDL. Neu xoa truoc ma buoc CSDL that bai,
nguoi dung mat anh hoan toan. Co test rieng bao ve thu tu nay.

Hai route khong di qua validate() vi multipart chi dien req.body SAU multer.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Phục vụ tệp tĩnh + chống lọt tệp vào git

**Files:**
- Modify: `backend/src/app.ts` (chèn trước `app.use("/api", apiRouter)`)
- Create: `backend/uploads/.gitkeep`
- Modify: `.gitignore` (gốc `D:/appmessaging/.gitignore`)
- Test: `backend/tests/upload.static.test.ts` (tạo mới)

**Interfaces:**
- Consumes: `UPLOAD_DIR`, `UPLOAD_URL_PREFIX` (Task 1).
- Produces: `GET /api/uploads/<tên tệp>` trả nội dung tệp với `Cross-Origin-Resource-Policy: cross-origin`.

- [x] **Step 1: Viết test thất bại**

```ts
// backend/tests/upload.static.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";

const TMP_DIR = path.join(os.tmpdir(), `uupm-static-${Date.now()}`);
process.env.UPLOAD_DIR = TMP_DIR;

const { createApp } = await import("../src/app");
const app = createApp();

describe("Phục vụ tệp tĩnh tại /api/uploads", () => {
  const fileName = "banner-testuser-abcd1234.webp";
  const fileBody = Buffer.from("noi dung anh gia lap");

  beforeAll(async () => {
    await fs.mkdir(TMP_DIR, { recursive: true });
    await fs.writeFile(path.join(TMP_DIR, fileName), fileBody);
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  it("trả 200 và đúng nội dung tệp", async () => {
    const res = await request(app).get(`/api/uploads/${fileName}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fileBody);
  });

  it("gỡ rào Cross-Origin-Resource-Policy của helmet cho riêng mount này", async () => {
    // helmet() mặc định gắn same-origin, sẽ chặn ảnh khi client gọi thẳng BE:5000
    const res = await request(app).get(`/api/uploads/${fileName}`);

    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("đặt cache dài hạn vì tên tệp đã chứa phần ngẫu nhiên", async () => {
    const res = await request(app).get(`/api/uploads/${fileName}`);

    expect(res.headers["cache-control"]).toContain("immutable");
  });

  it("trả 404 cho tệp không tồn tại", async () => {
    const res = await request(app).get("/api/uploads/khong-ton-tai.webp");

    expect(res.status).toBe(404);
  });
});
```

- [x] **Step 2: Chạy test để chắc chắn nó thất bại**

Run: `cd backend && npx vitest run tests/upload.static.test.ts`
Expected: FAIL — nhận 404 (chưa mount tĩnh).

- [x] **Step 3: Sửa `backend/src/app.ts`**

Thêm import:

```ts
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from "./config/upload";
```

Chèn **ngay trước** dòng `// Đăng ký toàn bộ tuyến đường API tại tiền tố /api`:

```ts
  // Phục vụ ảnh đã tải lên. Nằm DƯỚI tiền tố /api nên đi qua proxy sẵn có của Vite
  // -> ảnh cùng origin với trang, không cần nới CORS (xem spec §2.1).
  // helmet() mặc định gắn Cross-Origin-Resource-Policy: same-origin; gỡ rào cho
  // RIÊNG mount này để ảnh vẫn xem được khi client gọi thẳng BE:5000 không qua proxy.
  app.use(
    UPLOAD_URL_PREFIX,
    express.static(UPLOAD_DIR, {
      setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
      // Tên tệp chứa phần ngẫu nhiên nên nội dung đổi là URL đổi -> cache vĩnh viễn an toàn
      maxAge: "1y",
      immutable: true,
    })
  );

```

- [x] **Step 4: Chạy test để xác nhận PASS**

Run: `cd backend && npx vitest run tests/upload.static.test.ts`
Expected: PASS cả 4 test.

- [x] **Step 5: Tạo `.gitkeep` và cập nhật `.gitignore`**

```bash
cd /d/appmessaging
mkdir -p backend/uploads
touch backend/uploads/.gitkeep
```

Thêm vào cuối `.gitignore` ở gốc `D:/appmessaging/.gitignore` (**chỉ có một tệp `.gitignore` duy nhất ở gốc repo — `backend/.gitignore` không tồn tại**; mục cuối hiện tại là `# 8.`, nên đánh số tiếp là `# 9.`):

```gitignore

# 9. Ảnh người dùng tải lên (dữ liệu, không phải mã nguồn) — giữ lại .gitkeep để thư mục tồn tại
backend/uploads/*
!backend/uploads/.gitkeep
```

- [x] **Step 6: Kiểm chứng gitignore thật sự hoạt động**

```bash
cd /d/appmessaging
echo "kiem tra" > backend/uploads/test-ignore-me.webp
git status --porcelain backend/uploads/
```

Expected: chỉ thấy `?? backend/uploads/` (thư mục chứa `.gitkeep` chưa được theo dõi), **KHÔNG** thấy `test-ignore-me.webp` xuất hiện như một tệp riêng lẻ.
Sau đó xoá tệp thử: `rm backend/uploads/test-ignore-me.webp`

- [x] **Step 7: Typecheck + toàn bộ test**

Run: `cd backend && npx tsc -b --pretty false && npm test`
Expected: PASS cả `upload.static.test.ts` lẫn các test cũ.

- [x] **Step 8: Commit**

```bash
cd /d/appmessaging
git add backend/src/app.ts backend/tests/upload.static.test.ts \
        .gitignore backend/uploads/.gitkeep
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
feat(upload): phuc vu anh tinh duoi /api/uploads

Mount express.static nam trong tien to /api da duoc Vite proxy san, nen anh
cung origin voi trang va khong can noi CORS.

Go rao Cross-Origin-Resource-Policy: cross-origin cho rieng mount nay vi
helmet() mac dinh gan same-origin, se chan anh khi client goi thang BE:5000.

Cache immutable 1 nam la an toan vi ten tep chua phan ngau nhien — noi dung
doi thi URL doi.

Bo qua backend/uploads/ trong gitignore: day la du lieu nguoi dung, khong
phai ma nguon, va repo goc nam o D:/ nen se phinh rat nhanh neu bo sot.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Bổ sung tài liệu OpenAPI

Bắt buộc vì `tests/docs.test.ts` khẳng định cứng `toHaveLength(26)` và mọi path phải có `tags` + `summary`. Thêm 2 route mà không cập nhật sẽ làm vỡ test.

**Files:**
- Modify: `backend/src/docs/openapi.ts` (thêm `bannerUrl` vào `UserPublicSchema`, đăng ký 2 path)
- Modify: `backend/tests/docs.test.ts` (paths 26 → 28, operations 29 → 31)
- Test: `backend/tests/docs.test.ts`

**Interfaces:**
- Consumes: hằng số `errorHandler`/`errors`/`UserPublicSchema` đã có trong `openapi.ts`.
- Produces: 28 path trong đặc tả OpenAPI.

- [x] **Step 1: Sửa `UserPublicSchema` trong `backend/src/docs/openapi.ts`**

Thêm ngay sau dòng `avatarUrl: z.string().nullable().openapi({ description: "Đường dẫn ảnh đại diện" }),`:

```ts
    bannerUrl: z.string().nullable().openapi({ description: "Đường dẫn ảnh bìa trang hồ sơ" }),
```

- [x] **Step 2: Đăng ký 2 path mới**

Chèn ngay sau khối `registry.registerPath` của `/users/profile` (kết thúc bằng `...errors("400", "401", "404", "500"),\n  },\n});`), trước khối `change-password`:

```ts
// Multipart upload không dùng toRequest() vì body là tệp nhị phân, không phải JSON.
// Khai báo requestBody thủ công theo đúng chuẩn OpenAPI 3 cho multipart/form-data.
const avatarUploadRequestBody = {
  required: true,
  content: {
    "multipart/form-data": {
      schema: z.object({
        file: z.any().openapi({ type: "string", format: "binary" }),
      }),
    },
  },
};

// Mọi endpoint của module này trả cùng một vỏ bọc { success, data }.
// Khai báo một lần để hai path bên dưới không lặp lại cùng một chuỗi schema.
const withUserData = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: z.object({ success: z.literal(true), data: UserPublicSchema }),
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/users/avatar",
  tags: ["Users"],
  summary: "Tải lên ảnh đại diện",
  description:
    "Nhận multipart/form-data với trường 'file'. Ảnh được cắt vuông 256x256 và nén sang WEBP. Tối đa 5MB, chấp nhận JPG/PNG/WEBP.",
  security: [{ [bearerAuth.name]: [] }],
  request: avatarUploadRequestBody,
  responses: {
    200: withUserData("Tải ảnh đại diện thành công"),
    ...errors("400", "401", "404", "500"),
  },
});

registry.registerPath({
  method: "post",
  path: "/users/banner",
  tags: ["Users"],
  summary: "Tải lên ảnh bìa trang hồ sơ",
  description:
    "Nhận multipart/form-data với trường 'file'. Ảnh được thu nhỏ về tối đa 1200x400 và nén sang WEBP. Tối đa 5MB, chấp nhận JPG/PNG/WEBP.",
  security: [{ [bearerAuth.name]: [] }],
  request: avatarUploadRequestBody,
  responses: {
    200: withUserData("Tải ảnh bìa thành công"),
    ...errors("400", "401", "404", "500"),
  },
});
```

- [x] **Step 3: Cập nhật số đếm trong `backend/tests/docs.test.ts`**

Tệp này có **HAI** con số cứng, không phải một — sửa thiếu chỗ nào cũng còn test đỏ. Đổi cả ba dòng (dòng 25, 26 và 50):

```ts
    // 29 thao tác gốc + POST /users/avatar + POST /users/banner
    expect(operations).toHaveLength(31);
    // 26 path gốc + /users/avatar + /users/banner
    expect(Object.keys(openApiDocument.paths ?? {})).toHaveLength(28);
```

```ts
    // 26 path gốc + /users/avatar + /users/banner
    expect(Object.keys(res.body.paths)).toHaveLength(28);
```

- [x] **Step 4: Chạy test docs**

Run: `cd backend && npx vitest run tests/docs.test.ts`
Expected: PASS cả 4 test.

- [x] **Step 5: Chạy toàn bộ test + typecheck**

Run: `cd backend && npx tsc -b --pretty false && npm test`
Expected: **toàn bộ test PASS** — đây là lần đầu tiên cả bộ test xanh sau khi thêm route.

- [x] **Step 6: Commit**

```bash
cd /d/appmessaging
git add backend/src/docs/openapi.ts backend/tests/docs.test.ts
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
docs(api): khai bao hai endpoint tai anh trong OpenAPI

Dang ky /users/avatar va /users/banner voi requestBody multipart/form-data
khai bao thu cong (khong dung toRequest vi body la tep nhi phan, khong phai
JSON). Them bannerUrl vao UserPublicSchema.

Cap nhat so path trong docs.test.ts tu 26 len 28 — test nay khang dinh cung
so luong nen them route ma quen cap nhat se lam vo.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Kiểu dữ liệu + service frontend

**Files:**
- Modify: `frontend/src/types/auth.types.ts`
- Modify: `frontend/src/features/users/services/user.service.ts`
- Modify: `frontend/src/features/users/schemas/user.schema.ts`

**Interfaces:**
- Consumes: 2 endpoint từ Task 4.
- Produces:
  - `User.bannerUrl?: string | null`
  - `userService.uploadAvatar(file: File): Promise<User>`
  - `userService.uploadBanner(file: File): Promise<User>`
  - `userService.updateProfile(data)` chấp nhận thêm `bannerUrl`
  - `updateProfileSchema` chấp nhận `bannerUrl` và đường dẫn nội bộ `/api/uploads/...`

**Lưu ý về kiểm chứng:** frontend không có test runner và dependency guard cấm thêm, nên task này xác nhận bằng typecheck. Không tạo test frontend.

- [x] **Step 1: Thêm `bannerUrl` vào `frontend/src/types/auth.types.ts`**

Thêm ngay sau dòng `avatarUrl?: string | null;`:

```ts
  bannerUrl?: string | null;
```

- [x] **Step 2: Sửa `frontend/src/features/users/services/user.service.ts`**

Mở rộng `Pick` của `updateProfile`:

```ts
  async updateProfile(
    data: Partial<Pick<User, "displayName" | "avatarUrl" | "bannerUrl" | "bio" | "statusMessage">>
  ): Promise<User> {
```

Thêm hằng số và 2 method mới vào object `userService` (đặt ngay trước `changePassword`):

```ts
  /**
   * Gửi tệp ảnh lên máy chủ dưới dạng multipart/form-data.
   *
   * BẮT BUỘC ghi đè Content-Type về undefined cho RIÊNG request này.
   * apiClient đặt cứng "application/json" ở cấp instance; mà axios chỉ xoá
   * Content-Type cho FormData BÊN TRONG adapter, tức SAU khi transformRequest
   * đã chạy — lúc đó FormData đã bị JSON.stringify và tệp bị mất sạch.
   * Ghi đè tại đây để transformRequest thấy content-type rỗng và trả về
   * nguyên vẹn đối tượng FormData; trình duyệt tự đặt multipart/form-data kèm boundary.
   */
  async uploadImage(endpoint: "avatar" | "banner", file: File): Promise<User> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post<ApiResponse<User>>(`/users/${endpoint}`, formData, {
        headers: { "Content-Type": undefined },
      });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error?.message || "Không thể tải ảnh lên");
      }

      return response.data.data;
    } catch (error) {
      throw new Error(formatApiError(error, "Không thể tải ảnh lên. Vui lòng thử lại."));
    }
  },

  /** Tải lên ảnh đại diện mới; trả về hồ sơ người dùng đã cập nhật */
  async uploadAvatar(file: File): Promise<User> {
    return this.uploadImage("avatar", file);
  },

  /** Tải lên ảnh bìa trang hồ sơ; trả về hồ sơ người dùng đã cập nhật */
  async uploadBanner(file: File): Promise<User> {
    return this.uploadImage("banner", file);
  },
```

Đồng thời cập nhật khối JSDoc đầu file cho khớp (thêm 2 dòng mô tả endpoint mới).

- [x] **Step 3: Sửa `frontend/src/features/users/schemas/user.schema.ts`**

**Bắt buộc — nếu bỏ qua bước này, tính năng upload sẽ hỏng theo hai cách:**
1. `z.object()` mặc định **strip** khóa không có trong schema, nên `bannerUrl` bị nuốt mất trước khi tới `onSubmit`.
2. `avatarUrl` hiện chỉ chấp nhận `""` hoặc `http(s)://`. Sau khi upload, giá trị là `/api/uploads/...` → **lần bấm "Lưu thay đổi" kế tiếp báo lỗi validation**, dù người dùng không sửa gì. Đây đúng cái bẫy của backend (Task 3 Step 4), nhân bản sang FE.

Thêm hằng số kiểm tra dùng chung ở đầu file, ngay sau `import { z } from "zod";`:

```ts
/**
 * Kiểm tra đường dẫn ảnh ở phía client — PHẢI khớp quy tắc bên backend
 * (imagePathSchema trong src/schemas/user.schema.ts), nếu không người dùng sẽ
 * bị chặn ngay trên giao diện dù máy chủ hoàn toàn chấp nhận giá trị đó.
 * Chấp nhận hai dạng:
 *  1. Chuỗi rỗng — nghĩa là xoá ảnh, quay về mặc định.
 *  2. URL tuyệt đối http/https, HOẶC đường dẫn nội bộ /api/uploads/... do backend
 *     sinh ra sau khi xử lý tệp tải lên.
 */
const imagePathSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^https?:\/\/\S+$/.test(value) || value.startsWith("/api/uploads/"),
    { message: "Đường dẫn ảnh không hợp lệ" }
  );
```

Thay khối `avatarUrl` hiện tại và thêm `bannerUrl` ngay sau nó:

```ts
  // Ảnh đại diện: để trống nghĩa là xoá ảnh, hoặc URL/đường dẫn nội bộ hợp lệ
  avatarUrl: imagePathSchema,
  // Ảnh bìa trang hồ sơ: cùng quy tắc với ảnh đại diện
  bannerUrl: imagePathSchema,
```

- [x] **Step 4: Kiểm chứng bằng typecheck**

Run: `cd frontend && npx tsc -b --pretty false`
Expected: không có output. Nếu báo lỗi ở `headers: { "Content-Type": undefined }`, đổi sang `headers: { "Content-Type": undefined } as Record<string, string | undefined>` — nhưng thử bản gốc trước.

- [x] **Step 5: Commit**

```bash
cd /d/appmessaging
git add frontend/src/types/auth.types.ts frontend/src/features/users/services/user.service.ts \
        frontend/src/features/users/schemas/user.schema.ts
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
feat(user): them uploadAvatar va uploadBanner o tang service

Ghi de Content-Type ve undefined cho rieng request upload. apiClient dat cung
application/json o cap instance, ma axios chi xoa Content-Type cho FormData
BEN TRONG adapter — tuc SAU khi transformRequest da chay. Luc do FormData da
bi JSON.stringify va tep bi mat sach, backend nhan {}.

Them bannerUrl vao User va vao Pick cua updateProfile.

Sua updateProfileSchema o FE: z.object() mac dinh strip khoa la nen bannerUrl
bi nuot mat truoc khi toi onSubmit. Ngoai ra avatarUrl cu chi nhan "" hoac
http(s):// nen sau khi upload, gia tri /api/uploads/... lam lan bam "Luu thay
doi" ke tiep bao loi validation du nguoi dung khong sua gi.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Hook `useImageUpload` + nút chọn tệp

**Files:**
- Create: `frontend/src/features/users/hooks/useImageUpload.ts`
- Create: `frontend/src/features/users/components/ImageUploadButton.tsx`

**Interfaces:**
- Consumes: `userService.uploadAvatar` / `uploadBanner` (Task 7), `useAuthStore.setUser`.
- Produces:
  - `useImageUpload(kind: "avatar" | "banner")` → `{ upload: (file: File) => Promise<User | null>; isUploading: boolean; error: string | null }` (**trả `null` khi thất bại**, trả hồ sơ mới khi thành công — form cha cần giá trị này để đồng bộ ô ẩn)
  - `<ImageUploadButton label accept isUploading disabled onFileSelected />`

- [x] **Step 1: Tạo `frontend/src/features/users/hooks/useImageUpload.ts`**

Tách vào hook theo `frontend.md §2` — component trình bày không được nhúng lời gọi API.

```ts
import { useState } from "react";
import { userService } from "../services/user.service";
import { useAuthStore } from "../../../stores/auth.store";
import { toast } from "../../../stores/toast.store";
import { formatApiError } from "../../../lib/error-formatter";
import { User } from "../../../types/auth.types";

// Giới hạn phía client phải khớp với backend (config/upload.ts).
// Kiểm tra ở đây chỉ để phản hồi nhanh cho người dùng; máy chủ vẫn là nơi xác thực thật.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Quản lý vòng đời tải ảnh lên: kiểm tra sơ bộ -> gọi API -> đẩy kết quả vào Auth Store.
 *
 * Sau khi thành công, ghi thẳng hồ sơ mới vào store để mọi nơi dùng currentUser
 * (sidebar, panel hồ sơ) đổi ảnh ngay mà không cần tải lại trang.
 *
 * TRẢ VỀ hồ sơ mới (hoặc null khi thất bại) chứ không chỉ void: form cha cần giá
 * trị URL mới để đồng bộ vào ô ẩn bannerUrl/avatarUrl. Nếu không, lần bấm
 * "Lưu thay đổi" kế tiếp sẽ ghi đè ảnh vừa tải bằng URL cũ trong form.
 *
 * @param kind Loại ảnh cần tải lên: ảnh đại diện hoặc ảnh bìa
 */
export function useImageUpload(kind: "avatar" | "banner") {
  const setUser = useAuthStore((state) => state.setUser);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<User | null> => {
    // Kiểm tra sơ bộ ở client. Không thay thế được kiểm tra phía máy chủ.
    if (!ALLOWED_TYPES.includes(file.type)) {
      const message = "Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP.";
      setError(message);
      toast.error(message, "Ảnh không hợp lệ");
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      const message = "Ảnh vượt quá dung lượng cho phép (tối đa 5MB).";
      setError(message);
      toast.error(message, "Ảnh quá lớn");
      return null;
    }

    try {
      setIsUploading(true);
      setError(null);

      const updated =
        kind === "avatar"
          ? await userService.uploadAvatar(file)
          : await userService.uploadBanner(file);

      // Đồng bộ ngay vào store để toàn bộ giao diện thấy ảnh mới
      setUser(updated);

      toast.success(
        kind === "avatar" ? "Ảnh đại diện đã được cập nhật." : "Ảnh bìa đã được cập nhật.",
        kind === "avatar" ? "Cập nhật ảnh đại diện" : "Cập nhật ảnh bìa"
      );

      // Trả hồ sơ mới để form cha đồng bộ vào ô ẩn tương ứng
      return updated;
    } catch (err: unknown) {
      const message = formatApiError(err, "Không thể tải ảnh lên. Vui lòng thử lại.");
      setError(message);
      toast.error(message, "Tải ảnh thất bại");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading, error };
}
```

- [x] **Step 2: Tạo `frontend/src/features/users/components/ImageUploadButton.tsx`**

```tsx
import React, { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "../../../components/ui/Button";

interface ImageUploadButtonProps {
  label: string;
  // Mô tả cho trình đọc màn hình, vì nút chỉ có icon + nhãn ngắn
  ariaLabel?: string;
  accept?: string;
  isUploading?: boolean;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}

/**
 * Nút chọn tệp ảnh từ máy người dùng.
 * Thuần trình bày: chỉ mở hộp thoại chọn tệp và đẩy File ra ngoài qua callback,
 * không gọi API (việc đó nằm ở hook useImageUpload).
 */
export const ImageUploadButton: React.FC<ImageUploadButtonProps> = ({
  label,
  ariaLabel,
  accept = "image/jpeg,image/png,image/webp",
  isUploading = false,
  disabled = false,
  onFileSelected,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // LUÔN reset giá trị input ngay sau khi đọc tệp. Nếu không, chọn lại CÙNG một
    // tệp ở lần sau sẽ không kích hoạt onChange (trình duyệt thấy giá trị không đổi).
    event.target.value = "";

    if (file) onFileSelected(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        // Không cho chọn tệp khi đang tải lên, tránh chồng request
        disabled={disabled || isUploading}
        aria-hidden="true"
        tabIndex={-1}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={<Upload className="w-3.5 h-3.5" />}
        isLoading={isUploading}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
    </>
  );
};
```

- [x] **Step 3: Kiểm chứng bằng typecheck**

Run: `cd frontend && npx tsc -b --pretty false`
Expected: không có output.

- [x] **Step 4: Kiểm tra `Upload` có tồn tại trong lucide**

Run: `cd frontend && node -e "console.log(typeof require('lucide-react').Upload)"`
Expected: `object`. Nếu là `undefined`, thay bằng `ImageUp` hoặc `FileImage` — cả hai đều có trong lucide-react bản đang cài.

- [x] **Step 5: Commit**

```bash
cd /d/appmessaging
git add frontend/src/features/users/hooks/useImageUpload.ts \
        frontend/src/features/users/components/ImageUploadButton.tsx
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
feat(user): them hook useImageUpload va nut chon tep anh

Tach logic goi API vao hook theo frontend.md §2 — component trinh bay khong
duoc nhung loi goi API. Hook kiem tra so bo dinh dang va dung luong o client
chi de phan hoi nhanh, may chu van la noi xac thuc that.

ImageUploadButton reset input.value sau moi lan chon, neu khong thi chon lai
CUNG mot tep se khong kich hoat onChange.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Component `ProfileBanner`

**Files:**
- Create: `frontend/src/features/users/components/ProfileBanner.tsx`

**Interfaces:**
- Consumes: `ImageUploadButton` (Task 8), `User` type.
- Produces: `<ProfileBanner currentUser isUploading onBannerSelected onBannerCleared />`

- [x] **Step 1: Tạo `frontend/src/features/users/components/ProfileBanner.tsx`**

```tsx
import React from "react";
import { User as UserIcon, Trash2 } from "lucide-react";
import { User } from "../../../types/auth.types";
import { ImageUploadButton } from "./ImageUploadButton";
import { Button } from "../../../components/ui/Button";

interface ProfileBannerProps {
  currentUser: User;
  isUploading?: boolean;
  onBannerSelected: (file: File) => void;
  onBannerCleared: () => void;
}

/**
 * Khối nhận diện đầu tab "Hồ sơ của tôi", bố cục theo kiểu Discord:
 * ảnh bìa nằm ngang phía trên, ảnh đại diện lớn đè lên mép dưới, tên và
 * dòng trạng thái nằm bên dưới.
 *
 * Thuần trình bày: nhận dữ liệu và callback từ form cha, không gọi API.
 */
export const ProfileBanner: React.FC<ProfileBannerProps> = ({
  currentUser,
  isUploading = false,
  onBannerSelected,
  onBannerCleared,
}) => {
  return (
    <div className="w-full">
      {/* Ảnh bìa. Dùng aspect-[3/1] thay vì chiều cao cứng để không vỡ bố cục trên màn hình hẹp. */}
      <div className="relative w-full aspect-[3/1] bg-uupm-accent-soft border-2 border-uupm-line rounded-xs overflow-hidden">
        {currentUser.bannerUrl ? (
          <img
            src={currentUser.bannerUrl}
            alt="Ảnh bìa trang hồ sơ"
            className="w-full h-full object-cover"
          />
        ) : (
          // Chưa có ảnh bìa: dùng nền token accent-soft, không hardcode mã màu
          <div className="w-full h-full" />
        )}

        {/* Cụm nút quản lý ảnh bìa, đặt đè lên góc phải ảnh bìa */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <ImageUploadButton
            label="Đổi ảnh bìa"
            ariaLabel="Tải lên ảnh bìa mới"
            isUploading={isUploading}
            onFileSelected={onBannerSelected}
          />
          {currentUser.bannerUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              disabled={isUploading}
              aria-disabled={isUploading}
              aria-label="Xoá ảnh bìa, quay về nền mặc định"
              onClick={onBannerCleared}
            >
              Xoá
            </Button>
          )}
        </div>
      </div>

      {/* Ảnh đại diện lớn đè lên mép dưới ảnh bìa, kèm tên và dòng trạng thái */}
      <div className="px-4 pb-1">
        <div className="w-16 h-16 -mt-8 rounded-xs bg-uupm-accent-soft border-2 border-uupm-surface shadow-uupm-active flex items-center justify-center overflow-hidden">
          {currentUser.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={`Ảnh đại diện của ${currentUser.displayName || currentUser.username}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <UserIcon className="w-7 h-7 text-uupm-ink" />
          )}
        </div>

        <h4 className="mt-2 text-base font-black text-uupm-ink truncate">
          {currentUser.displayName || currentUser.username}
        </h4>
        <p className="text-xs font-bold text-uupm-ink-muted truncate">@{currentUser.username}</p>
        {currentUser.statusMessage && (
          <p className="mt-1 text-xs font-semibold text-uupm-ink-soft">{currentUser.statusMessage}</p>
        )}
      </div>
    </div>
  );
};
```

- [x] **Step 2: Kiểm chứng bằng typecheck**

Run: `cd frontend && npx tsc -b --pretty false`
Expected: không có output.

- [x] **Step 3: Commit**

```bash
cd /d/appmessaging
git add frontend/src/features/users/components/ProfileBanner.tsx
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
feat(user): them component ProfileBanner theo bo cuc Discord

Anh bia aspect-[3/1] voi anh dai dien lon de len mep duoi, kem ten va dong
trang thai. Dung aspect ratio thay vi chieu cao cung de khong vo bo cuc tren
man hinh hep; nen mac dinh dung token bg-uupm-accent-soft, khong hardcode mau.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Bố cục lại `UserProfileForm`

**Files:**
- Modify: `frontend/src/features/users/components/UserProfileForm.tsx`

**Interfaces:**
- Consumes: `ProfileBanner` (Task 9), `ImageUploadButton` (Task 8), `useImageUpload` (Task 8), `userService.updateProfile` (Task 7).

- [x] **Step 1: Thay import và bổ sung hook**

Thay khối import đầu file:

```tsx
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User as UserIcon, Save, Trash2, Quote, MessageSquareQuote, ShieldAlert } from "lucide-react";
import { updateProfileSchema, UpdateProfileFormValues } from "../schemas/user.schema";
import { userService } from "../services/user.service";
import { useAuthStore } from "../../../stores/auth.store";
import { useImageUpload } from "../hooks/useImageUpload";
import { toast } from "../../../stores/toast.store";
import { formatApiError } from "../../../lib/error-formatter";
import { User } from "../../../types/auth.types";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { ProfileBanner } from "./ProfileBanner";
import { ImageUploadButton } from "./ImageUploadButton";
```

Bên trong component, sau dòng `const displayNameValue = watch("displayName");`, thêm:

```tsx
  // Hook tải ảnh đại diện: lo phần gọi API và đồng bộ store
  const { upload: uploadAvatar, isUploading: isUploadingAvatar } = useImageUpload("avatar");
```

- [x] **Step 2: Destructure thêm `isDirty` và `reset`**

```tsx
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileFormValues>({
```

- [x] **Step 3: Thay thẻ preview cũ bằng `ProfileBanner`**

Xoá toàn bộ khối thẻ xem trước hiện tại (khối `<div className="flex items-center gap-3 p-3 bg-uupm-page ...">` chứa avatar `w-12 h-12` và tên) và thay bằng:

```tsx
      {/* Khối nhận diện: ảnh bìa + ảnh đại diện lớn + tên + dòng trạng thái.
          onBannerSelected còn là hàm rỗng ở bước này — Step 4 sẽ nối vào hook ảnh bìa. */}
      <ProfileBanner
        currentUser={currentUser}
        isUploading={isUploadingAvatar}
        onBannerSelected={() => {
          // Sẽ nối vào hook ảnh bìa ở Step 4
        }}
        onBannerCleared={() => setValue("bannerUrl", "", { shouldDirty: true })}
      />
```

- [x] **Step 4: Thêm hook ảnh bìa và nối vào `ProfileBanner`**

Thêm ngay dưới hook ảnh đại diện:

```tsx
  // Hook tải ảnh bìa
  const { upload: uploadBanner, isUploading: isUploadingBanner } = useImageUpload("banner");
```

Sửa `ProfileBanner` cho khớp. **Bắt buộc đồng bộ URL mới vào ô ẩn** — hook trả về hồ sơ đã cập nhật, nếu bỏ qua thì lần bấm "Lưu thay đổi" kế tiếp sẽ ghi đè ảnh vừa tải bằng URL cũ còn nằm trong form:

```tsx
      <ProfileBanner
        currentUser={currentUser}
        isUploading={isUploadingBanner}
        onBannerSelected={async (file) => {
          // Ảnh bìa lưu ngay khi chọn (độc lập với việc sửa các trường chữ),
          // nhưng vẫn phải đồng bộ URL mới vào form để lần lưu sau không ghi đè.
          const updated = await uploadBanner(file);
          if (updated) setValue("bannerUrl", updated.bannerUrl || "", { shouldDirty: false });
        }}
        onBannerCleared={() => setValue("bannerUrl", "", { shouldDirty: true })}
      />
```

- [x] **Step 5: Thêm trường ẩn `bannerUrl`**

Ngay trước thẻ `<ProfileBanner ... />`, thêm:

```tsx
      {/* Ảnh bìa lưu ngay khi tải lên, nhưng vẫn register ẩn để giữ nguyên giá trị
          khi người dùng bấm "Lưu thay đổi" (nếu không sẽ bị ghi đè thành undefined). */}
      <input type="hidden" {...register("bannerUrl")} />
```

- [x] **Step 6: Gộp 2 khối ảnh đại diện và nhóm lại có tiêu đề**

**Phạm vi thay thế chính xác**: xoá **toàn bộ** phần thân form từ khối `{/* Trường Tên hiển thị (bắt buộc) */}` cho tới hết khối `{/* Trường Tiểu sử */}` (trong `UserProfileForm.tsx` hiện tại là **dòng 103–201**), rồi dán cấu trúc dưới đây vào chỗ đó. Cấu trúc này đã bao gồm cả Tên hiển thị và Tiểu sử ở vị trí mới — **không** giữ lại hai khối gốc, nếu không chúng sẽ bị nhân đôi.

Giữ nguyên phần trước đó (thẻ xem trước cũ đã bị Step 3 thay bằng `ProfileBanner`, hộp `serverError`) và phần sau (nút Lưu).

```tsx
      {/* Nhóm Danh tính: các trường người khác nhìn thấy khi trò chuyện */}
      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-wide text-uupm-ink">Danh tính</h4>

        <Input
          label="Tên hiển thị"
          placeholder="vd: Nguyễn Văn An"
          helperText="Tên bạn bè nhìn thấy trong các cuộc trò chuyện"
          leftIcon={<UserIcon className="w-4 h-4" />}
          error={errors.displayName?.message}
          disabled={isSubmitting}
          required
          {...register("displayName")}
        />

        <div>
          <Input
            label="Dòng trạng thái"
            placeholder="vd: Đang tập trung làm việc"
            helperText="Tối đa 100 ký tự, để trống nếu không muốn hiển thị"
            leftIcon={<MessageSquareQuote className="w-4 h-4" />}
            error={errors.statusMessage?.message}
            disabled={isSubmitting}
            {...register("statusMessage")}
          />
          {statusMessageValue.length > 0 && (
            <p
              className={`mt-1.5 text-[11px] font-bold ${
                statusMessageValue.length > 100 ? "text-uupm-danger-text" : "text-uupm-ink-muted"
              }`}
            >
              {statusMessageValue.length}/100 ký tự
            </p>
          )}
        </div>

        {/* Ảnh đại diện: tải tệp thật lên máy chủ (đã có endpoint upload) */}
        <div className="w-full">
          <input type="hidden" {...register("avatarUrl")} />
          <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-uupm-ink">
            Ảnh đại diện
          </span>
          <div className="flex items-center gap-3 p-3 bg-uupm-page border-2 border-uupm-line rounded-xs shadow-uupm-active">
            <div className="w-10 h-10 rounded-xs bg-uupm-accent-soft border-2 border-uupm-line flex items-center justify-center shrink-0 overflow-hidden">
              {avatarUrlValue ? (
                <img src={avatarUrlValue} alt="Ảnh đại diện hiện tại" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-5 h-5 text-uupm-ink" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-uupm-ink">
                {avatarUrlValue ? "Đang dùng ảnh tùy chỉnh" : "Đang dùng ảnh mặc định"}
              </p>
              <p id="profile-avatar-helper" className="text-[11px] font-semibold text-uupm-ink-muted mt-0.5">
                JPG, PNG hoặc WEBP, tối đa 5MB
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <ImageUploadButton
                label="Đổi ảnh"
                ariaLabel="Tải lên ảnh đại diện mới"
                isUploading={isUploadingAvatar}
                disabled={isSubmitting}
                onFileSelected={async (file) => {
                  // Ảnh xem trước đọc từ watch("avatarUrl") — state của form, KHÔNG phải
                  // prop currentUser. Nên phải setValue để ảnh hiện ngay, đồng thời giữ
                  // đúng giá trị cho lần bấm "Lưu thay đổi" kế tiếp.
                  const updated = await uploadAvatar(file);
                  if (updated) setValue("avatarUrl", updated.avatarUrl || "", { shouldDirty: false });
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                aria-describedby="profile-avatar-helper"
                disabled={isSubmitting || isUploadingAvatar || !avatarUrlValue}
                aria-disabled={isSubmitting || isUploadingAvatar || !avatarUrlValue}
                onClick={() => setValue("avatarUrl", "", { shouldDirty: true })}
              >
                Xoá
              </Button>
            </div>
          </div>
          {errors.avatarUrl && (
            <p role="alert" className="mt-1.5 text-xs font-bold text-uupm-danger-text">
              {errors.avatarUrl.message}
            </p>
          )}
        </div>
      </div>

      {/* Nhóm Giới thiệu */}
      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase tracking-wide text-uupm-ink">Giới thiệu</h4>

        <div className="w-full">
          <label
            htmlFor="profile-bio"
            className="mb-1.5 block text-xs font-black uppercase tracking-wide text-uupm-ink"
          >
            Tiểu sử
          </label>
          <div className="relative">
            <Quote className="w-4 h-4 text-uupm-ink-muted absolute left-3.5 top-3.5 pointer-events-none" />
            <textarea
              id="profile-bio"
              rows={3}
              placeholder="Giới thiệu ngắn về bạn..."
              aria-invalid={Boolean(errors.bio)}
              aria-describedby={errors.bio ? "profile-bio-error" : "profile-bio-helper"}
              disabled={isSubmitting}
              className="w-full pl-10 pr-4 py-2.5 text-sm font-semibold bg-uupm-surface text-uupm-ink placeholder:text-uupm-ink-muted rounded-xs border-2 border-uupm-line shadow-uupm-active focus:outline-none focus:shadow-uupm-2 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
              {...register("bio")}
            />
          </div>
          {errors.bio ? (
            <p id="profile-bio-error" className="mt-1.5 text-xs font-bold text-uupm-danger-text">
              {errors.bio.message}
            </p>
          ) : (
            <p id="profile-bio-helper" className="mt-1.5 text-xs font-semibold text-uupm-ink-muted">
              Tối đa 200 ký tự
              {bioValue.length > 0 && (
                <span className={bioValue.length > 200 ? " text-uupm-danger-text" : ""}>
                  {" "}
                  — {bioValue.length}/200
                </span>
              )}
            </p>
          )}
        </div>
      </div>
```

- [x] **Step 7: Thêm 2 biến `watch` còn thiếu**

Bổ sung cạnh `displayNameValue`:

```tsx
  const statusMessageValue = watch("statusMessage") || "";
  const bioValue = watch("bio") || "";
```

- [x] **Step 8: Cho nút Lưu biết trạng thái chưa sửa**

Thay nút submit cuối form:

```tsx
      {/* Hiển thị đếm ký tự cho Tên hiển thị (giới hạn 50 của backend) */}
      {displayNameValue.length > 0 && (
        <p className="text-[11px] font-bold text-uupm-ink-muted text-right">
          {displayNameValue.length}/50 ký tự
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        isLoading={isSubmitting}
        leftIcon={<Save className="w-4 h-4" />}
        disabled={!isDirty || isSubmitting}
        aria-disabled={!isDirty || isSubmitting}
        className="w-full"
      >
        Lưu thay đổi
      </Button>
```

- [x] **Step 9: Nối `bannerUrl` vào `defaultValues` và `onSubmit`**

Thêm vào `defaultValues` (ngay sau dòng `avatarUrl: currentUser.avatarUrl || "",`):

```tsx
      bannerUrl: currentUser.bannerUrl || "",
```

Trong `onSubmit`, thêm `bannerUrl` vào payload gửi lên:

```tsx
      const updated = await userService.updateProfile({
        displayName: values.displayName,
        // Chuỗi rỗng nghĩa là người dùng muốn xoá avatar -> gửi null đúng như backend mong đợi
        avatarUrl: values.avatarUrl === "" ? null : values.avatarUrl,
        // Ảnh bìa do nút "Xoá" hoặc lần upload gần nhất quyết định, không có ô nhập tay
        bannerUrl: values.bannerUrl === "" ? null : values.bannerUrl,
        bio: values.bio,
        statusMessage: values.statusMessage,
      });
```

Sau đó, ngay sau `setUser(updated);`, thêm:

```tsx
      // Đánh dấu form đã sạch để nút "Lưu thay đổi" trở lại trạng thái mờ
      reset(values);
```

- [x] **Step 10: Kiểm chứng bằng typecheck**

Run: `cd frontend && npx tsc -b --pretty false`
Expected: không có output. Nếu báo `bioValue`/`statusMessageValue` chưa dùng hoặc thiếu, kiểm lại Step 7.

- [x] **Step 11: Kiểm tra thủ công**

Chạy song song backend (`cd backend && npm run dev`) và frontend (`cd frontend && npm run dev`), đăng nhập, mở popup Cài đặt → tab "Hồ sơ của tôi", rồi xác nhận **tất cả** các điểm sau:

1. Ảnh bìa hiện nền `accent-soft` khi chưa có ảnh, bố cục không vỡ ở cửa sổ hẹp (~400px)
2. Bấm "Đổi ảnh bìa" → chọn JPG → ảnh hiện ngay, sidebar **không** đổi (chỉ avatar mới đổi sidebar)
3. Bấm "Xoá" trên ảnh bìa → về nền mặc định
4. **Tải ảnh bìa, rồi sửa Tên hiển thị, rồi bấm "Lưu thay đổi" → ảnh bìa VẪN CÒN.** Đây là lưới an toàn cho việc đồng bộ ô ẩn `bannerUrl`; nếu bước này hỏng thì ảnh bìa vừa tải bị ghi đè bằng giá trị cũ trong form.
5. Bấm "Đổi ảnh" ở mục Ảnh đại diện → chọn ảnh → ảnh đổi **cả ở sidebar lẫn ô xem trước** ngay lập tức
6. Tải ảnh đại diện rồi bấm "Lưu thay đổi" (không sửa gì khác) → không báo lỗi validation (kiểm tra `imagePathSchema` ở FE đã nhận `/api/uploads/...`)
7. Chọn một tệp `.txt` đổi đuôi thành `.png` → nhận thông báo lỗi từ máy chủ (không phải 500)
8. Chọn ảnh >5MB → nhận thông báo "vượt quá dung lượng cho phép", **không** phải "sự cố nội bộ"
9. Nút "Lưu thay đổi" mờ khi chưa sửa gì; sửa Tên hiển thị → nút sáng lên; lưu → nút mờ lại
10. Đếm ký tự hiện đúng ở Tên hiển thị / Dòng trạng thái / Tiểu sử
11. Bấm "Đổi ảnh" rồi chọn **lại đúng tệp vừa chọn** → vẫn tải lên (kiểm tra việc reset `input.value`)
12. Đổi ảnh đại diện lần hai → ảnh cũ **không** còn trong `backend/uploads/`

- [x] **Step 12: Commit**

```bash
cd /d/appmessaging
git add frontend/src/features/users/components/UserProfileForm.tsx
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
feat(user): bo cuc lai tab Ho so cua toi theo kieu Discord

Them khoi ProfileBanner o dau tab, gop hai khoi anh dai dien trung nhau thanh
mot, nhom truong thanh "Danh tinh" va "Gioi thieu".

Anh dai dien va anh bia tai tep that len may chu thay vi chi xoa duoc. Anh
luu ngay khi chon vi day la hanh dong doc lap voi viec sua cac truong chu.

Them dem ky tu theo dung gioi han backend (50/100/200) va cho nut "Luu thay
doi" mo di khi chua sua gi.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Ghi chú cho người thực thi

- **Thứ tự task có phụ thuộc**: Task 1 → 2 → 3 → 4 → 5 → 6 (backend), rồi 7 → 8 → 9 → 10 (frontend). Task 6 phải làm trước Task 7 không bắt buộc về mặt kỹ thuật, nhưng `docs.test.ts` sẽ đỏ cho tới khi Task 6 xong.
- **Các mỏ neo đã được xác minh trong mã nguồn** (không phải phỏng đoán): nhánh duplicate-key của `error-handler.ts` ở dòng 96 và nhánh fallback 500 ở dòng 123 → mỏ neo chèn nhánh multer là chính xác. `app.use("/api", apiRouter)` ở `app.ts` dòng 39 → chèn static ngay trước đó. `avatarUrl` trong `UserPublicSchema` ở `openapi.ts` dòng 79. Khối `registerPath` của `/users/profile` kết thúc ở dòng 368 → chèn 2 path mới ngay sau. Chỉ có **một** tệp `.gitignore` ở gốc repo.
- **Task 3 Step 2 có thể đổi hướng**: nếu `z.string().url()` chấp nhận `/api/uploads/...` thì bỏ qua Step 3. Phải chạy test để biết, không đoán.
- **Nếu một test backend đỏ vì môi trường** (thiếu MongoDB), chạy đúng file test đó trước để xác định, đừng chạy cả bộ.
- **Frontend không có test tự động** — Step 11 của Task 10 là lưới an toàn duy nhất, không được bỏ qua.
- **Cùng một cái bẫy xuất hiện ở HAI tầng**: backend `z.string().url()` (Task 3 Step 4) và frontend `avatarUrl` (Task 7 Step 3) đều chỉ chấp nhận URL tuyệt đối, nên cả hai đều từ chối `/api/uploads/...` do chính hệ thống sinh ra. Sửa một tầng mà quên tầng kia thì tính năng hỏng ở tầng còn lại.
- **Ô ẩn phải được đồng bộ sau mỗi lần upload**: `avatarUrl`/`bannerUrl` là state của react-hook-form, không tự biết `currentUser` vừa đổi. Mọi chỗ gọi `uploadAvatar`/`uploadBanner` đều phải `setValue` lại bằng giá trị hook trả về — nếu không, lần bấm "Lưu thay đổi" kế tiếp sẽ ghi đè ảnh vừa tải bằng URL cũ. Đây chính là lý do `useImageUpload.upload` trả `User | null` chứ không phải `void`.
