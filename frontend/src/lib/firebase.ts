import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

/**
 * Module khởi tạo Firebase Cloud Messaging (FCM) cho frontend.
 * Dùng prefix VITE_ để Vite expose biến môi trường lên client-side.
 *
 * Luồng hoạt động:
 * 1. User login → gọi requestNotificationPermission() → nhận FCM token
 * 2. POST token lên backend /api/calls/device-tokens để lưu vào DB
 * 3. Khi user offline, backend dùng token này gửi push notification qua FCM
 * 4. Service worker (firebase-messaging-sw.js) xử lý notification khi app ở background
 */

/** Cấu hình Firebase từ biến môi trường Vite */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

/** VAPID key cho Web Push (lấy từ Firebase Console → Cloud Messaging) */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

/**
 * Kiểm tra cấu hình Firebase có đầy đủ hay không.
 * Nếu thiếu bất kỳ biến nào, FCM sẽ bị disable (không crash app).
 */
const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId &&
  VAPID_KEY
);

/** Khởi tạo Firebase app (chỉ khi config đầy đủ) */
const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

/** Khởi tạo Firebase Messaging instance (null nếu chưa cấu hình) */
const messaging = app ? getMessaging(app) : null;

/**
 * Xin quyền nhận thông báo từ trình duyệt và trả về FCM registration token.
 * Token này được gửi lên backend để lưu vào DeviceTokenModel.
 *
 * @returns FCM token string hoặc null nếu: user từ chối quyền, trình duyệt không hỗ trợ, hoặc config thiếu
 */
export async function requestNotificationPermission(): Promise<string | null> {
  // Nếu thiếu config Firebase, bỏ qua silently
  if (!messaging || !VAPID_KEY) {
    console.warn("[FCM] Firebase chưa được cấu hình — bỏ qua đăng ký push notification");
    return null;
  }

  // Kiểm tra trình duyệt có hỗ trợ Notification API không
  if (typeof Notification === "undefined") {
    console.warn("[FCM] Trình duyệt không hỗ trợ Notification API");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[FCM] Người dùng từ chối quyền nhận thông báo");
      return null;
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      console.info("[FCM] Đã nhận FCM token thành công");
      return token;
    }

    console.warn("[FCM] getToken trả về rỗng — có thể do Service Worker chưa sẵn sàng");
    return null;
  } catch (err) {
    console.error("[FCM] Lỗi khi lấy FCM token:", err);
    return null;
  }
}

/**
 * Lắng nghe tin nhắn foreground (khi app đang mở trên trình duyệt).
 * FCM onBackgroundMessage xử lý khi app ở background (qua service worker).
 *
 * @param callback Hàm xử lý khi nhận được push message ở foreground
 * @returns Hàm unsubscribe để hủy lắng nghe
 */
export function onForegroundMessage(
  callback: (payload: {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  }) => void
): () => void {
  if (!messaging) {
    // Trả về noop unsubscribe nếu chưa cấu hình
    return () => {};
  }
  return onMessage(messaging, callback);
}

export { app, messaging, isFirebaseConfigured };
