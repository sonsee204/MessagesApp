import { z } from "zod";

export const CreateConversationSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, "Tiêu đề cuộc trò chuyện không được để trống").optional(),
    type: z.enum(["DIRECT", "GROUP"]).default("DIRECT"),
    participantIds: z
      .array(z.string().min(1))
      .min(1, "Cuộc trò chuyện phải có ít nhất 1 người tham gia"),
    // Lưu ý: KHÔNG khai báo `createdBy` ở đây. Người tạo luôn được Controller
    // trích xuất từ JWT (req.user.userId) rồi truyền thành `creatorId` xuống Service.
    // Nhận ID người tạo từ client sẽ cho phép giả mạo danh tính (Mass Assignment).
  }),
});

export const GetConversationParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1, "ID cuộc trò chuyện không được để trống"),
  }),
});

export type CreateConversationDTO = z.infer<typeof CreateConversationSchema>["body"];
