import { X, FileText } from "lucide-react";
import { cn } from "../../../../lib/utils";
import type { UploadItem } from "../../hooks/useMediaUpload";

/**
 * Chip preview 1 tệp đang chờ upload trong MediaPreviewBar.
 * Hiển thị thumbnail (ảnh) hoặc icon đuôi tệp (file/video), kèm:
 * - Lớp phủ % tiến độ khi đang upload.
 * - Lớp phủ đỏ "Lỗi" khi upload thất bại.
 * - Nút ✕ góc trên-phải để huỷ tệp trước khi gửi.
 */
export const MediaPreviewChip: React.FC<{
  item: UploadItem;
  onRemove: (id: string) => void;
}> = ({ item, onRemove }) => {
  const isImg = item.file.type.startsWith("image/");
  const ext = item.file.name.split(".").pop()?.toUpperCase() ?? "";

  return (
    <div
      role="listitem"
      className="relative w-16 h-16 rounded-xs border-2 border-uupm-line shadow-uupm-active overflow-hidden shrink-0 bg-uupm-surface"
    >
      {/* Thumbnail ảnh hoặc icon đuôi tệp */}
      {isImg ? (
        <img
          src={URL.createObjectURL(item.file)}
          alt={item.file.name}
          className="w-full h-full object-cover"
          onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
          <FileText className="w-5 h-5 text-uupm-muted" />
          <span className="text-[9px] text-uupm-muted leading-none truncate max-w-[52px] px-0.5">
            {ext}
          </span>
        </div>
      )}

      {/* Lớp phủ tiến độ upload: hiển thị % */}
      {item.status === "uploading" && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">
          {item.progress}%
        </div>
      )}

      {/* Lớp phủ lỗi: đỏ toàn chip */}
      {item.status === "error" && (
        <div className="absolute inset-0 bg-red-600/70 flex items-center justify-center text-white text-[10px] font-semibold">
          Lỗi
        </div>
      )}

      {/* Nút huỷ (✦) góc trên-phải */}
      <button
        type="button"
        aria-label={`Huỷ tệp ${item.file.name}`}
        onClick={() => onRemove(item.id)}
        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-uupm-ink text-white flex items-center justify-center hover:scale-110 transition-transform z-10"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
