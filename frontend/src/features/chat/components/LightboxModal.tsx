import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Modal xem ảnh fullscreen.
 * - Dùng native <dialog> để có focus trap + Escape đóng sẵn (rule prefer-html-dialog).
 * - Điều hướng: ← / → chuyển ảnh, Esc đóng.
 * - Click nền tối để đóng; click ảnh không đóng (stopPropagation).
 */
export const LightboxModal: React.FC<{
  images: string[];
  index: number;
  onClose: () => void;
  onNav: (i: number) => void;
}> = ({ images, index, onClose, onNav }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Mở dialog khi mount (showModal trap focus + Escape đóng)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Điều hướng bằng phím mũi tên (Escape đã có native lo)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNav(Math.min(index + 1, images.length - 1));
      if (e.key === "ArrowLeft") onNav(Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, images.length, onNav]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="Xem ảnh phóng to"
      className="m-0 w-screen h-screen max-h-none max-w-none border-0 bg-black/90 p-0 flex items-center justify-center"
    >
      {/* Backdrop là nút ẩn: click ra ngoài ảnh => đóng */}
      <button
        type="button"
        aria-label="Đóng"
        className="fixed inset-0 w-full h-full cursor-default bg-transparent border-0 p-0 m-0"
        onClick={onClose}
      />

      {/* Nút đóng góc trên-phải */}
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="relative z-10 absolute top-4 right-4 text-white hover:scale-110 transition-transform"
      >
        <X className="w-6 h-6" />
      </button>

      <img
        src={images[index]}
        alt={`Ảnh ${index + 1}`}
        className="relative z-10 max-w-[90vw] max-h-[90vh] object-contain"
      />

      {images.length > 1 && (
        <div className="relative z-10 absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-xs">
          {index + 1} / {images.length}
        </div>
      )}
    </dialog>
  );
};
