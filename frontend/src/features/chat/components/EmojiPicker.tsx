import React, { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import EmojiMartPicker from "@emoji-mart/react";

/** Ký hiệu emoji đã chọn trả về từ picker (chỉ lấy các trường thực sự cần cho chat) */
export interface PickedEmoji {
  native: string;
  id: string;
}

// Khóa localStorage lưu danh sách emoji gần đây (tối đa 16, per-viewer)
const RECENTS_KEY = "appmessaging:recent-emojis";
const RECENTS_MAX = 16;

/**
 * Đọc danh sách emoji (mã unicode) mới sử dụng gần đây từ bộ nhớ cục bộ.
 * Bọc try/catch vì trình duyệt ẩn danh/chặn storage sẽ ném SecurityError.
 */
const readRecentEmojis = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
};

/** Ghi nhận một emoji vừa chọn vào đầu danh sách gần đây, khử trùng lặp và cắt tối đa 16 mục */
const pushRecentEmoji = (native: string): void => {
  try {
    const next = [native, ...readRecentEmojis().filter((e) => e !== native)].slice(
      0,
      RECENTS_MAX
    );
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Bỏ qua khi storage bị chặn — tính năng recents chỉ mang tính thuận tiện
  }
};

interface EmojiPickerProps {
  /** Được gọi khi người dùng chọn một emoji */
  onSelect: (emoji: PickedEmoji) => void;
  /** Trạng thái mở/đóng điều khiển từ ngoài (để nút kích hoạt tự highlight khi popup đang mở) */
  open: boolean;
  /** Callback báo thay đổi trạng thái mở/đóng (Radix phát ra khi Escape/click-outside/chọn emoji) */
  onOpenChange: (open: boolean) => void;
  /** Phần tử kích hoạt mở picker (nút biểu tượng cảm xúc trong MessageInput) */
  children: React.ReactNode;
}

/**
 * Molecule chọn biểu tượng cảm xúc (EmojiPicker) - giao diện y hệt popup emoji Discord
 * - Lớp neo/đóng-mở dùng Radix Popover (đã có sẵn trong dependencies): mở hướng lên,
 *   tự động đóng khi bấm ra ngoài hoặc nhấn Escape, không cần tự viết click-outside.
 * - Nhân picker là @emoji-mart: phân mục, tìm kiếm theo tên emoji, da/sắc thái.
 * - Data (`@emoji-mart/data`) và i18n tiếng Việt (`vi.json`) được dynamic import để
 *   tách thành chunk riêng — chỉ tải về khi người dùng thực sự mở picker lần đầu.
 * - theme="custom" + biến --em-rgb-* map thẳng vào design tokens uupm (viền 2px, bóng cứng
 *   do popover wrapper đảm nhiệm, picker tự tắt shadow nội bộ).
 * - Section "Gần đây" (recents) lưu localStorage tối đa 16 emoji.
 */
export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onSelect,
  open,
  onOpenChange,
  children,
}) => {
  // Dữ liệu emoji + từ điển tiếng Việt chỉ được nạp sau khi mở picker lần đầu
  const [data, setData] = useState<{ emojiData: unknown; i18n: unknown } | null>(null);

  useEffect(() => {
    if (!open || data) return;
    // Dynamic import: Vite tự code-split 2 JSON lớn (~1.5MB) khỏi bundle chính
    // .catch tránh unhandled rejection nếu chunk load thất bại (rule no-promise-then-without-catch).
    Promise.all([
      import("@emoji-mart/data").then((m) => m.default),
      import("@emoji-mart/data/i18n/vi.json").then((m) => m.default),
    ])
      .then(([emojiData, i18n]) => setData({ emojiData, i18n }))
      .catch(() => {});
  }, [open, data]);

  // Xử lý một emoji được chọn: ghi vào recents, chèn vào ô nhập và đóng picker
  const handleSelect = (emoji: PickedEmoji | null) => {
    if (!emoji?.native) return;
    pushRecentEmoji(emoji.native);
    onSelect(emoji);
    onOpenChange(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-50 rounded-xs border-2 border-uupm-line bg-uupm-surface shadow-uupm-2 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 transition-transform duration-100"
          // Map biến màu custom của emoji-mart sang tokens thiết kế uupm.
          // --em-rgb-* phải là TRIPLET kênh thô (thư viện render rgb(var(--em-rgb-x) / α)).
          // Token uupm lưu HSL thô nên dùng Relative Color Syntax: oklch(from ...) xuất kênh
          // dạng 0..1, nhân 100% để trình duyệt hiểu là giá trị phần trăm hợp lệ trong rgb().
          style={
            {
              "--em-rgb-accent":
                "oklch(from hsl(var(--uupm-accent)) calc(r*100%) calc(g*100%) calc(b*100%))",
              "--em-rgb-background":
                "oklch(from hsl(var(--uupm-surface)) calc(r*100%) calc(g*100%) calc(b*100%))",
              "--em-rgb-input":
                "oklch(from hsl(var(--uupm-page)) calc(r*100%) calc(g*100%) calc(b*100%))",
              "--em-rgb-color":
                "oklch(from hsl(var(--uupm-ink)) calc(r*100%) calc(g*100%) calc(b*100%))",
              "--em-color-border": "hsl(var(--uupm-line))",
              "--em-color-border-over": "hsl(var(--uupm-line))",
            } as React.CSSProperties
          }
        >
          {data ? (
            <EmojiMartPicker
              data={data.emojiData}
              i18n={data.i18n}
              theme="custom"
              set="native"
              locale="vi"
              previewPosition="none"
              searchPosition="sticky"
              navPosition="none"
              perLine={14}
              // Khung "béo tròn": ngang rộng 520px (~14 cột emoji), cao chỉ 340px —
              // tỉ lệ landscape thoáng đãng thay vì cột hẹp cao lêu nghêu mặc định (355x420)
              dynamicWidth={false}
              width={520}
              height={340}
              maxFrequentRows={1}
              recent={readRecentEmojis()}
              onEmojiSelect={handleSelect}
            />
          ) : (
            // Khung chờ đúng kích thước gần picker để tránh giật layout (CLS) khi tải data
            <div className="w-[520px] h-[340px] flex items-center justify-center text-[11px] font-black uppercase tracking-wider text-uupm-ink-muted">
              Đang tải vốn từ emoji...
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
