import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Modal xem ảnh fullscreen.
 * - Điều hướng: ← / → chuyển ảnh, Esc đóng.
 * - Click nền tối để đóng; click ảnh không đóng (stopPropagation).
 */
export const LightboxModal: React.FC<{
  images: string[];
  index: number;
  onClose: () => void;
  onNav: (i: number) => void;
}> = ({ images, index, onClose, onNav }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNav(Math.min(index + 1, images.length - 1));
      if (e.key === "ArrowLeft") onNav(Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, images.length, onClose, onNav]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh phóng to"
    >
      {/* Nút đóng góc trên-phải */}
      <button
        type="button"
        aria-label="Đóng"
        className="absolute top-4 right-4 text-white hover:scale-110 transition-transform"
      >
        <X className="w-6 h-6" />
      </button>

      <img
        src={images[index]}
        alt={`Ảnh ${index + 1}`}
        className="max-w-[90vw] max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-xs">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
};
