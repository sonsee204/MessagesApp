---
name: nodejs-backend-patterns
description: Build production-ready Node.js backend services with Express/Fastify, implementing middleware patterns, error handling, authentication, database integration, and API design best practices. Thiết kế và phát triển backend Node.js production-ready với Express/TypeScript, kiến trúc phân tầng, middleware, bảo mật và xử lý lỗi.
---

# Node.js Backend Patterns (Mẫu Thiết Kế Backend Node.js)

Tài liệu hướng dẫn toàn diện để xây dựng ứng dụng backend Node.js có khả năng mở rộng (scalable), dễ bảo trì (maintainable) và đạt chuẩn production với Express/TypeScript cùng các mẫu kiến trúc và best practices hàng đầu.

## Khi Nào Sử Dụng Skill Này

- Xây dựng REST APIs hoặc GraphQL servers.
- Thiết kế kiến trúc phân tầng chuẩn: Controller ──> Service ──> Repository.
- Hiện thực hệ thống xác thực (Authentication) và phân quyền (Authorization) với JWT / Refresh Token.
- Thiết kế kiến trúc backend mở rộng và module hóa.
- Cấu hình Middleware, Async Handler và cơ chế xử lý lỗi tập trung (Global Error Handler).
- Tích hợp cơ sở dữ liệu (MongoDB, PostgreSQL, Redis).
- Phát triển ứng dụng thời gian thực với WebSockets / Socket.IO.
- Xử lý các tác vụ nền (Background Jobs / Worker queues).

## Tài Liệu Chi Tiết & Ví Dụ Thực Tế

Tài liệu chi tiết về các mẫu code và kiến trúc nâng cao nằm tại `references/details.md` và `references/advanced-patterns.md`.

## Các Quy Chuẩn Tốt Nhất (Best Practices)

1. **Sử dụng TypeScript**: Đảm bảo type safety để ngăn ngừa lỗi runtime ngay từ giai đoạn biên dịch.
2. **Xử lý lỗi tập trung**: Định nghĩa các custom error class (e.g. `AppError`, `NotFoundError`, `ConflictError`, `ValidationError`).
3. **Xác thực dữ liệu đầu vào (Zero-Trust Validation)**: Sử dụng Zod để kiểm tra `req.body`, `req.query`, `req.params`.
4. **Quản lý biến môi trường**: Sử dụng file `.env` và validate env schema, tuyệt đối không hardcode secrets.
5. **Ghi log có cấu trúc**: Sử dụng logger chuẩn (Winston, Pino) thay vì `console.log` thuần.
6. **Thêm Rate Limiting**: Ngăn chặn tấn công brute-force và DDoS API.
7. **Luôn dùng HTTPS**: Bắt buộc trên môi trường production.
8. **Cấu hình CORS an toàn**: Không dùng `*` trên production, chỉ cho phép các origin được chỉ định.
9. **Kiến trúc phân tầng rành mạch**: Controller chỉ nhận request/response, Service thực thi business rules, Repository truy vấn DB.
10. **Viết kiểm thử tự động**: Viết Unit Test và Integration Test đầy đủ (kết hợp Vitest / Supertest).
11. **Graceful Shutdown**: Lắng nghe `SIGTERM`, `SIGINT` để đóng kết nối database, server HTTP và socket an toàn khi tắt app.
12. **Connection Pooling**: Quản lý pool kết nối cho database để tối ưu tài nguyên.
13. **Health Check Endpoint**: Cung cấp `/api/health` để monitor trạng thái server và database.
14. **Nén dữ liệu phản hồi (Compression)**: Sử dụng middleware nén gzip để giảm dung lượng tải mạng.
15. **Giám sát hiệu năng**: Theo dõi chỉ số CPU, memory và APM metrics.

## Quy Chuẩn Kiểm Thử (Testing Patterns)

Xem skill `vitest` và quy chuẩn `.claude/workflows/create-api-endpoint.md` để triển khai kiểm thử tự động cho backend.
