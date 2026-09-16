import { z } from "zod";

/**
 * Schema xác thực tham số phân trang trong truy vấn lịch sử cuộc gọi (GET /api/calls)
 * - `page`: Số trang hiện tại (bắt đầu từ 1, mặc định 1)
 * - `limit`: Số lượng bản ghi mỗi trang (tối đa 100, mặc định 20)
 */
export const CallHistoryQuerySchema = z.object({
  query: z
    .object({
      page: z.coerce
        .number({ invalid_type_error: "page phải là số nguyên hợp lệ" })
        .int("page phải là số nguyên")
        .positive("page phải lớn hơn 0")
        .default(1),
      limit: z.coerce
        .number({ invalid_type_error: "limit phải là số nguyên hợp lệ" })
        .int("limit phải là số nguyên")
        .positive("limit phải lớn hơn 0")
        .max(100, "limit không được vượt quá 100")
        .default(20),
    })
    .strict(),
});

/**
 * Schema xác thực dữ liệu gửi lên khi đăng ký token thiết bị (POST /api/calls/device-tokens)
 * - `token`: Chuỗi định danh token thiết bị từ FCM
 * - `platform`: Nền tảng ứng dụng (web, android, ios)
 */
export const DeviceTokenBodySchema = z.object({
  body: z
    .object({
      token: z.string().min(1, "token không được để trống"),
      platform: z.enum(["web", "android", "ios"], {
        errorMap: () => ({ message: "platform phải là web, android hoặc ios" }),
      }),
    })
    .strict(),
});

/**
 * Schema xác thực dữ liệu khi hủy đăng ký hoặc thu hồi token thiết bị (DELETE /api/calls/device-tokens)
 * - `token`: Chuỗi token thiết bị cần xóa
 */
export const DeleteDeviceTokenSchema = z.object({
  body: z
    .object({
      token: z.string().min(1, "token không được để trống"),
    })
    .strict(),
});

/** Kiểu dữ liệu đầu vào cho truy vấn lịch sử cuộc gọi */
export type CallHistoryQueryDTO = z.infer<typeof CallHistoryQuerySchema>["query"];

/** Kiểu dữ liệu đầu vào khi đăng ký token thiết bị */
export type DeviceTokenBodyDTO = z.infer<typeof DeviceTokenBodySchema>["body"];

/** Kiểu dữ liệu đầu vào khi xóa token thiết bị */
export type DeleteDeviceTokenDTO = z.infer<typeof DeleteDeviceTokenSchema>["body"];
