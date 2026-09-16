import { initializeApp, cert, App, getApps } from "firebase-admin/app";

/**
 * Biến lưu thể hiện Firebase Admin App sau khi khởi tạo (Singleton Lazy Cache)
 */
let firebaseApp: App | null = null;

/**
 * Lấy thể hiện Firebase Admin App (Lazy Evaluation).
 * Chỉ đọc biến môi trường và khởi tạo khi hàm được gọi lần đầu tiên,
 * tránh làm crash ứng dụng trong lúc khởi động nếu chưa cấu hình Firebase.
 *
 * @throws Error khi thiếu các biến môi trường bắt buộc của Firebase
 * @returns Thể hiện Firebase Admin App
 */
export function getFirebaseApp(): App {
  if (firebaseApp) {
    return firebaseApp;
  }

  // Tái sử dụng app đã có nếu được khởi tạo từ trước
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error(
      "Thiếu cấu hình Firebase (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)"
    );
  }

  firebaseApp = initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });

  return firebaseApp;
}
