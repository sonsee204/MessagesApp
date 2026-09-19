/**
 * Kiểm tra xem userId có nằm trong danh sách participants hay không.
 *
 * Tách ra module riêng để tránh circular import khi service (vd: upload.service)
 * cần dùng hàm thuần này mà không phải import toàn bộ module socket có side-effect.
 *
 * @param participants Mảng participants — hỗ trợ plain string, ObjectId, hoặc
 *                      populated User document (có field _id).
 * @param userId ID người dùng cần kiểm tra (chuỗi hex)
 * @returns true nếu userId nằm trong participants
 */
export function isParticipant(participants: unknown[], userId: string): boolean {
  if (!Array.isArray(participants)) return false;

  return participants.some((participant) => {
    if (!participant) return false;
    // Ưu tiên _id.toString() cho populated User doc; fallback participant.toString() cho plain string/Id
    const participantId =
      (participant as { _id?: unknown })._id?.toString() ||
      (participant as { id?: unknown }).id?.toString() ||
      participant.toString();
    return participantId === userId;
  });
}
