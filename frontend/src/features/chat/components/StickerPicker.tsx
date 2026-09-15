import React, { useCallback, useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import * as Popover from "@radix-ui/react-popover";
import { Search, X, Sticker as StickerIcon } from "lucide-react";
import { MessageAttachment } from "../../../types/chat.types";

/**
 * Cấu trúc một sticker sau khi chuẩn hóa từ phản hồi Klipy
 */
interface KlipySticker {
  slug: string;
  title: string;
  url: string; // URL ảnh .webp nền trong suốt kích thước vừa (md)
  size: number;
}

// Khóa API Klipy — cấu biến môi trường VITE_KLIPY_API_KEY trong frontend/.env.
// Key được thiết kế để public phía client (giống Giphy/Tenor), giới hạn theo app_key.
const KLIPY_API_KEY = import.meta.env.VITE_KLIPY_API_KEY as string | undefined;

/**
 * Gọi API Klipy (trending hoặc search) và chuẩn hóa về mảng KlipySticker.
 * - Không có key / lỗi mạng / API trả result=false => trả mảng rỗng để UI hiển thị Empty State.
 * - content_filter=high: chặn nội dung nhạy cảm theo chuẩn Discord/Messenger.
 */
const fetchStickers = async (
  query: string,
  signal?: AbortSignal
): Promise<KlipySticker[]> => {
  if (!KLIPY_API_KEY) return [];
  const endpoint = query.trim()
    ? `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/stickers/search?q=${encodeURIComponent(
        query.trim()
      )}&page=1&per_page=24&content_filter=high&locale=vn`
    : `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/stickers/trending?page=1&per_page=24&content_filter=high&locale=vn`;

  try {
    const res = await fetch(endpoint, { signal });
    if (!res.ok) return [];
    const json = await res.json();
    const items: any[] = json?.data?.data ?? [];
    // Ưu tiên webp cỡ vừa (nền trong suốt, dung lượng nhỏ); bỏ qua sticker thiếu ảnh hợp lệ
    return items
      .map((it) => {
        const media = it?.file?.md?.webp ?? it?.file?.hd?.webp;
        if (!media?.url) return null;
        return {
          slug: String(it.slug ?? it.id ?? media.url),
          title: String(it.title ?? "Sticker"),
          url: String(media.url),
          size: Number(media.size ?? 0),
        } as KlipySticker;
      })
      .filter((s): s is KlipySticker => s !== null);
  } catch {
    return [];
  }
};

interface StickerPickerProps {
  /** Được gọi khi người dùng chọn một sticker (kèm dữ liệu đính kèm đã chuẩn hóa) */
  onSelect: (attachment: MessageAttachment) => void;
  /** Trạng thái mở/đóng điều khiển từ ngoài (nút Sticker highlight khi popup đang mở) */
  open: boolean;
  /** Callback báo thay đổi trạng thái mở/đóng (Radix phát ra khi Escape/click-outside) */
  onOpenChange: (open: boolean) => void;
  /** Phần tử kích hoạt mở picker (nút Nhãn dán trong MessageInput) */
  children: React.ReactNode;
}

/**
 * Molecule chọn Nhãn dán (StickerPicker) — kho sticker Klipy (đối tác chính thức của Tenor/Giphy tại VN)
 * - Lớp neo/đóng-mở dùng Radix Popover, cùng kiểu khung và theme tokens với EmojiPicker
 *   (mở hướng lên, rộng 520 x cao 340, viền 2px, bóng cứng).
 * - Chưa gõ gì: hiển thị bảng "Thịnh hành" (trending). Gõ từ khóa: tìm kiếm, debounce 350ms.
 * - Chọn sticker => gửi ngay tin nhắn type IMAGE kèm attachment (không chèn vào ô nhập).
 * - API key thiếu hoặc lỗi mạng => Empty State hướng dẫn, không crash.
 */
export const StickerPicker: React.FC<StickerPickerProps> = ({
  onSelect,
  open,
  onOpenChange,
  children,
}) => {
  const [query, setQuery] = useState<string>("");
  // Từ khóa trễ 350ms chống bão request khi gõ nhanh
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  // Đồng bộ từ khóa đã debounce (không fetch — chỉ đổi state, rule no-fetch-in-effect)
  const handleQueryChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setDebouncedQuery(value), 350);
  };

  // Hủy timer còn treo khi unmount để tránh setState trên component đã gỡ
  useEffect(() => () => clearTimeout(debounceTimerRef.current), []);

  // Tầng dữ liệu React Query lo fetch/cache/hủy request — thay cho useEffect thủ công
  const { data: stickers = [], isFetching: isLoading } = useQuery({
    queryKey: ["stickers", debouncedQuery],
    queryFn: ({ signal }) => fetchStickers(debouncedQuery, signal),
    enabled: open && !!KLIPY_API_KEY,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    // Giữ kết quả cũ khi đổi từ khóa: lưới sticker không nháy trắng rồi mới hiện skeleton
    placeholderData: keepPreviousData,
  });

  // Bấm một sticker: chuẩn hóa thành attachment webp và bắn ngược lên cha, đồng thời đóng popup
  const handlePick = useCallback(
    (sticker: KlipySticker) => {
      onSelect({
        url: sticker.url,
        name: `${sticker.slug}.webp`,
        size: sticker.size,
        mimeType: "image/webp",
      });
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          // Bỏ transition-transform (xung đột với animate-in gây nháy lúc đóng) —
          // thay bằng cặp animate-out đối xứng để đóng mượt đúng chủ đích.
          className="z-50 w-[520px] rounded-xs border-2 border-uupm-line bg-uupm-surface shadow-uupm-2 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-100"
        >
          {/* Thanh tìm kiếm sticker cố định trên đầu */}
          <div className="flex items-center gap-2 p-2 border-b-2 border-uupm-line">
            <Search className="w-3.5 h-3.5 text-uupm-ink-muted shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Tìm kiếm sticker..."
              className="flex-1 text-xs font-semibold text-uupm-ink placeholder:text-uupm-ink-muted bg-transparent focus:outline-none"
              aria-label="Tìm kiếm sticker"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setDebouncedQuery(""); }}
                className="p-0.5 rounded-xs hover:bg-uupm-surface-strong text-uupm-ink-muted cursor-pointer"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Vùng lưới sticker: cao cố định 296px (340 tổng - 44 header) để tránh giật layout */}
          <div className="h-[296px] overflow-y-auto p-2">
            {!KLIPY_API_KEY ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6">
                <StickerIcon className="w-8 h-8 text-uupm-ink-muted" />
                <p className="text-xs font-bold text-uupm-ink">Chưa cấu hình kho sticker</p>
                <p className="text-[11px] font-semibold text-uupm-ink-muted">
                  Thêm <code>VITE_KLIPY_API_KEY</code> vào <code>frontend/.env</code> (đăng ký miễn
                  phí tại klipy.com/developers) rồi khởi động lại Vite.
                </p>
              </div>
            ) : isLoading && stickers.length === 0 ? (
              // Skeleton 6 ô giữ đúng nhịp lưới, mô phỏng cấu trúc thay vì quay tròn
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xs bg-uupm-surface-hover animate-pulse"
                  />
                ))}
              </div>
            ) : stickers.length === 0 && !isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <StickerIcon className="w-8 h-8 text-uupm-ink-muted" />
                <p className="text-xs font-bold text-uupm-ink">
                  Không tìm thấy sticker cho "{query}"
                </p>
                <p className="text-[11px] font-semibold text-uupm-ink-muted">
                  Thử từ khóa khác nhé!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {stickers.map((sticker) => (
                  <button
                    key={sticker.slug}
                    type="button"
                    onClick={() => handlePick(sticker)}
                    title={sticker.title}
                    aria-label={`Gửi sticker ${sticker.title}`}
                    className="aspect-square rounded-xs border-2 border-uupm-line bg-uupm-page hover:border-uupm-accent hover:shadow-uupm-active flex items-center justify-center overflow-hidden cursor-pointer transition-[background-color,box-shadow,transform] active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    {/* Nền caro mờ hiển thị vùng trong suốt của sticker (kiểu Discord) */}
                    <img
                      src={sticker.url}
                      alt={sticker.title}
                      loading="lazy"
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
