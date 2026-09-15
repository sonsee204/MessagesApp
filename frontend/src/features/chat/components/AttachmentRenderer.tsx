import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { MessageAttachment } from "../../../types/chat.types";
import { LightboxModal } from "./LightboxModal";

/**
 * Render attachments trong bubble tin nhắn — phân loại theo MIME (4 UI states).
 * - Ảnh: grid (1 hoặc 2 cột), click mở LightboxModal xem fullscreen.
 * - Video: player có poster (thumbnailUrl), bo góc, viền vật lý.
 * - File: card tải xuống (icon + tên + dung lượng + nút download).
 * - Empty: không render gì khi mảng rỗng.
 * Tuân thủ frontend.md §4 (xử lý đủ Loading/Empty/Error/Success).
 */
export const AttachmentRenderer: React.FC<{ attachments: MessageAttachment[] }> = ({
  attachments,
}) => {
  const [lightbox, setLightbox] = useState<number | null>(null);

  // Empty state: không có gì thì không render.
  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  const videos = attachments.filter((a) => a.mimeType.startsWith("video/"));
  const files = attachments.filter(
    (a) => !a.mimeType.startsWith("image/") && !a.mimeType.startsWith("video/")
  );

  return (
    <div className="flex flex-col gap-2 mt-2">
      {/* Ảnh: grid tối đa 2 cột, click mở Lightbox */}
      {images.length > 0 && (
        <div className={cn("grid gap-1", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {images.map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt={img.name}
              loading="lazy"
              onClick={() => setLightbox(i)}
              className="w-full max-w-[240px] rounded-xs border-2 border-uupm-line object-cover cursor-pointer hover:opacity-90 transition-opacity"
            />
          ))}
        </div>
      )}
      {lightbox !== null && (
        <LightboxModal
          images={images.map((i) => i.url)}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNav={setLightbox}
        />
      )}

      {/* Video: player native có poster thumbnail */}
      {videos.map((v, i) => (
        <video
          key={i}
          controls
          poster={v.thumbnailUrl}
          className="w-full max-w-[320px] rounded-xs border-2 border-uupm-line"
        >
          <source src={v.url} type={v.mimeType} />
        </video>
      ))}

      {/* File: card tải xuống — chỉ render link download, KHÔNG iframe (chặn XSS) */}
      {files.map((f, i) => (
        <a
          key={i}
          href={f.url}
          download={f.name}
          className="flex items-center gap-2 p-2 rounded-xs border-2 border-uupm-line bg-uupm-surface hover:bg-uupm-accent-soft transition-colors"
        >
          <FileText className="w-5 h-5 text-uupm-ink shrink-0" />
          <span className="text-sm truncate flex-1">{f.name}</span>
          <span className="text-xs text-uupm-muted">{(f.size / 1024).toFixed(0)}KB</span>
          <Download className="w-4 h-4" />
        </a>
      ))}
    </div>
  );
};
