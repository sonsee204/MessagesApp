import { useState } from "react";
import { userService } from "../services/user.service";
import { useAuthStore } from "../../../stores/auth.store";
import { toast } from "../../../stores/toast.store";
import { formatApiError } from "../../../lib/error-formatter";
import { User } from "../../../types/auth.types";

// Giới hạn phía client phải khớp với backend (config/upload.ts).
// Kiểm tra ở đây chỉ để phản hồi nhanh cho người dùng; máy chủ vẫn là nơi xác thực thật.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Quản lý vòng đời tải ảnh lên: kiểm tra sơ bộ -> gọi API -> đẩy kết quả vào Auth Store.
 *
 * Sau khi thành công, ghi thẳng hồ sơ mới vào store để mọi nơi dùng currentUser
 * (sidebar, panel hồ sơ) đổi ảnh ngay mà không cần tải lại trang.
 *
 * TRẢ VỀ hồ sơ mới (hoặc null khi thất bại) chứ không chỉ void: form cha cần giá
 * trị URL mới để đồng bộ vào ô ẩn bannerUrl/avatarUrl. Nếu không, lần bấm
 * "Lưu thay đổi" kế tiếp sẽ ghi đè ảnh vừa tải bằng URL cũ trong form.
 *
 * @param kind Loại ảnh cần tải lên: ảnh đại diện hoặc ảnh bìa
 */
export function useImageUpload(kind: "avatar" | "banner") {
  const setUser = useAuthStore((state) => state.setUser);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<User | null> => {
    // Kiểm tra sơ bộ ở client. Không thay thế được kiểm tra phía máy chủ.
    if (!ALLOWED_TYPES.includes(file.type)) {
      const message = "Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP.";
      setError(message);
      toast.error(message, "Ảnh không hợp lệ");
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      const message = "Ảnh vượt quá dung lượng cho phép (tối đa 5MB).";
      setError(message);
      toast.error(message, "Ảnh quá lớn");
      return null;
    }

    try {
      setIsUploading(true);
      setError(null);

      const updated =
        kind === "avatar"
          ? await userService.uploadAvatar(file)
          : await userService.uploadBanner(file);

      // Đồng bộ ngay vào store để toàn bộ giao diện thấy ảnh mới
      setUser(updated);

      toast.success(
        kind === "avatar" ? "Ảnh đại diện đã được cập nhật." : "Ảnh bìa đã được cập nhật.",
        kind === "avatar" ? "Cập nhật ảnh đại diện" : "Cập nhật ảnh bìa"
      );

      // Trả hồ sơ mới để form cha đồng bộ vào ô ẩn tương ứng
      return updated;
    } catch (err: unknown) {
      const message = formatApiError(err, "Không thể tải ảnh lên. Vui lòng thử lại.");
      setError(message);
      toast.error(message, "Tải ảnh thất bại");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading, error };
}
