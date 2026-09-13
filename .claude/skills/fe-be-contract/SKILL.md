---
name: fe-be-contract
description: Use when frontend and backend live in the same repo and you are about to change, debug, or review an endpoint, socket event, or shared type — or when asked to "kết nối FE với BE", check integration, or verify the two sides actually work together. Also use before declaring an integration done, since reading both sides is not evidence they interoperate.
---

# FE↔BE Contract Verification (Kiểm Chứng Hợp Đồng Frontend ↔ Backend)

## Nguyên tắc cốt lõi

**Đọc cả hai phía không phải là bằng chứng chúng khớp nhau.** Contract chỉ được coi là đã kiểm chứng khi có một lần chạy thật chứng minh — và mọi kết luận "ổn" đều phải kèm một nhóm đối chứng.

Ba lớp lệch tồn tại độc lập; sửa lớp này không phát hiện lớp kia:

| Lớp | Cách phát hiện | Bỏ sót thì hậu quả |
|---|---|---|
| **Hình dạng dữ liệu** (field name, kiểu, null vs undefined) | Chạy thật, in raw response | UI sai âm thầm — không crash, không log |
| **Validation** (schema chặn trước controller) | Chạy thật với payload y hệt FE gửi | 400 ở mọi lần gọi, tính năng chết hẳn |
| **Phân quyền realtime** (ai được join room) | Chạy thật với **2 client đối chứng** | Rò rỉ dữ liệu giữa các tenant |

## Quy trình

### 1. Lập bảng đối chiếu tĩnh (nhanh, chỉ để định hướng)

Đối chiếu 4 điểm, ghi ra bảng trước khi sửa bất cứ thứ gì:

- **Endpoint**: `frontend/**/services/*.ts` gọi path nào → có tồn tại trong `backend/src/routes/`?
- **Payload**: FE gửi field gì → schema `backend/src/schemas/` đòi field gì?
- **Response**: FE đọc `response.data.<gì>` → controller trả về đúng nhánh đó chưa? **Chú ý: một số endpoint đặt mảng ở `data` và metadata ở `pagination` cùng cấp, số khác gộp hết vào `data`.**
- **Socket event**: tên event, payload, và room — hai phía có trùng khít?

Bảng này chỉ là giả thuyết. Bước 2 mới là thứ quyết định.

### 2. Chạy thật (bắt buộc — đây là bước tìm ra lỗi)

Bật MongoDB rồi cả hai server, sau đó gọi API bằng script thật:

```bash
docker compose -f docker-compose.dev.yml up -d mongodb   # DB
cd backend  && npm run dev                                 # API :5000
cd frontend && npm run dev                                 # UI :3000
```

Probe mọi thứ bằng đúng payload mà FE gửi — không phải payload mà bạn *nghĩ* là đúng:

```bash
curl -s -X POST http://localhost:5000/api/<path> \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -H "Authorization: Bearer $TOKEN" \
  -d '<payload sao chép từ chính file service của FE>'
```

Với mỗi response, in **kiểu dữ liệu** của từng field chứ không chỉ giá trị — lệch `string` vs `object` là lớp lỗi phổ biến nhất và vô hình khi chỉ đọc `console.log(m)`:

```js
for (const [k, v] of Object.entries(m))
  console.log(k, "=", typeof v, JSON.stringify(v))
```

Lấy payload mẫu bằng cách mở chính file `frontend/src/**/services/*.ts` và chép nguyên object mà FE dựng. Payload tự nghĩ ra sẽ pass và che mất lỗi.

### 3. Kiểm chứng realtime bằng 2 client đối chứng

Xác thực socket và phân quyền room **không** lộ ra khi chỉ đọc code. Viết script ngắn dùng `socket.io-client` (đã có trong `frontend/node_modules`) với **tối thiểu hai client**:

- **Client A — chủ sở hữu hợp lệ**: PHẢI nhận được sự kiện.
- **Client B — người ngoài**: KHÔNG ĐƯỢC nhận được gì.

Client A là nhóm đối chứng. Không có nó, kết quả "B không nhận được gì" là **vô nghĩa** — socket có thể đơn giản là chưa kết nối, event sai tên, hoặc chưa join kịp room. Xem `references/realtime-probe.md` để lấy script mẫu.

## Chống báo động giả

- **"Không nhận được gì" một mình không phải bằng chứng an toàn.** Luôn có nhóm đối chứng phải nhận được. Test harness hỏng và hệ thống an toàn trông giống hệt nhau.
- **Không kết luận từ việc đọc.** Một lỗ hổng suy ra từ đọc code là *giả thuyết* cho tới khi có script chạy thật chứng minh.
- **Không kết luận từ một lần chạy.** Chạy lặp lại; kết quả không ổn định nghĩa là còn timing/race chưa hiểu.
- **Lệch shape là lỗi im lặng.** `object` so với `string` không ném exception — nó chỉ làm UI hiển thị sai. Phải in `typeof`, đừng tin mắt.

## Red Flags — Dừng lại, chưa kiểm chứng xong

- "Tôi đã đọc cả hai phía và chúng khớp" → chưa chạy thật, chưa có bằng chứng.
- "Response trông đúng rồi" → chưa kiểm tra kiểu dữ liệu từng field.
- "Người lạ không nhận được gì, vậy là an toàn" → thiếu nhóm đối chứng.
- "Test pass nghĩa là tích hợp ổn" → test mock cả hai phía thì không chứng minh được gì.
- "Chỉ sửa backend thôi" → contract là giao kèo hai chiều; kiểm tra phía FE có đang bù trừ lỗi đó không.

## Dọn dẹp

Xóa mọi script probe tạm sau khi dùng xong. Nếu giữ lại làm kiểm thử lâu dài, chuyển nó vào bộ test thật của backend (`backend/tests/`) thay vì để file rời ở gốc repo.
