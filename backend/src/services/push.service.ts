import { getMessaging } from "firebase-admin/messaging";
import { getFirebaseApp } from "../config/firebase";
import {
  IDeviceTokenRepository,
  deviceTokenRepository,
} from "../repositories/device-token.repository";

/**
 * Cấu trúc dữ liệu thông báo gửi tới thiết bị người dùng qua FCM
 */
export interface IPushNotificationPayload {
  /** Tiêu đề thông báo hiển thị trên thiết bị */
  title: string;
  /** Nội dung chi tiết thông báo */
  body: string;
  /** Dữ liệu tùy chỉnh dạng cặp khóa - giá trị chuỗi (metadata) */
  data?: Record<string, string>;
}

/**
 * Service xử lý gửi thông báo đẩy (Push Notification) qua Firebase Cloud Messaging (FCM).
 * Tuân thủ mô hình Best-effort: bắt lỗi và ghi nhận log, không làm gián đoạn luồng chính của ứng dụng.
 */
export class PushService {
  constructor(
    private deviceTokenRepo: IDeviceTokenRepository = deviceTokenRepository
  ) {}

  /**
   * Gửi thông báo đẩy đến tất cả các thiết bị đã đăng ký của một người dùng.
   * - Lấy danh sách token thiết bị từ CSDL.
   * - Nếu không có token nào: bỏ qua và kết thúc.
   * - Gửi thông báo qua FCM `sendEachForMulticast`.
   * - Tự động dọn dẹp các token không hợp lệ hoặc đã hủy đăng ký (UNREGISTERED / INVALID_ARGUMENT).
   *
   * @param userId ID người dùng nhận thông báo
   * @param payload Dữ liệu tiêu đề, nội dung và metadata của thông báo
   */
  async sendToDeviceTokens(
    userId: string,
    payload: IPushNotificationPayload
  ): Promise<void> {
    try {
      // Bước 1: Truy vấn danh sách token của người dùng từ repository
      const deviceTokens = await this.deviceTokenRepo.findByUserId(userId);
      if (!deviceTokens || deviceTokens.length === 0) {
        return;
      }

      // Lọc danh sách chuỗi token hợp lệ
      const tokens = deviceTokens.map((dt) => dt.token).filter(Boolean);
      if (tokens.length === 0) {
        return;
      }

      // Bước 2: Khởi tạo Firebase Messaging thông qua Firebase App lười
      const app = getFirebaseApp();
      const messaging = getMessaging(app);

      // Bước 3: Gửi thông báo multicast đến danh sách tokens
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      });

      // Bước 4: Kiểm tra phản hồi từng token, xóa token hết hạn hoặc không hợp lệ
      const deletePromises: Promise<void>[] = [];

      response.responses.forEach((resp, index) => {
        if (!resp.success && resp.error) {
          const errorCode = (resp.error.code || "").toLowerCase();
          const targetToken = tokens[index];

          // Nếu token không còn tồn tại hoặc cú pháp không hợp lệ trên FCM server
          if (
            targetToken &&
            (errorCode.includes("registration-token-not-registered") ||
              errorCode.includes("invalid-registration-token") ||
              errorCode.includes("invalid-argument") ||
              errorCode.includes("unregistered"))
          ) {
            deletePromises.push(
              this.deviceTokenRepo.deleteByToken(targetToken).catch((err) => {
                console.error(`[PushService] Lỗi khi xóa token ${targetToken}:`, err);
              })
            );
          }
        }
      });

      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }
    } catch (error) {
      // Best-effort: Ghi log lỗi nội bộ, không throw để bảo vệ luồng gọi API / Socket
      console.error("[PushService] Lỗi khi gửi Push Notification qua FCM:", error);
    }
  }
}

/**
 * Thể hiện mặc định (Singleton) của PushService
 */
export const pushService = new PushService();
