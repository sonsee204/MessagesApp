import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tiện ích kết hợp các lớp CSS của Tailwind và giải quyết xung đột lớp (Class Merging)
 * Sử dụng clsx để xử lý điều kiện và twMerge để loại trừ các class trùng lặp
 * @param inputs Danh sách các giá trị class linh hoạt
 * @returns Chuỗi class chuẩn hóa
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
