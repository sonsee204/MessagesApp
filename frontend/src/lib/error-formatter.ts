import axios, { AxiosError } from "axios";
import { ApiResponse } from "../types/auth.types";

/**
 * Hàm phân tích và Việt hóa 100% tất cả các loại lỗi từ Axios, HTTP và Server (Error Formatter)
 * Giải quyết triệt để vấn đề thông báo lỗi tiếng Anh mặc định của Axios (vd: "Request failed with status code 401")
 *
 * Thứ tự ưu tiên trích xuất thông điệp lỗi:
 * 1. Thông báo lỗi nghiệp vụ rõ ràng từ Backend (response.data.error.message)
 * 2. Chi tiết lỗi kiểm tra dữ liệu Zod từ Backend (response.data.error.details)
 * 3. Bản dịch theo mã trạng thái HTTP tiêu chuẩn (400, 401, 403, 404, 409, 429, 500...)
 * 4. Lỗi kết nối mạng (Network Error, ERR_NETWORK)
 * 5. Thông điệp dự phòng tiếng Việt thân thiện
 *
 * @param error Ngoại lệ bất kỳ được bắt trong khối try/catch
 * @param fallbackMessage Thông điệp dự phòng nếu không trích xuất được
 * @returns Chuỗi thông báo lỗi tiếng Việt rõ ràng, dễ hiểu
 */
export function formatApiError(error: unknown, fallbackMessage = "Đã xảy ra lỗi. Vui lòng thử lại."): string {
  // Trường hợp 1: Lỗi từ Axios (AxiosError)
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiResponse>;

    // 1.1 Trích xuất thông báo lỗi chính từ Backend
    const backendErrorMessage = axiosError.response?.data?.error?.message;
    if (backendErrorMessage && typeof backendErrorMessage === "string" && backendErrorMessage.trim()) {
      return backendErrorMessage.trim();
    }

    // 1.2 Trích xuất chi tiết lỗi xác thực dữ liệu (Validation Details) nếu có
    const details = axiosError.response?.data?.error?.details;
    if (Array.isArray(details) && details.length > 0) {
      const firstDetail = details[0];
      if (typeof firstDetail === "string") {
        return firstDetail;
      }
      if (typeof firstDetail === "object" && firstDetail !== null && "message" in firstDetail) {
        return String((firstDetail as { message: string }).message);
      }
    }

    // 1.3 Thông điệp dạng message đơn giản từ server
    const genericMessage = (axiosError.response?.data as unknown as Record<string, unknown>)?.message;
    if (genericMessage && typeof genericMessage === "string" && genericMessage.trim()) {
      return genericMessage.trim();
    }

    // 1.4 Xử lý theo mã trạng thái HTTP nếu Backend không trả về message cụ thể
    const status = axiosError.response?.status;
    if (status) {
      switch (status) {
        case 400:
          return "Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin đã nhập.";
        case 401:
          return "Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.";
        case 403:
          return "Bạn không có quyền truy cập hoặc phiên đăng nhập đã hết hạn.";
        case 404:
          return "Không tìm thấy tài nguyên yêu cầu trên hệ thống.";
        case 409:
          return "Tên đăng nhập hoặc địa chỉ email này đã tồn tại trong hệ thống.";
        case 422:
          return "Dữ liệu nhập vào chưa đúng định dạng yêu cầu.";
        case 429:
          return "Bạn đã thao tác quá nhiều lần liên tiếp. Vui lòng chờ giây lát rồi thử lại.";
        case 500:
        case 502:
        case 503:
        case 504:
          return "Máy chủ đang gặp sự cố nội bộ. Vui lòng thử lại sau ít phút.";
        default:
          return `Máy chủ phản hồi mã lỗi (${status}). Vui lòng thử lại sau.`;
      }
    }

    // 1.5 Xử lý lỗi không có kết nối mạng tới Backend
    if (
      axiosError.code === "ERR_NETWORK" ||
      axiosError.message?.toLowerCase().includes("network error") ||
      axiosError.message?.toLowerCase().includes("failed to fetch")
    ) {
      return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc đảm bảo Backend đang chạy.";
    }

    // 1.6 Xử lý lỗi quá thời gian chờ (Timeout)
    if (axiosError.code === "ECONNABORTED" || axiosError.message?.toLowerCase().includes("timeout")) {
      return "Yêu cầu quá thời gian phản hồi. Vui lòng thử lại.";
    }
  }

  // Trường hợp 2: Lỗi là đối tượng Error tiêu chuẩn trong JS
  if (error instanceof Error) {
    const rawMessage = error.message;

    // Bắt và dịch các chuỗi lỗi tiếng Anh phổ biến của Axios/HTTP
    if (rawMessage.includes("Request failed with status code 401")) {
      return "Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.";
    }
    if (rawMessage.includes("Request failed with status code 400")) {
      return "Thông tin gửi lên không hợp lệ. Vui lòng kiểm tra lại dữ liệu.";
    }
    if (rawMessage.includes("Request failed with status code 409")) {
      return "Tài khoản, email hoặc tên người dùng đã tồn tại trong hệ thống.";
    }
    if (rawMessage.includes("Request failed with status code 429")) {
      return "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.";
    }
    if (rawMessage.includes("Request failed with status code 500")) {
      return "Máy chủ đang gặp sự cố nội bộ. Vui lòng thử lại sau.";
    }
    if (rawMessage.includes("Network Error")) {
      return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.";
    }

    // Nếu thông báo lỗi đã là tiếng Việt thì giữ nguyên
    if (rawMessage && !rawMessage.startsWith("Request failed with status code")) {
      return rawMessage;
    }
  }

  // Trường hợp 3: Trả về thông điệp dự phòng mặc định
  return fallbackMessage;
}
