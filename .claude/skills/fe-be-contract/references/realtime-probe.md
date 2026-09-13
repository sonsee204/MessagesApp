# Script kiểm chứng realtime (có nhóm đối chứng)

Mẫu script dùng để kiểm chứng phân quyền room Socket.IO. Đặt tạm ở `frontend/` để resolve được `socket.io-client` từ `frontend/node_modules`, chạy xong thì xóa.

## Chuẩn bị dữ liệu

```bash
# Tạo 2 user, lấy token, tạo hội thoại, gửi 1 tin nhắn để có conversationId
ID1=$(...) ; T1=$(...) ; ID2=$(...)
```

## Script

```js
import { io } from "socket.io-client";
import fs from "fs";

const API = "http://localhost:5000/api";
const H = { "Content-Type": "application/json", Origin: "http://localhost:3000" };

const T = "C:/Users/XuanSon/AppData/Local/Temp/";   // sửa theo máy
const [id1, t1, id2] = fs.readFileSync(T + "ids.txt", "utf8").trim().split(" ");
const cid = fs.readFileSync(T + "cid.txt", "utf8").trim();

// Tạo người dùng thứ 3 KHÔNG thuộc hội thoại
const u3 = "outsider_" + Date.now();
const reg = await (await fetch(`${API}/auth/register`, {
  method: "POST", headers: H,
  body: JSON.stringify({ username: u3, email: u3 + "@test.local", password: "Test123456" }),
})).json();

const mk = (token, label) => {
  const s = io("http://localhost:5000", { auth: { token: `Bearer ${token}` }, transports: ["websocket"] });
  const got = [];
  s.on("new_message", (m) => got.push(m.content));
  s.on("connect", () => console.log(`${label} connected`));
  return { s, got, label };
};

// ĐỐI CHỨNG: thành viên hợp lệ phải nhận được
const member   = mk(t1, "thanh-vien");
const outsider = mk(reg.data.accessToken, "nguoi-ngoai");

await new Promise((r) => setTimeout(r, 1200));

// Cả hai cùng join vào phòng của hội thoại
member.s.emit("join_conversation", { conversationId: cid });
outsider.s.emit("join_conversation", { conversationId: cid });
await new Promise((r) => setTimeout(r, 1200));

// Gửi một tin nhắn vào hội thoại
await fetch(`${API}/conversations/${cid}/messages`, {
  method: "POST",
  headers: { ...H, Authorization: `Bearer ${t1}` },
  body: JSON.stringify({ content: "TIN NHAN RIENG TU " + Date.now() }),
});

await new Promise((r) => setTimeout(r, 2000));

console.log("--- KẾT QUẢ ---");
console.log(`thành viên nhận được:  ${JSON.stringify(member.got)}`);
console.log(`người ngoài nhận được: ${JSON.stringify(outsider.got)}`);
process.exit(0);
```

## Cách đọc kết quả

| thành viên | người ngoài | Kết luận |
|---|---|---|
| nhận được | không nhận | ✅ Phân quyền room đúng |
| nhận được | **nhận được** | 🔴 Rò rỉ dữ liệu — `join_conversation` thiếu kiểm tra thành viên |
| **không nhận** | không nhận | ⚠️ Test harness hỏng (sai tên event, chưa kịp join, sai room) — **không phải** an toàn |

Dòng thứ ba là cái bẫy quan trọng nhất: không có client đối chứng thì nó trông y hệt dòng đầu.

## Kiểm chứng bắt tay (handshake)

Kiểm tra token có tiền tố `Bearer ` vẫn xác thực được, và sai token thì bị từ chối:

```js
// Phải kết nối được
io("http://localhost:5000", { auth: { token: `Bearer ${validJwt}` } });

// Phải bị từ chối với "Token không hợp lệ"
io("http://localhost:5000", { auth: { token: "Bearer not-a-jwt" } });
```

Lỗi `jwt malformed` xảy ra khi phía gửi thêm tiền tố `Bearer ` nhưng phía nhận không bóc nó trước `jwt.verify`. Kiểm tra bằng hàm thuần nếu có thể tách ra được — nhanh và ổn định hơn dựng cả socket:

```ts
export function normalizeHandshakeToken(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  return raw.startsWith("Bearer ") ? raw.slice(7) : raw;
}
```

Hàm thuần như vậy kiểm thử được bằng unit test không cần DB, không cần socket — nên tách nó ra thay vì nhúng logic vào middleware handshake.
