import { useCallback, useRef, useState } from "react";
import { apiClient } from "../../../lib/axios";
import { toast } from "../../../stores/toast.store";
import type { MessageAttachment } from "../../../types/chat.types";

/**
 * Hook headless quản lý luồng upload media (ảnh/video/file) qua Cloudinary.
 * Toàn bộ business logic (validate, ký, upload XHR, progress) nằm ở đây —
 * component chỉ render từ `items`. Tuân thủ frontend.md §2 (tách UI khỏi logic).
 */

// Trạng thái vòng đời 1 tệp trong queue.
export type UploadStatus = "queued" | "uploading" | "done" | "error";

// Một mục queue: giữ File gốc + tiến độ + kết quả attachment sau upload.
export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number; // 0-100
  attachment?: MessageAttachment;
  error?: string;
}

// Response từ POST /api/uploads/sign (khớp SignedParams phía backend).
interface SignedParams {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  resourceType: "image" | "video" | "raw";
  maxFileSize: number;
  signature: string;
}

// Bảng giới hạn MIME / kích thước / resource_type — khớp spec §3 và backend MAX_SIZE.
const LIMITS = {
  image: { max: 10 * 1024 * 1024 }, // 10MB
  video: { max: 50 * 1024 * 1024 }, // 50MB
  raw: { max: 25 * 1024 * 1024 }, // 25MB
} as const;

// Danh sách MIME đuôi file thô (raw) được phép — chặn .exe, .svg (XSS), v.v.
const RAW_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "text/plain",
  "text/csv",
]);

// Danh sách MIME ảnh/video được phép — khớp whitelist server-side.
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

// Giới hạn tối đa số tệp mỗi tin nhắn (spec §3).
const MAX_FILES = 10;

// Phân loại file sang resource_type Cloudinary; trả null nếu MIME không được phép.
function classify(file: File): "image" | "video" | "raw" | null {
  if (IMAGE_MIMES.has(file.type)) return "image";
  if (VIDEO_MIMES.has(file.type)) return "video";
  if (RAW_MIMES.has(file.type)) return "raw";
  return null;
}

// Định dạng dung lượng bytes gọn cho toast thông báo.
function formatMB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * Hook upload media cho một cuộc trò chuyện cụ thể.
 * @param conversationId - ID conversation; folder ký sẽ là `chat/<id>`.
 */
export function useMediaUpload(conversationId: string) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // Map giữ XMLHttpRequest đang chạy để nút ✕ có thể abort từng tệp.
  const xhrs = useRef<Record<string, XMLHttpRequest>>({});

  // Chọn file: validate MIME + size + giới hạn 10 tệp, đẩy hợp lệ vào queue.
  const pickFiles = useCallback(
    (files: FileList | File[]) => {
      setItems((prev) => {
        const room = MAX_FILES - prev.length;
        if (room <= 0) {
          toast.info(`Chỉ được đính kèm tối đa ${MAX_FILES} tệp mỗi tin nhắn`);
          return prev;
        }
        const next: UploadItem[] = [];
        let overflow = 0;
        for (const file of Array.from(files)) {
          if (next.length >= room) {
            overflow++;
            continue;
          }
          const kind = classify(file);
          if (!kind) {
            toast.info(`Định dạng tệp không được hỗ trợ: ${file.name}`);
            continue;
          }
          if (file.size > LIMITS[kind].max) {
            toast.info(`Tệp ${file.name} vượt quá giới hạn ${formatMB(LIMITS[kind].max)}`);
            continue;
          }
          // crypto.randomUUID sinh id cục bộ cho queue (không đụng server).
          next.push({ id: crypto.randomUUID(), file, status: "queued", progress: 0 });
        }
        if (overflow > 0) {
          toast.info(`Vượt giới hạn ${MAX_FILES} tệp — ${overflow} tệp bị bỏ qua`);
        }
        return [...prev, ...next];
      });
    },
    []
  );

  // Cập nhật 1 item trong queue (bất biến — map sang mảng mới).
  const patchItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  // Hủy 1 tệp: abort XHR nếu đang upload, xoá khỏi queue.
  const removeItem = useCallback((id: string) => {
    xhrs.current[id]?.abort();
    delete xhrs.current[id];
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Upload 1 tệp thẳng lên Cloudinary bằng XHR (fetch không có progress event).
  const uploadOne = (
    item: UploadItem,
    sig: SignedParams
  ): Promise<MessageAttachment> =>
    new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", item.file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("folder", sig.folder);
      form.append("resource_type", sig.resourceType);
      form.append("max_file_size", String(sig.maxFileSize));
      form.append("signature", sig.signature);

      const xhr = new XMLHttpRequest();
      xhrs.current[item.id] = xhr;
      const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`;
      xhr.open("POST", endpoint);

      // Progress % thật từ upload events (đặc quyền của XHR so với fetch).
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          patchItem(item.id, { progress: Math.round((e.loaded / e.total) * 100) });
        }
      };
      xhr.onload = () => {
        delete xhrs.current[item.id];
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({
              url: data.secure_url,
              name: item.file.name,
              size: item.file.size,
              mimeType: item.file.type,
              // Video: Cloudinary tự sinh poster; ảnh/file: undefined (optional).
              thumbnailUrl: data.thumbnail_url,
              publicId: data.public_id,
            });
          } catch {
            reject(new Error("Phản hồi Cloudinary không hợp lệ"));
          }
        } else {
          reject(new Error(`Upload thất bại (HTTP ${xhr.status})`));
        }
      };
      xhr.onerror = () => {
        delete xhrs.current[item.id];
        reject(new Error("Lỗi mạng khi upload"));
      };
      xhr.onabort = () => {
        delete xhrs.current[item.id];
        reject(new Error("Đã huỷ upload"));
      };
      xhr.send(form);
    });

  // Upload toàn bộ queue: sign theo từng nhóm resourceType (1 lần/loại),
  // upload song song trong nhóm, trả về attachments thành công.
  const uploadAll = useCallback(async (): Promise<MessageAttachment[]> => {
    const pending = items.filter((i) => i.status === "queued" || i.status === "error");
    if (pending.length === 0) return [];
    setIsUploading(true);
    const folder = `chat/${conversationId}`;
    const results: MessageAttachment[] = [];
    try {
      // Gom nhóm theo resourceType để chỉ gọi /sign một lần cho mỗi loại.
      const byKind = new Map<string, UploadItem[]>();
      for (const it of pending) {
        const kind = classify(it.file);
        if (!kind) continue; // Đã validate ở pickFiles — phòng hờ MIME động đổi.
        byKind.set(kind, [...(byKind.get(kind) ?? []), it]);
      }
      for (const [kind, group] of byKind) {
        let sig: SignedParams;
        try {
          const { data } = await apiClient.post<{ success: boolean; data: SignedParams }>(
            "/uploads/sign",
            { resourceType: kind, folder }
          );
          sig = data.data;
        } catch {
          // Sign lỗi (403/401/mất mạng) → đánh dấu cả nhóm error, không chặn nhóm khác.
          group.forEach((it) =>
            patchItem(it.id, { status: "error", error: "Không lấy được chữ ký upload" })
          );
          toast.info("Không thể ký yêu cầu upload — vui lòng thử lại");
          continue;
        }
        await Promise.all(
          group.map(async (it) => {
            patchItem(it.id, { status: "uploading", progress: 0 });
            try {
              const att = await uploadOne(it, sig);
              patchItem(it.id, { status: "done", progress: 100, attachment: att });
              results.push(att);
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Upload thất bại";
              patchItem(it.id, { status: "error", error: msg });
              toast.info(`Tệp ${it.file.name}: ${msg}`);
            }
          })
        );
      }
    } finally {
      setIsUploading(false);
    }
    return results;
  }, [items, conversationId, patchItem]);

  // Reset queue sau khi gửi tin nhắn thành công (huỷ mọi XHR còn treo).
  const clear = useCallback(() => {
    Object.values(xhrs.current).forEach((x) => x.abort());
    xhrs.current = {};
    setItems([]);
  }, []);

  return { items, pickFiles, removeItem, uploadAll, clear, isUploading };
}
