import { MediaPreviewChip } from "./atoms/MediaPreviewChip";
import type { UploadItem } from "../hooks/useMediaUpload";

/**
 * Dãy chip preview các tệp đang chờ upload — hiển thị phía trên MessageInput.
 * Cuộn ngang khi nhiều tệp (>4), giữ giao diện gọn, không che input chính.
 * Tuân thủ frontend.md §4: Empty = không render gì khi rỗng.
 */
export const MediaPreviewBar: React.FC<{
  items: UploadItem[];
  onRemove: (id: string) => void;
}> = ({ items, onRemove }) => {
  if (items.length === 0) return null;

  return (
    <ul
      className="flex gap-2 overflow-x-auto pb-2 px-1 list-none m-0 p-0"
      aria-label="Tệp đính kèm đang chờ gửi"
    >
      {items.map((it) => (
        <li key={it.id} className="list-none">
          <MediaPreviewChip item={it} onRemove={onRemove} />
        </li>
      ))}
    </ul>
  );
};
