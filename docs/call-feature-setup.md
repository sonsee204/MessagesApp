# Hướng dẫn cấu hình Video & Voice Call (Runtime Setup)

> Tài liệu này hướng dẫn cấu hình **Firebase Cloud Messaging (FCM)** và các biến môi trường cần thiết để tính năng gọi thoại/video hoạt động trên môi trường thật.

---

## 1. Tạo dự án Firebase & lấy credentials

1. Truy cập [Firebase Console](https://console.firebase.google.com/) → chọn hoặc tạo project.
2. **Backend (Service Account):**
   - Project Settings → Service accounts → Generate new private key.
   - File JSON tải về chứa 3 trường cần dùng: `project_id`, `client_email`, `private_key`.
3. **Frontend (Web App config):**
   - Project Settings → General → Add app (Web `< />`).
   - Copy `firebaseConfig` object: `apiKey`, `projectId`, `messagingSenderId`, `appId`.
4. **FCM VAPID Key (Frontend):**
   - Project Settings → Cloud Messaging → Web Push certificates → Generate key pair.
   - Copy chuỗi Public key (dài ~165 ký tự).

---

## 2. Cấu hình Backend (`backend/.env`)

Thêm các biến sau vào **`backend/.env`** (KHÔNG commit file này):

```env
# === Firebase Cloud Messaging (FCM) ===
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----\n"
```

**Lưu ý quan trọng:**
- `FIREBASE_PRIVATE_KEY` phải bọc trong **dấu nháy kép** (`"`) nếu chứa ký tự `\n` newline escaped.
- Module `config/firebase.ts` dùng lazy evaluation: nếu thiếu 3 biến này, app **vẫn khởi động bình thường** — chỉ throw khi có request gửi push notification thực sự (không fail-fast khi boot).

---

## 3. Cấu hình Frontend (`frontend/.env`)

Sửa file **`frontend/.env`** (hoặc `.env.local` nếu dùng Vite):

```env
# === Firebase Messaging (Frontend) ===
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# VAPID key cho Web Push (lấy từ Firebase Console → Cloud Messaging)
VITE_FIREBASE_VAPID_KEY=BNx...
```

Frontend dùng prefix `VITE_` để Vite expose lên client-side (`import.meta.env.VITE_...`).

---

## 4. Frontend: Đăng ký Firebase Messaging + Service Worker

Hiện tại code frontend **chưa có** module đăng ký FCM. Cần tạo 2 file:

### 4.1 Tạo Service Worker

Tạo file `frontend/public/firebase-messaging-sw.js` (tự động import `firebase` compat SDK):

```js
// Service Worker cho Firebase Cloud Messaging (FCM)
// Được đăng ký tự động bởi firebase/messaging getToken()
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "ĐIỀN_VITE_FIREBASE_API_KEY",
  projectId: "ĐIỀN_VITE_FIREBASE_PROJECT_ID",
  messagingSenderId: "ĐIỀN_VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "ĐIỀN_VITE_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

// Xử lý push khi app đang ở background
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    data: payload.data,
    icon: "/favicon.ico",
  });
});
```

> **Lưu ý:** Service worker file chạy trong browser context riêng, không dùng `import.meta.env` được — phải hardcode hoặc dùng build-time replacement. Cách tốt hơn là tạo module init riêng trong `src/` (xem 4.2).

### 4.2 Tạo module init Firebase Messaging

Tạo `frontend/src/lib/firebase.ts`:

```ts
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Cấu hình Firebase từ biến môi trường Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

/**
 * Xin quyền nhận thông báo và trả về FCM token của thiết bị hiện tại.
 * Token này sẽ được gửi lên backend để lưu vào DeviceTokenModel.
 *
 * @returns FCM registration token hoặc null nếu user từ chối quyền
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[FCM] Người dùng từ chối quyền nhận thông báo");
      return null;
    }
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token || null;
  } catch (err) {
    console.error("[FCM] Lỗi khi lấy FCM token:", err);
    return null;
  }
}

/**
 * Lắng nghe tin nhắn foreground (khi app đang mở).
 * FCM onBackgroundMessage xử lý khi app ở background (qua service worker).
 */
export function onForegroundMessage(
  callback: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void
): () => void {
  return onMessage(messaging, callback);
}

export { app, messaging };
```

### 4.3 Đăng ký token khi user login

Trong file login/session restore (ví dụ `useAuthStore` hoặc `App.tsx`), gọi sau khi đăng nhập thành công:

```ts
import { requestNotificationPermission } from "@/lib/firebase";
import { apiClient } from "@/lib/apiClient"; // hoặc axios instance

// Sau khi login thành công:
const fcmToken = await requestNotificationPermission();
if (fcmToken) {
  await apiClient.post("/calls/device-tokens", {
    token: fcmToken,
    platform: "web",
  });
}
```

### 4.4 Xóa token khi logout

```ts
// Trước khi logout:
if (fcmToken) {
  await apiClient.delete("/calls/device-tokens", {
    data: { token: fcmToken },
  });
}
```

---

## 5. Cài đặt thêm package Frontend (Firebase client SDK)

```bash
cd frontend && npm install firebase
```

Package `firebase` (~100KB tree-shake khi chỉ import `firebase/messaging`) là dependency client-side cho FCM.

---

## 6. Khởi động lại Backend Server

Server hiện tại (PID cũ) đang chạy code cũ trước khi merge call feature.

```bash
# Dừng server cũ (Ctrl+C trong terminal backend, hoặc kill PID)
# Sau đó khởi động lại:
cd backend && npm run dev
```

Server mới sẽ:
- Kết nối MongoDB trước (`connectDatabase()`)
- Khởi tạo Socket.IO (`initSocketServer`)
- Cleanup orphan calls từ lần chạy trước (tự động update `ringing → missed`)

---

## 7. Kiểm tra nhanh sau khi cấu hình

| Bước | Kiểm tra | Mong đợi |
|---|---|---|
| 1 | `npm run dev` backend + frontend | Không crash, không thiếu env |
| 2 | Mở 2 trình duyệt (user A + B đã kết bạn) | Cả 2 online, Socket.IO connected |
| 3 | User A bấm icon Phone/Video trong ChatHeader với user B | B thấy IncomingCallModal |
| 4 | B nhấn "Trả lời" | Camera/mic bật, status → connecting → active |
| 5 | Nhấn "Kết thúc" | Cuộc gọi kết thúc, timer dừng |
| 6 | Đóng tab B, A gọi B | A thấy "Đối phương offline", B nhận FCM notification (nếu đã configure Firebase) |
| 7 | Truy cập `/api/calls` (token user A) | Có lịch sử cuộc gọi |

---

## 8. Biến môi trường đầy đủ (tóm tắt)

### backend/.env (thêm mới)

| Biến | Bắt buộc? | Mô tả |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Có (khi gửi FCM) | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Có (khi gửi FCM) | Service account email |
| `FIREBASE_PRIVATE_KEY` | Có (kếu gửi FCM) | Service account private key (escaped `\n`) |

### frontend/.env (thêm mới)

| Biến | Bắt buộc? | Mô tả |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Có (khi FCM) | Web API key |
| `VITE_FIREBASE_PROJECT_ID` | Có | Firebase project ID |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Có | Cloud Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Có | Firebase app ID |
| `VITE_FIREBASE_VAPID_KEY` | Có | VAPID public key cho Web Push |

> Nếu không cấu hình Firebase, tính năng gọi **vẫn hoạt động** cho user đang online (Socket.IO signaling realtime). Chỉ có push notification khi callee offline là bị disable.
