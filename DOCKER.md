# Hướng Dẫn Thiết Lập & Vận Hành Docker (AppMessaging)

Tài liệu hướng dẫn chi tiết cách chạy dự án bằng Docker & Docker Compose cho cả hai môi trường: **Local Development** và **Production**.

---

## 📦 Các Dịch Vụ Được Thiết Lập Trong Docker

| Service | Image | Cổng Port | Mục đích |
|---|---|---|---|
| `mongodb` | `mongo:7.0` | `27017:27017` | Cơ sở dữ liệu chính, dữ liệu lưu trữ bền vững tại Docker Volume |
| `backend` | Node.js 20 Alpine (Multi-stage) | `5000:5000` | RESTful API & Socket.IO server |
| `mongo-express` | `mongo-express:latest` | `8081:8081` | Web UI trực quan để xem và quản lý dữ liệu MongoDB |

---

## 🚀 1. Cách Chạy Production Toàn Bộ (Full Stack Docker)

Khởi chạy cả Database, Backend Service và Mongo Express chỉ với 1 lệnh:

```bash
cd D:\appmessaging

# Build images và chạy các container ngầm (detached mode)
docker compose up -d --build
```

### Kiểm tra trạng thái:
```bash
# Xem danh sách container đang chạy
docker compose ps

# Xem log thời gian thực của backend
docker compose logs -f backend
```

### Truy cập các cổng:
- **Backend API**: `http://localhost:5000/api/health`
- **Mongo Express (Dashboard CSDL)**: `http://localhost:8081`
- **MongoDB Direct**: `mongodb://localhost:27017`

### Dừng dịch vụ:
```bash
# Dừng container nhưng giữ nguyên dữ liệu CSDL
docker compose down

# Dừng và xóa toàn bộ volumes (Reset Database)
docker compose down -v
```

---

## 🛠️ 2. Cách Chạy Local Development (Khuyên Dùng Khi Đang Code)

Khi đang lập trình, bạn chỉ cần chạy **MongoDB & Mongo Express** trong Docker, còn source code backend chạy trực tiếp ở máy với tính năng hot-reload (`tsx watch`):

```bash
cd D:\appmessaging

# 1. Khởi động MongoDB và Web UI trong Docker
docker compose -f docker-compose.dev.yml up -d

# 2. Chạy backend ở máy cục bộ
cd backend
npm run dev
```

---

## 🔍 3. Các Lệnh Tiện Ích Khác

```bash
# Truy cập vào shell bên trong container MongoDB
docker exec -it appmessaging-mongodb mongosh

# Restart riêng service backend sau khi sửa code (nếu chạy production mode)
docker compose restart backend

# Kiểm tra tài nguyên sử dụng (RAM/CPU)
docker stats
```
