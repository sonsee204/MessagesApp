import { useState, useEffect, useRef } from "react";
import { Agentation } from "agentation";
import { apiClient } from "./lib/axios";
import { disconnectSocket } from "./lib/socket";
import { useAuthStore } from "./stores/auth.store";
import { useChatStore } from "./features/chat/stores/chat.store";
import { authService } from "./features/auth/services/auth.service";
import { AuthPage } from "./features/auth/pages/AuthPage";
import { ChatLayout } from "./features/chat/components/ChatLayout";
import { ToastContainer } from "./components/ui/Toast";
import { toast } from "./stores/toast.store";
import { CallRoot } from "./features/call/components/CallRoot";
import {
  requestNotificationPermission,
  isFirebaseConfigured,
} from "./lib/firebase";
import { callService } from "./features/call/services/call.service";

/**
 * Ứng dụng chính (App Root) chuẩn UI/UX Pro Max - Bố cục Tràn màn hình Discord:
 * 1. Khôi phục phiên ngầm tự động (Silent Session Restoration)
 * 2. Điều hướng trực tiếp giữa Trang Đăng Nhập/Đăng Ký và Không gian Chat tràn viền 100vw x 100vh
 * 3. Tự động ngắt kết nối Socket và dọn dẹp RAM Store khi đăng xuất
 */
export function App() {
  const { isAuthenticated, clearAuth, setAuth } = useAuthStore();
  const clearChatStore = useChatStore((state) => state.clearChatStore);

  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);

  // Ref lưu FCM token hiện tại để xóa khỏi server khi logout (null nếu chưa đăng ký push)
  const fcmTokenRef = useRef<string | null>(null);

  // 1. Thử khôi phục phiên làm việc khi người dùng tải lại trang (Silent Session Restoration)
  useEffect(() => {
    // Cờ huỷ: ngăn setState sau await nếu component unmount (rule no-set-state-after-await-in-effect).
    let cancelled = false;
    const restoreSession = async () => {
      try {
        // Gửi yêu cầu làm mới token ngầm thông qua Signed Cookie sẵn có trong trình duyệt
        const refreshResponse = await apiClient.post("/auth/refresh");
        if (cancelled) return;
        if (refreshResponse.data?.success && refreshResponse.data?.data) {
          const { user: restoredUser, accessToken } = refreshResponse.data.data;
          setAuth(restoredUser, accessToken);
        }
      } catch {
        // Nếu không có cookie hoặc phiên đã hết hạn, giữ nguyên trạng thái chưa đăng nhập
      } finally {
        if (!cancelled) setIsCheckingSession(false);
      }
    };

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [setAuth]);

  // 2. Xử lý hành động Đăng xuất (Logout)
  const handleLogout = async () => {
    try {
      // Xóa FCM device token khỏi server trước khi thu hồi phiên (best-effort, không chặn logout)
      if (fcmTokenRef.current) {
        try {
          await callService.removeDeviceToken(fcmTokenRef.current);
        } catch {
          console.warn("[FCM] Không thể xóa device token khi logout");
        }
        fcmTokenRef.current = null;
      }
      // Gọi API đăng xuất để thu hồi Refresh Token trong DB và xóa Signed Cookie
      await authService.logout();
    } catch (err) {
      console.error("Lỗi khi đăng xuất:", err);
    } finally {
      // Dọn dẹp kết nối Socket.IO
      disconnectSocket();
      // Xóa sạch trạng thái tin nhắn và hội thoại trong Chat Store
      clearChatStore();
      // Xóa thông tin người dùng khỏi Zustand RAM Store
      clearAuth();
      // Hiển thị thông báo đăng xuất thành công
      toast.info("Đã đăng xuất tài khoản an toàn khỏi hệ thống.", "Đăng xuất thành công");
    }
  };

  // 3. Đăng ký FCM push notification khi người dùng đã xác thực phiên thành công
  useEffect(() => {
    // Bỏ qua nếu chưa cấu hình Firebase hoặc chưa đăng nhập
    if (!isAuthenticated || !isFirebaseConfigured) return;

    // Cờ huỷ: tránh gọi API sau khi effect cleanup (user logout nhanh / unmount)
    let cancelled = false;

    const registerFcmToken = async () => {
      try {
        // Xin quyền Notification + nhận FCM registration token từ Firebase SDK
        const token = await requestNotificationPermission();
        if (cancelled || !token) return;

        // Gửi token lên backend lưu vào DeviceTokenModel (POST /api/calls/device-tokens)
        await callService.registerDeviceToken(token, "web");
        // Giữ reference để xóa token khi logout
        fcmTokenRef.current = token;
      } catch (err) {
        console.error("[FCM] Đăng ký device token thất bại:", err);
      }
    };

    void registerFcmToken();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Màn hình chờ khởi tạo khi đang kiểm tra khôi phục phiên làm việc
  if (isCheckingSession) {
    return (
      <div className="min-h-dvh bg-uupm-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 p-6 bg-uupm-surface border-2 border-uupm-line rounded-xs shadow-uupm-2">
          <div className="w-8 h-8 border-4 border-uupm-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-uupm-ink uppercase tracking-wider">
            Đang khởi tạo hệ thống...
          </p>
        </div>
      </div>
    );
  }

  // Nếu người dùng chưa đăng nhập, hiển thị trang Xác thực AuthPage
  if (!isAuthenticated) {
    return (
      <>
        <AuthPage />
        {/* Khung hiển thị thông báo Toast Popup toàn ứng dụng */}
        <ToastContainer />
        {/* Thanh công cụ Agentation (Visual Feedback Toolbar cho AI Coding Agents - https://www.agentation.com/) */}
        {import.meta.env.DEV && <Agentation />}
      </>
    );
  }

  // Khi đã đăng nhập, hiển thị Không gian Chat tràn viền 100% màn hình bọc trong CallRoot
  return (
    <CallRoot>
      <div className="h-dvh w-full bg-uupm-surface text-uupm-ink flex flex-col selection:bg-uupm-accent selection:text-uupm-accent-text overflow-hidden">
        <main className="flex-1 w-full h-full overflow-hidden"><ChatLayout onLogout={handleLogout} /></main>
      </div>

      {/* Khung hiển thị thông báo Toast Popup toàn ứng dụng */}
      <ToastContainer />

      {/* Thanh công cụ Agentation (Visual Feedback Toolbar cho AI Coding Agents - https://www.agentation.com/) */}
      {import.meta.env.DEV && <Agentation />}
    </CallRoot>
  );
}
