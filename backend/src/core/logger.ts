/**
 * Giao diện tham số chi tiết khi ghi log mã lỗi và thông điệp tường minh
 */
export interface ErrorLogDetails {
  code: string;
  statusCode: number;
  message: string;
  method?: string;
  path?: string;
  details?: unknown[];
  ip?: string;
  stack?: string;
}

/**
 * Module Logger chuẩn hóa ghi log hệ thống kèm bắt và hiển thị mã lỗi tường minh
 */
export const logger = {
  // Ghi log thông tin thông thường (INFO)
  info: (message: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    console.log(`\x1b[36m[INFO]\x1b[0m [${timestamp}] ${message}`, ...args);
  },

  // Ghi log cảnh báo (WARN)
  warn: (message: string, ...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    console.warn(`\x1b[33m[WARN]\x1b[0m [${timestamp}] ${message}`, ...args);
  },

  // Ghi log lỗi cơ bản (ERROR)
  error: (message: string, error?: unknown) => {
    const timestamp = new Date().toISOString();
    console.error(`\x1b[31m[ERROR]\x1b[0m [${timestamp}] ${message}`, error ?? "");
  },

  /**
   * Bắt và in toàn bộ mã lỗi, mã trạng thái HTTP, đường dẫn và thông điệp văn bản tường minh
   */
  logError: (info: ErrorLogDetails) => {
    const timestamp = new Date().toISOString();
    const route = info.method && info.path ? `[${info.method} ${info.path}]` : "";
    const statusTag = `[HTTP ${info.statusCode}]`;
    const codeTag = `[MÃ LỖI: ${info.code}]`;

    // 1. Dòng log tổng quan nổi bật
    console.error(
      `\x1b[31m\x1b[1m[CATCH ERROR]\x1b[0m [${timestamp}] \x1b[33m${codeTag}\x1b[0m \x1b[35m${statusTag}\x1b[0m \x1b[36m${route}\x1b[0m \x1b[37m- Text tường minh:\x1b[0m \x1b[31m${info.message}\x1b[0m`
    );

    // 2. Nếu có mảng chi tiết lỗi (ví dụ lỗi Zod validation của các trường cụ thể)
    if (info.details && info.details.length > 0) {
      console.error(`  \x1b[90m├─ Chi tiết lỗi (${info.details.length} mục):\x1b[0m`);
      info.details.forEach((item, index) => {
        const isLast = index === info.details!.length - 1;
        const prefix = isLast ? "  └─" : "  ├─";

        if (typeof item === "object" && item !== null && "path" in item && "message" in item) {
          const issue = item as { path: string; message: string };
          console.error(
            `    ${prefix} \x1b[33mTrường [${issue.path}]:\x1b[0m \x1b[37m${issue.message}\x1b[0m`
          );
        } else {
          console.error(`    ${prefix} \x1b[37m${JSON.stringify(item)}\x1b[0m`);
        }
      });
    }

    // 3. Nếu có dấu vết ngăn xếp (Stack trace) cho lỗi server nội bộ
    if (info.stack && info.statusCode >= 500) {
      console.error(`  \x1b[90m└─ Stack Trace:\n${info.stack}\x1b[0m`);
    }
  },
};
