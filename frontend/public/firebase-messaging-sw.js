/* eslint-env serviceworker */
// Service Worker cho Firebase Cloud Messaging (FCM) — Web Push khi app ở background.
//
// HƯỚNG DẪN CẤU HÌNH (theo docs/call-feature-setup.md mục 4.1):
// Service worker chạy trong context riêng của browser, KHÔNG đọc được import.meta.env.
// → Phải điền trực tiếp giá trị Firebase config vào khối firebaseConfig bên dưới,
//   trùng với các biến VITE_FIREBASE_* trong frontend/.env.
//
// Token này được getToken() ở src/lib/firebase.ts đăng ký tự động khi user bật thông báo.

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// === ĐIỀN CONFIG TỪ frontend/.env (VITE_FIREBASE_*) ===
firebase.initializeApp({
  apiKey: "AIzaSyB_94jK30kjdgc44jzCBu7nM61FkT504BE",
  projectId: "appmessage-47034",
  messagingSenderId: "847864169428",
  appId: "1:847864169428:web:17d35c3748daae62ac8c41",
});

const messaging = firebase.messaging();

// Xử lý push khi app đang ở background: hiển thị notification system của browser
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "App Messaging";
  const options = {
    body: payload.notification?.body || "Bạn có một thông báo mới",
    data: payload.data || {},
    icon: "/favicon.ico",
    tag: "appmessaging-push",
  };
  self.registration.showNotification(title, options);
});

// Khi user click vào notification: focus tab đang mở của app (nếu có), mở tab mới nếu chưa
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Ưu tiên focus lại tab app đang mở thay vì nhân bản tab mới
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/");
    })
  );
});
