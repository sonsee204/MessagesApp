# Thiết kế: Tải ảnh đại diện & ảnh bìa hồ sơ người dùng

- **Ngày**: 2026-09-13
- **Trạng thái**: Chờ duyệt
- **Phạm vi**: Backend (`Express + TypeScript + MongoDB`), Frontend (`React + Vite`)

---

## 1. Mục tiêu

Cho phép người dùng **tải tệp ảnh thật** từ máy lên để đặt làm ảnh đại diện và ảnh bìa trang
hồ sơ, thay cho việc chỉ dán URL ảnh. Trên nền hạ tầng đó, thiết kế lại tab "Hồ sơ của tôi"
theo bố cục Discord: ảnh bìa nằm ngang phía trên, ảnh đại diện lớn đè lên mép dưới.

### Vấn đề hiện tại

| Vấn đề | Bằng chứng |
| --- | --- |
| Không có cách nào đưa ảnh lên máy chủ | Không có `multer`, không có endpoint upload, không có thư mục lưu tệp |
| Trường `avatarUrl` chỉ nhận chuỗi URL | `backend/src/schemas/user.schema.ts` yêu cầu `z.string().url()` |
| Nút ảnh đại diện chỉ xoá được | `UserProfileForm.tsx` — hành động thật duy nhất là `setValue("avatarUrl", "")` |
| Không có khái niệm ảnh bìa | `IUser` trong `backend/src/models/user.model.ts` không có trường banner |

---

## 2. Quyết định nền tảng

Ba phát hiện từ mã nguồn định hình toàn bộ thiết kế.

### 2.1 Phục vụ tệp dưới tiền tố `/api`

`frontend/vite.config.ts` đã proxy toàn bộ `/api` sang `localhost:5000`, và FE chạy ở cổng
**3000** khớp đúng allowlist của `csrfOriginGuard`. Vì vậy đặt thư mục tĩnh dưới
`/api/uploads` khiến ảnh **cùng origin** với trang: không phải nới CORS, không phải sửa
`vite.config.ts`, không phải nới `helmet` cho trường hợp thông thường.

### 2.2 Thứ tự middleware với `multipart/form-data`

`middlewares/validate.ts` chạy `schema.parseAsync({ body, query, params })`. Với multipart,
`req.body` **chỉ được multer điền sau khi multer chạy** — nếu `validate` đứng trước, body rỗng
và bị strip sạch. Do đó hai route upload **không đi qua `validate()`**, và nếu về sau có thêm
thì bắt buộc theo thứ tự: `requireAuth` → `upload.single("file")` → `validate` → controller.

### 2.3 Axios instance phá `FormData` (đã xác minh trong `node_modules`)

`lib/axios.ts:14` đặt cứng `Content-Type: application/json` ở cấp instance. Trong axios 1.20.0:

- `core/dispatchRequest.js:46` chạy `transformData` **trước**, rồi mới gọi adapter (dòng 54).
- `helpers/resolveConfig.js:65` — nơi axios xoá Content-Type cho `FormData` — nằm **bên trong**
  adapter, tức chạy sau.
- Nên tại thời điểm quyết định, Content-Type JSON vẫn còn và `defaults/index.js:57` thực thi
  `JSON.stringify(formDataToJSON(data))` — **tệp biến mất**, backend nhận `{}` (lỗi 400 rất khó
  lần ra vì body trông "hợp lệ").

**Cách xử lý**: truyền `headers: { "Content-Type": undefined }` cho **riêng** request upload.
`getContentType()` trả `''` → nhánh FormData trả về nguyên vẹn → trình duyệt tự đặt
`multipart/form-data` kèm `boundary`. Hai dòng, không đụng tới các call site JSON đang chạy.

---

## 3. Thiết kế Backend

### 3.1 Hằng số dùng chung — `src/config/upload.ts` (mới)

Nguồn chân lý duy nhất, không rải số khắp nơi:

```ts
UPLOAD_DIR            = <cwd>/uploads
UPLOAD_URL_PREFIX     = "/api/uploads"
MAX_FILE_SIZE         = 5 * 1024 * 1024
ALLOWED_MIME          = ["image/jpeg", "image/png", "image/webp"]
IMAGE_PRESETS = {
  avatar: { width: 256,  height: 256, fit: "cover"  },  // cắt vuông, tránh méo mặt
  banner: { width: 1200, height: 400, fit: "inside" },  // chỉ thu nhỏ, giữ bố cục ngang
}
```

### 3.2 Nhánh lỗi multer — `src/middlewares/error-handler.ts` (sửa)

**Đây là lỗi thật, không phải phòng xa.** `MulterError` có `code` là **chuỗi**
(`"LIMIT_FILE_SIZE"`), không phải `11000` của MongoDB, và `err.name` là `"MulterError"` —
không khớp nhánh nào trong 4 nhánh hiện có, nên rơi xuống nhánh 5 và trả **500 "sự cố nội bộ"**
thay vì "ảnh quá lớn". Thêm nhánh mới (đặt sau CastError, trước duplicate-key), ánh xạ
`LIMIT_FILE_SIZE` / `LIMIT_UNEXPECTED_FILE` sang thông điệp tiếng Việt, trả **400**. Dùng
`err.name === "MulterError"` thay vì `instanceof` để không phải import multer vào đây.

### 3.3 Middleware tải tệp — `src/middlewares/upload.ts` (mới)

`multer.memoryStorage()` — giữ tệp trong RAM để chuyển thẳng cho sharp. Nhờ trần 5MB nên
không có rủi ro tràn bộ nhớ, đổi lại tránh được việc ghi tệp rác xuống đĩa rồi phải dọn khi ảnh
không giải mã được. `limits: { fileSize, files: 1 }`.

`fileFilter` từ chối theo mimetype — chỉ là **lọc sớm** vì mimetype do client khai báo và có
thể giả mạo. **Lớp xác thực thật là sharp**: ném lỗi khi tệp không giải mã được.

### 3.4 Tiện ích lưu tệp — `src/utils/image-storage.ts` (mới)

```ts
saveImage(buffer, kind): Promise<string>          // -> URL công khai
deleteImageByUrl(url | null): Promise<void>
```

- `sharp` resize theo `IMAGE_PRESETS`, xuất **WEBP**, bật `withoutEnlargement` để ảnh nhỏ hơn
  ngưỡng giữ nguyên thay vì bị phóng to làm mờ.
- Tên tệp: `avatar-<userId>-<8 hex ngẫu nhiên>.webp`. Phần ngẫu nhiên khiến **URL đổi mỗi lần
  thay ảnh**, nhờ đó đặt cache `immutable` mà trình duyệt vẫn lấy ảnh mới, không cần mẹo query string.
- `deleteImageByUrl` **luôn nuốt lỗi và chỉ ghi log**: tệp rác còn lại là chuyện nhỏ, còn làm
  hỏng một request đã ghi DB thành công mới là lỗi nặng. Kiểm tra tiền tố `UPLOAD_URL_PREFIX`
  trước khi xoá để không bao giờ chạm tệp ngoài thư mục `uploads`.

### 3.5 Model & Repository

- `src/models/user.model.ts`: thêm `bannerUrl: { type: String, default: null }` và
  `bannerUrl?: string` vào `IUser`.
- `src/repositories/user.repository.ts`: mở rộng `Pick` của `updateProfile` thêm `bannerUrl`;
  thêm method chuyên biệt `updateImage(id, field: "avatarUrl" | "bannerUrl", url)`.
  Tách khỏi `updateProfile` vì luồng upload cần đọc URL cũ để dọn tệp.
- `src/schemas/user.schema.ts`: thêm `bannerUrl` cùng quy tắc với `avatarUrl` (URL hợp lệ hoặc
  `null`) để tab Hồ sơ xoá được ảnh bìa qua `PATCH /profile`.

### 3.6 Controller — `src/controllers/user.controller.ts` (sửa)

Một helper `replaceImage(req, res, next, kind)`, hai endpoint mỏng `uploadAvatar` /
`uploadBanner` gọi lại nó. Không có `req.file` → `ValidationError("Vui lòng chọn một tệp ảnh")`.

**Thứ tự bắt buộc — ghi tệp mới → cập nhật DB → mới xoá tệp cũ.** Nếu xoá trước mà bước DB
thất bại, người dùng **mất ảnh hoàn toàn**. Làm theo thứ tự này thì trường hợp xấu nhất chỉ là
còn lại một tệp rác.

URL cũ đọc từ `req.currentUser` (đã có sẵn nhờ `requireAuth` gắn `req.currentUser`), lấy **trước**
khi ghi DB vì sau đó giá trị đã bị thay.

### 3.7 Routes & phục vụ tệp tĩnh

```ts
// src/routes/user.routes.ts — multer gọi trực tiếp, KHÔNG qua validate() (xem §2.2)
router.post("/avatar", upload.single("file"), userController.uploadAvatar);
router.post("/banner", upload.single("file"), userController.uploadBanner);
```

`requireAuth` đã áp cho cả router. Không có xung đột phương thức với `router.get("/:id")` (khác
HTTP method), nhưng đặt hai route này cùng nhóm phía trên cho dễ đọc.

```ts
// src/app.ts — một dòng, đặt TRƯỚC app.use("/api", apiRouter)
app.use(UPLOAD_URL_PREFIX, express.static(UPLOAD_DIR, {
  setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
  maxAge: "1y",
  immutable: true,
}));
```

`helmet()` mặc định gắn `Cross-Origin-Resource-Policy: same-origin`. Qua proxy thì ảnh vốn cùng
origin nên không cần, nhưng header này gỡ rào cho trường hợp gọi thẳng `BE:5000` — một dòng để
không phải gỡ rối sau.

**Bắt buộc thêm `backend/uploads/` vào `.gitignore`.** Đây là dữ liệu người dùng tải lên, không
phải mã nguồn; repo gốc nằm ở `D:/` nên tệp sẽ bị theo dõi và phình dung lượng nếu bỏ sót. Kèm
một tệp `uploads/.gitkeep` để thư mục tồn tại sau khi clone.

---

## 4. Thiết kế Frontend

### 4.1 Kiểu dữ liệu & service

- `types/auth.types.ts`: thêm `bannerUrl?: string | null`.
- `services/user.service.ts`: mở rộng `Pick` của `updateProfile`; thêm `uploadAvatar(file)` /
  `uploadBanner(file)` dùng chung helper, **có ghi đè `Content-Type: undefined`** theo §2.3.

### 4.2 `hooks/useImageUpload.ts` (mới)

Bắt buộc bởi `frontend.md §2` — component trình bày không được nhúng lời gọi API. Một hook cho
cả hai loại ảnh:

```ts
useImageUpload(kind: "avatar" | "banner")
  -> { upload: (file: File) => Promise<void>; isUploading: boolean; error: string | null }
```

Kiểm `file.type` và `file.size` ở client chỉ để phản hồi nhanh — **máy chủ vẫn là nơi xác thực
thật**. Thành công thì `setUser(updated)` để sidebar đổi ảnh ngay, kèm `toast` như các form hiện có.

### 4.3 Component trình bày (mới)

- `ImageUploadButton.tsx` — `input[type=file]` ẩn + `Button`, thuần trình bày, không gọi API.
  **Reset `input.value` sau mỗi lần chọn** để chọn lại cùng một tệp vẫn kích hoạt `onChange`.
- `ProfileBanner.tsx` — ảnh bìa `aspect-[3/1]` (thay tỉ lệ cứng để không vỡ trên mobile),
  avatar `w-16 h-16` đè lên mép dưới bằng `-mt-8 ml-4`. Chưa có ảnh bìa thì dùng dải
  `bg-uupm-accent-soft` — token, không mã màu cứng. Nút đổi ảnh bìa đặt trên banner; nút xoá
  chỉ hiện khi đã có ảnh.

### 4.4 `UserProfileForm.tsx` (sửa — phần lớn công việc)

```
<ProfileBanner />                       ← ảnh bìa + avatar lớn + tên + trạng thái
── Danh tính ──
  Tên hiển thị         12/50
  Dòng trạng thái       8/100
  [avatar]  [Đổi ảnh] [Xoá ảnh]
── Giới thiệu ──
  Tiểu sử              45/200
──────────────────────────
[ Lưu thay đổi ]        ← mờ khi chưa sửa gì
```

- `bannerUrl` / `avatarUrl` vẫn `register` ẩn để giữ giá trị khi submit.
- Đếm ký tự theo đúng giới hạn backend (50/100/200), đổi sang `text-uupm-danger-text` khi vượt.
- Nút Lưu `disabled={!isDirty || isSubmitting}`.
- Giữ nguyên `onSubmit`, hộp lỗi `serverError`, và toàn bộ `aria-*` hiện có.

---

## 5. Luồng dữ liệu

```
[FE chọn tệp] → POST /api/users/banner  (multipart/form-data)
  ↓ requireAuth
  ↓ multer memoryStorage — chặn 5MB, lọc mimetype sớm
  ↓ sharp — resize/crop theo preset → WEBP → ghi đĩa
  ↓ đọc bannerUrl cũ → cập nhật bannerUrl mới trong DB → xoá tệp ứng với URL cũ
  ↓   (bước xoá nuốt lỗi, chỉ ghi log)
  ↓ 200 { user mới }
[FE setUser(updated)] → Auth Store → mọi nơi dùng currentUser tự render lại
```

Một luồng duy nhất, hai tham số hình học. Không có trạng thái dư thừa: store chính là nguồn
sự thật sau khi máy chủ trả về.

---

## 6. Xử lý lỗi

| Tình huống | Kết quả |
| --- | --- |
| Không có tệp | 400 `VALIDATION_ERROR` |
| Mimetype không phải JPG/PNG/WEBP | 400 `VALIDATION_ERROR` |
| Tệp > 5MB | 400 `LIMIT_FILE_SIZE` (nhờ §3.2 — mặc định sẽ là 500) |
| Tệp hỏng / không giải mã được | 400 từ `saveImage` (sharp là lớp xác thực thật) |
| Chưa đăng nhập | 401 |
| Ghi DB thất bại | 500; tệp mới đã ghi thành công nên **không mất ảnh cũ** |
| Xoá tệp cũ thất bại | Không ảnh hưởng request; chỉ còn tệp rác |

---

## 7. Kiểm thử

**Backend** — `tests/user.image.test.ts` (mới), theo convention hiện có (`createApp()` +
supertest + mock repository trong `tests/`):

1. Không có tệp → 400
2. Mimetype sai → 400
3. Tệp > 5MB → 400 với `LIMIT_FILE_SIZE` — **test này bắt lỗi thiếu nhánh ở §3.2**
4. Ảnh PNG hợp lệ → 200, `avatarUrl` khớp `/api/uploads/.*\.webp`, tệp thật tồn tại trên đĩa
5. Thay ảnh lần hai → URL khác, **tệp cũ đã bị xoá**
6. `deleteImageByUrl` không xoá gì khi URL nằm ngoài `UPLOAD_URL_PREFIX`

**Frontend** — chưa có test runner và dependency guard cấm thêm, nên kiểm bằng `npx tsc -b`
sạch + thao tác tay: đổi ảnh bìa thấy ảnh hiện ngay, xoá về nền mặc định, `avatarUrl` /
`bannerUrl` giữ đúng giá trị khi lưu hồ sơ, và chọn lại **cùng một tệp** vẫn kích hoạt upload.

---

## 8. Rủi ro & giới hạn đã biết

| Rủi ro | Mức độ | Ghi chú |
| --- | --- | --- |
| `sharp` là dependency native | Trung bình | `Dockerfile` dùng `node:20-alpine` (musl) — cần prebuild musl; `npm ci` phải tải binary theo hệ điều hành |
| Container không có volume cho `uploads/` | Trung bình | File mất khi restart container. Chấp nhận ở dev; thêm volume khi đóng gói |
| `csrfOriginGuard` chỉ cho phép cổng 3000/5000 | Thấp | Khớp cấu hình hiện tại. **Nếu đổi cổng FE, upload sẽ 403** — cần nhớ |
| Tệp mồ côi khi ghi DB thất bại | Thấp | Chỉ là rác, không mất dữ liệu |
| Chưa có trần dung lượng mỗi người dùng | Thấp | Giới hạn 5MB/tệp là đủ ở quy mô hiện tại |

---

## 9. Packages thêm mới

| Package | Phía | Lý do |
| --- | --- | --- |
| `multer` | Backend | Chuẩn de-facto cho multipart trong Express |
| `@types/multer` | Backend (dev) | Kiểu TypeScript |
| `sharp` | Backend | Resize/nén ảnh — **dependency native**, xem §8 |

Frontend: **không thêm package nào**.

---

## 10. Ngoài phạm vi

- Cắt ảnh tương tác (crop UI) — sharp đã tự cắt vuông avatar
- Thanh trượt chỉnh vị trí ảnh bìa; kéo-thả tệp vào banner
- Volume Docker cho `uploads/` và job dọn tệp mồ côi định kỳ
- Kiểm tra magic bytes riêng — sharp đã là lớp xác thực thật
- Ảnh bìa cho hội thoại nhóm (backend chưa có trường tương ứng)
