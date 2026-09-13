# AppMessaging - Backend Service

> **Stack**: Express.js + TypeScript + MongoDB (Mongoose) + Socket.IO  
> **Kiến trúc**: Layered Architecture (Controller -> Service -> Repository/Model)  
> **Xác thực & Bảo mật**: Zod validation, JWT, Helmet, CORS, không lộ stack trace

---

## 🏗️ Cấu Trúc Thư Mục Backend

```text
backend/
├── src/
│   ├── config/             # env.ts (Zod validation), database.ts (MongoDB connect)
│   ├── core/               # errors.ts (AppError classes), logger.ts
│   ├── middlewares/        # validate.ts, auth.ts, error-handler.ts, not-found.ts
│   ├── models/             # Mongoose schemas: User, Conversation, Message
│   ├── repositories/       # Mongoose queries encapsulation
│   ├── services/           # Business logic: Auth, Conversation, Message
│   ├── controllers/        # Route handlers, response formatting
│   ├── routes/             # Express routers (auth, conversations, health)
│   ├── socket/             # Socket.IO event handlers (chat, rooms, online status, typing)
│   ├── utils/              # auth.ts (bcrypt, jwt)
│   ├── app.ts              # Express application setup
│   └── server.ts           # HTTP server + Socket.IO bootstrap
├── tests/                  # Integration & unit tests (Vitest + Supertest)
├── package.json
└── tsconfig.json
```

---

## 📖 Tài Liệu API Tương Tác (Swagger UI)

Khởi động server rồi mở:

- **Swagger UI**: <http://localhost:5000/api/docs> — xem và gọi thử API trực tiếp trên trình duyệt.
- **Đặc tả OpenAPI JSON**: <http://localhost:5000/api/docs/openapi.json> — import vào Postman/Insomnia hoặc sinh SDK.

Đặc tả được sinh tự động từ chính các Zod Schema đang dùng để validate, nên tài liệu không thể lệch khỏi code.
Để gọi thử API cần xác thực: chạy `/api/auth/login`, copy `accessToken`, bấm nút **Authorize** và dán token vào.

---

## 🔌 API Endpoints Cheat-Sheet

| Method | Endpoint | Yêu cầu Auth | Mô tả |
|---|---|---|---|
| `GET` | `/api/health` | Không | Kiểm tra trạng thái hoạt động của server |
| `POST` | `/api/auth/register` | Không | Đăng ký tài khoản mới (`username`, `email`, `password`) |
| `POST` | `/api/auth/login` | Không | Đăng nhập lấy Bearer JWT token |
| `GET` | `/api/auth/me` | Có (Bearer) | Lấy thông tin user hiện tại |
| `POST` | `/api/conversations` | Có (Bearer) | Tạo hội thoại 1-1 hoặc nhóm chat (`DIRECT` / `GROUP`) |
| `GET` | `/api/conversations` | Có (Bearer) | Lấy danh sách hội thoại của user (sắp xếp theo tin mới nhất) |
| `GET` | `/api/conversations/:id` | Có (Bearer) | Lấy chi tiết cuộc trò chuyện |
| `POST` | `/api/conversations/:id/messages` | Có (Bearer) | Gửi tin nhắn vào cuộc trò chuyện |
| `GET` | `/api/conversations/:id/messages` | Có (Bearer) | Lấy tin nhắn (hỗ trợ phân trang cursor: `limit`, `cursor`) |

---

## ⚡ Socket.IO Real-Time Events

- **Client emit**:
  - `join_conversation`: Tham gia phòng chat (`conversationId`)
  - `leave_conversation`: Rời phòng chat (`conversationId`)
  - `send_message`: Gửi tin nhắn real-time (`{ conversationId, content, type }`)
  - `typing_start`: Báo đang gõ phím (`conversationId`)
  - `typing_stop`: Dừng gõ phím (`conversationId`)
- **Server emit**:
  - `new_message`: Tin nhắn mới tới room `conversation:${id}`
  - `user_typing`: Thông báo trạng thái gõ phím của thành viên
  - `user_status_changed`: Cập nhật trạng thái Online/Offline của user

---

## 🚀 Commands

```bash
npm run dev         # Khởi động server chế độ watch (tsx)
npm run build       # Biên dịch TypeScript sang dist/
npm start           # Chạy server production từ dist/server.js
npm run type-check  # Kiểm tra type tĩnh (tsc --noEmit)
npm test            # Chạy bộ test suite qua Vitest
```
