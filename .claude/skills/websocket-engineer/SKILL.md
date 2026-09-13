---
name: websocket-engineer
description: Use when building real-time communication systems with WebSockets or Socket.IO. Invoke for bidirectional messaging, horizontal scaling with Redis, presence tracking, room management. Kỹ sư kiến trúc thời gian thực (real-time) với WebSockets / Socket.IO, scaling phân tán với Redis Adapter, quản lý room, trạng thái online/offline (presence) và reconnection.
license: MIT
metadata:
  author: https://github.com/Jeffallan
  version: "1.1.0"
  domain: api-architecture
  triggers: WebSocket, Socket.IO, real-time communication, bidirectional messaging, pub/sub, server push, live updates, chat systems, presence tracking
  role: specialist
  scope: implementation
  output-format: code
  related-skills: fastapi-expert, nestjs-expert, devops-engineer, monitoring-expert, security-reviewer
---

# WebSocket Engineer (Kỹ Sư Hệ Thống Thời Gian Thực)

## Quy Trình Cốt Lõi (Core Workflow)

1. **Phân tích yêu cầu** — Xác định quy mô kết nối (concurrency), tần suất tin nhắn và độ trễ chấp nhận được.
2. **Thiết kế kiến trúc** — Lên phương án clustering, Redis pub/sub, quản lý state và cơ chế chịu lỗi (failover).
3. **Hiện thực hệ thống** — Xây dựng WebSocket / Socket.IO server với xác thực JWT, quản lý rooms, sự kiện tin nhắn.
4. **Kiểm thử cục bộ** — Kiểm tra auth rejection với token sai/hết hạn, join/leave room và độ tin cậy gửi/nhận tin nhắn.
5. **Mở rộng ngang (Scale)** — Tích hợp Redis Adapter, cấu hình sticky sessions trên Load Balancer (Nginx/HAProxy).
6. **Giám sát (Monitor)** — Theo dõi số lượng kết nối đồng thời, độ trễ, throughput và tỷ lệ lỗi ngắt kết nối bất thường.

## Tài Liệu Tham Khảo Chuyên Sâu

| Chủ Đề | Đường Dẫn File | Tình Huống Kích Hoạt |
|---|---|---|
| **Protocol** | `references/protocol.md` | WebSocket handshake, frames, ping/pong, close codes. |
| **Scaling** | `references/scaling.md` | Mở rộng ngang (horizontal scaling), Redis pub/sub, sticky sessions. |
| **Patterns** | `references/patterns.md` | Rooms, namespaces, broadcasting, acknowledgments (ACK). |
| **Security** | `references/security.md` | Xác thực JWT, phân quyền, giới hạn tần suất (rate limiting), CORS. |
| **Alternatives** | `references/alternatives.md` | So sánh SSE (Server-Sent Events), Long Polling vs WebSockets. |

---

## Ví Dụ Code Chuẩn (Code Examples)

### Cấu Hình Server (Socket.IO + JWT Auth + Redis Adapter + Quản Lý Room)

```typescript
// Cấu hình Socket.IO server kèm xác thực JWT và mở rộng đa node qua Redis
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import jwt from "jsonwebtoken";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: process.env.ALLOWED_ORIGIN, credentials: true },
  pingTimeout: 20000,
  pingInterval: 25000,
});

// Middleware xác thực JWT trước khi chấp nhận kết nối socket
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Yêu cầu mã xác thực"));
  try {
    socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Mã xác thực không hợp lệ"));
  }
});

// Khởi tạo kết nối Redis Pub/Sub cho Redis Adapter
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));

io.on("connection", (socket) => {
  const { userId } = socket.data.user;
  console.log(`Người dùng kết nối: ${userId} (${socket.id})`);

  // Lưu trạng thái online (presence)
  pubClient.hSet("presence", userId, socket.id);

  // Tham gia phòng chat
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", { userId });
  });

  // Nhận và phát tin nhắn trong phòng
  socket.on("message", ({ roomId, text }) => {
    io.to(roomId).emit("message", { userId, text, ts: Date.now() });
  });

  // Xử lý khi ngắt kết nối
  socket.on("disconnect", () => {
    pubClient.hDel("presence", userId);
    console.log(`Người dùng ngắt kết nối: ${userId}`);
  });
});

httpServer.listen(3000);
```

### Phía Client: Tự Động Kết Nối Lại Với Exponential Backoff

```typescript
// Client Socket.IO tự động kết nối lại và lưu hàng đợi tin nhắn khi mất mạng
import { io } from "socket.io-client";

const socket = io("wss://api.example.com", {
  auth: { token: getAuthToken() },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,       // Độ trễ khởi điểm (ms)
  reconnectionDelayMax: 30000,   // Độ trễ tối đa 30s
  randomizationFactor: 0.5,      // Jitter ngẫu nhiên tránh nghẽn đồng loạt
});

let messageQueue: Array<{ roomId: string; text: string }> = [];

socket.on("connect", () => {
  console.log("Đã kết nối thành công:", socket.id);
  // Gửi bù các tin nhắn bị đọng trong hàng đợi khi offline
  messageQueue.forEach((msg) => socket.emit("message", msg));
  messageQueue = [];
});

socket.on("disconnect", (reason) => {
  console.warn("Mất kết nối:", reason);
  if (reason === "io server disconnect") socket.connect();
});

socket.on("connect_error", (err) => {
  console.error("Lỗi kết nối socket:", err.message);
});

function sendMessage(roomId: string, text: string) {
  const msg = { roomId, text };
  if (socket.connected) {
    socket.emit("message", msg);
  } else {
    // Đưa vào hàng đợi nếu đang mất kết nối
    messageQueue.push(msg);
  }
}
```

---

## Nguyên Tắc Bắt Buộc & Điều Cấm Kỵ (Constraints)

### BẮT BUỘC THỰC HIỆN (MUST DO)
- **Cấu hình Sticky Sessions**: WebSocket là kết nối có trạng thái (stateful), load balancer phải route đúng instance đã handshake.
- **Heartbeat / Ping-Pong**: Luôn có cơ chế ping/pong định kỳ để phát hiện và dọn dẹp các kết nối zombie (dead connections).
- **Phân nhóm bằng Rooms/Namespaces**: Dùng cơ chế room của socket thay vì lọc thủ công trên tầng ứng dụng.
- **Hàng đợi tin nhắn khi ngắt kết nối**: Buffer tin nhắn trên client để tránh mất dữ liệu khi mạng chập chờn.
- **Tính toán giới hạn kết nối**: Dự trù dung lượng RAM và socket file descriptor trên từng instance trước khi scale.

### TUYỆT ĐỐI KHÔNG LÀM (MUST NOT DO)
- Không lưu trữ trạng thái người dùng lớn trong bộ nhớ RAM mà không có cơ chế cluster (dùng Redis làm centralized store).
- Không để lộ socket endpoint mà thiếu lớp xác thực JWT / token middleware.
- Không bỏ qua việc dọn dẹp (cleanup) presence, room membership khi socket disconnect.
- Không bỏ qua bước kiểm thử tải (load testing) trước khi đưa lên production.
