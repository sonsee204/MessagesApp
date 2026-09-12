import { z } from "zod";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const SendFriendRequestSchema = z.object({
  body: z.object({
    receiverId: z
      .string({ required_error: "ID người nhận không được để trống" })
      .regex(OBJECT_ID_REGEX, "ID người nhận không hợp lệ"),
    note: z
      .string()
      .max(200, "Lời nhắn tối đa 200 ký tự")
      .optional()
      .default(""),
  }),
});

export const PaginationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const FriendQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    onlineOnly: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  }),
});

export const RequestIdParamSchema = z.object({
  params: z.object({
    requestId: z
      .string({ required_error: "ID lời mời không được để trống" })
      .regex(OBJECT_ID_REGEX, "ID lời mời không hợp lệ"),
  }),
});

export const TargetUserParamSchema = z.object({
  params: z.object({
    targetUserId: z
      .string({ required_error: "ID người dùng mục tiêu không được để trống" })
      .regex(OBJECT_ID_REGEX, "ID người dùng mục tiêu không hợp lệ"),
  }),
});

export type SendFriendRequestInput = z.infer<typeof SendFriendRequestSchema>["body"];
export type FriendQueryInput = z.infer<typeof FriendQuerySchema>["query"];
export type PaginationQueryInput = z.infer<typeof PaginationQuerySchema>["query"];
