import React, { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "../../../components/ui/Button";

interface ImageUploadButtonProps {
  label: string;
  // Mô tả cho trình đọc màn hình, vì nút chỉ có icon + nhãn ngắn
  ariaLabel?: string;
  accept?: string;
  isUploading?: boolean;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
}

/**
 * Nút chọn tệp ảnh từ máy người dùng.
 * Thuần trình bày: chỉ mở hộp thoại chọn tệp và đẩy File ra ngoài qua callback,
 * không gọi API (việc đó nằm ở hook useImageUpload).
 */
export const ImageUploadButton: React.FC<ImageUploadButtonProps> = ({
  label,
  ariaLabel,
  accept = "image/jpeg,image/png,image/webp",
  isUploading = false,
  disabled = false,
  onFileSelected,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // LUÔN reset giá trị input ngay sau khi đọc tệp. Nếu không, chọn lại CÙNG một
    // tệp ở lần sau sẽ không kích hoạt onChange (trình duyệt thấy giá trị không đổi).
    event.target.value = "";

    if (file) onFileSelected(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        // Không cho chọn tệp khi đang tải lên, tránh chồng request
        disabled={disabled || isUploading}
        aria-hidden="true"
        tabIndex={-1}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={<Upload className="w-3.5 h-3.5" />}
        isLoading={isUploading}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
    </>
  );
};
