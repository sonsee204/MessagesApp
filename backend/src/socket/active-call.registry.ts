/**
 * Bộ quản lý trạng thái cuộc gọi in-memory (Active Call Registry)
 *
 * Lưu trữ ánh xạ giữa ID người dùng và ID cuộc gọi đang diễn ra.
 * Là nguồn thông tin duy nhất (Single Source of Truth) để kiểm tra trạng thái bận
 * của người dùng một cách đồng bộ với độ phức tạp O(1).
 */
export class ActiveCallRegistry {
  /** Map lưu trữ cặp userId -> callId */
  private busyMap: Map<string, string> = new Map();

  /**
   * Đánh dấu người dùng đang tham gia vào một cuộc gọi (bận)
   *
   * @param userId ID người dùng
   * @param callId ID cuộc gọi đang tham gia
   */
  setBusy(userId: string, callId: string): void {
    this.busyMap.set(String(userId), String(callId));
  }

  /**
   * Giải phóng trạng thái bận cho một người dùng cụ thể
   *
   * @param userId ID người dùng cần xóa khỏi danh sách bận
   */
  clearUser(userId: string): void {
    this.busyMap.delete(String(userId));
  }

  /**
   * Kiểm tra xem người dùng có đang bận tham gia cuộc gọi nào không
   *
   * @param userId ID người dùng cần kiểm tra
   * @returns true nếu đang bận, ngược lại false
   */
  isBusy(userId: string): boolean {
    return this.busyMap.has(String(userId));
  }

  /**
   * Lấy ID cuộc gọi mà người dùng đang tham gia
   *
   * @param userId ID người dùng cần tra cứu
   * @returns ID cuộc gọi nếu người dùng đang bận, ngược lại undefined
   */
  getCallId(userId: string): string | undefined {
    return this.busyMap.get(String(userId));
  }

  /**
   * Xóa tất cả người dùng đang tham gia vào một cuộc gọi cụ thể
   * (Thường dùng khi cuộc gọi kết thúc, từ chối hoặc bị hủy để giải phóng cả caller và callee)
   *
   * @param callId ID cuộc gọi cần giải phóng
   */
  clearCall(callId: string): void {
    const targetCallId = String(callId);
    for (const [user, call] of this.busyMap.entries()) {
      if (call === targetCallId) {
        this.busyMap.delete(user);
      }
    }
  }

  /**
   * Xóa toàn bộ dữ liệu trong registry (chủ yếu phục vụ dọn dẹp hoặc kiểm thử)
   */
  clearAll(): void {
    this.busyMap.clear();
  }
}

/**
 * Thể hiện duy nhất (Singleton) của ActiveCallRegistry
 */
export const activeCallRegistry = new ActiveCallRegistry();
