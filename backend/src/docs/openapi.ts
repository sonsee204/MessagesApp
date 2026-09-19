import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
  type RouteConfig,
  type ZodRequestBody,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Kích hoạt phương thức .openapi() cho toàn bộ Zod Schema trong tiến trình (bắt buộc chạy trước khi đăng ký)
extendZodWithOpenApi(z);

// Tái sử dụng chính xác các Zod Schema đang dùng để validate ở middleware → tài liệu không bao giờ lệch khỏi code
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from "../schemas/auth.schema";
import {
  CreateConversationSchema,
  GetConversationParamsSchema,
} from "../schemas/conversation.schema";
import {
  UpdateProfileSchema,
  ChangePasswordSchema,
  SearchUsersQuerySchema,
  GetUserByIdParamsSchema,
} from "../schemas/user.schema";
import {
  SendFriendRequestSchema,
  FriendQuerySchema,
  PaginationQuerySchema,
  RequestIdParamSchema,
  TargetUserParamSchema,
} from "../schemas/friend.schema";
import {
  SendMessageSchema,
  GetMessagesQuerySchema,
  RecallMessageParamsSchema,
  MarkMessagesAsReadParamsSchema,
} from "../schemas/message.schema";

/* ==========================================================================
   KHỐI 1: CÁC ZOD SCHEMA MÔ TẢ DỮ LIỆU PHẢN HỒI (RESPONSE DTO SCHEMAS)
   ========================================================================== */

/** Đối tượng lỗi chuẩn hóa dùng chung cho mọi phản hồi thất bại của hệ thống */
const ErrorResponseSchema = z
  .object({
    success: z.literal(false).openapi({ description: "Luôn là false với phản hồi lỗi" }),
    error: z.object({
      code: z.string().openapi({ example: "RESOURCE_NOT_FOUND", description: "Mã lỗi nghiệp vụ dạng SCREAMING_SNAKE_CASE" }),
      message: z.string().openapi({ example: "Không tìm thấy tài nguyên", description: "Thông điệp lỗi hiển thị cho người dùng" }),
      details: z.array(z.unknown()).openapi({ description: "Chi tiết lỗi bổ sung (mảng rỗng nếu không có)" }),
    }),
  })
  .openapi("ErrorResponse");

/** Metadata phân trang kiểu offset (page / limit) */
const PaginationMetaSchema = z
  .object({
    total: z.number().int().openapi({ example: 42, description: "Tổng số bản ghi thỏa điều kiện" }),
    page: z.number().int().openapi({ example: 1, description: "Trang hiện tại" }),
    limit: z.number().int().openapi({ example: 20, description: "Số bản ghi mỗi trang" }),
    totalPages: z.number().int().openapi({ example: 3, description: "Tổng số trang" }),
  })
  .openapi("PaginationMeta");

/** Metadata phân trang kiểu con trỏ (cursor-based) dùng cho luồng tin nhắn */
const CursorPaginationSchema = z
  .object({
    nextCursor: z.string().nullable().openapi({ description: "Con trỏ cho lần tải tiếp theo (null nếu đã hết)" }),
    hasMore: z.boolean().openapi({ description: "Còn dữ liệu phía sau con trỏ hay không" }),
  })
  .openapi("CursorPagination");

/** Người dùng công khai — tuyệt đối không chứa passwordHash */
const UserPublicSchema = z
  .object({
    id: z.string().openapi({ example: "652f1a2b3c4d5e6f7a8b9c0d" }),
    username: z.string().openapi({ example: "haxuanson" }),
    email: z.string().email().openapi({ example: "user@example.com" }),
    displayName: z.string().nullable().openapi({ example: "Hà Xuân Sơn" }),
    avatarUrl: z.string().nullable().openapi({ description: "Đường dẫn ảnh đại diện" }),
    bannerUrl: z.string().nullable().openapi({ description: "Đường dẫn ảnh bìa trang hồ sơ" }),
    bio: z.string().nullable().openapi({ description: "Tiểu sử người dùng" }),
    statusMessage: z.string().nullable().openapi({ description: "Trạng thái hiện tại" }),
    role: z.enum(["USER", "ADMIN"]).openapi({ description: "Vai trò trong hệ thống" }),
    isOnline: z.boolean().openapi({ description: "Trạng thái hoạt động trực tuyến" }),
    lastSeenAt: z.string().datetime().nullable().openapi({ description: "Thời điểm truy cập gần nhất" }),
    createdAt: z.string().datetime().openapi({ description: "Thời điểm tạo tài khoản" }),
    updatedAt: z.string().datetime().openapi({ description: "Thời điểm cập nhật gần nhất" }),
  })
  .openapi("UserPublic");

/** Cặp token trả về sau khi đăng ký / đăng nhập / làm mới token */
const AuthTokenSchema = z
  .object({
    user: UserPublicSchema.omit({ bio: true, statusMessage: true, role: true, isOnline: true, lastSeenAt: true, createdAt: true, updatedAt: true }),
    accessToken: z.string().openapi({ description: "Access Token ngắn hạn dùng cho header Authorization" }),
    refreshToken: z.string().openapi({ description: "Refresh Token dài hạn dùng để lấy Access Token mới" }),
    token: z.string().openapi({ description: "Bí danh của accessToken (tương thích ngược cho client cũ)" }),
  })
  .openapi("AuthToken");

/** Tệp đính kèm trong tin nhắn */
const AttachmentSchema = z
  .object({
    url: z.string().url().openapi({ description: "Đường dẫn tệp" }),
    name: z.string().openapi({ description: "Tên tệp hiển thị" }),
    size: z.number().openapi({ description: "Dung lượng tệp tính bằng bytes" }),
    mimeType: z.string().openapi({ example: "image/png" }),
  })
  .openapi("Attachment");

/** Tin nhắn trong cuộc trò chuyện */
const MessageSchema = z
  .object({
    id: z.string().openapi({ example: "652f1a2b3c4d5e6f7a8b9c0d" }),
    conversationId: z.string().openapi({ description: "ID cuộc trò chuyện chứa tin nhắn" }),
    senderId: z.string().openapi({ description: "ID người gửi (luôn là chuỗi)" }),
    sender: UserPublicSchema.optional().openapi({
      description: "Thông tin người gửi (chỉ có khi Backend populate trường senderId)",
    }),
    content: z.string().openapi({ description: "Nội dung văn bản của tin nhắn" }),
    type: z.enum(["TEXT", "IMAGE", "FILE", "SYSTEM"]),
    attachments: z.array(AttachmentSchema),
    replyToMessageId: z.string().nullable().openapi({ description: "ID tin nhắn được trả lời (nếu có)" }),
    readBy: z.array(z.string()).openapi({ description: "Danh sách ID người đã đọc tin nhắn" }),
    isDeleted: z.boolean().openapi({ description: "Đánh dấu tin nhắn đã bị thu hồi (soft delete)" }),
    deletedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Message");

/** Cuộc trò chuyện (1-1 hoặc nhóm) */
const ConversationSchema = z
  .object({
    id: z.string().openapi({ example: "652f1a2b3c4d5e6f7a8b9c0d" }),
    title: z.string().nullable().openapi({ description: "Tiêu đề nhóm (null với hội thoại 1-1)" }),
    type: z.enum(["DIRECT", "GROUP"]),
    participants: z.array(z.string()).openapi({ description: "Danh sách ID thành viên tham gia" }),
    lastMessage: MessageSchema.nullable().openapi({ description: "Tin nhắn gần nhất trong hội thoại" }),
    lastMessageAt: z.string().datetime().nullable(),
    createdBy: z.string().openapi({ description: "ID người tạo cuộc trò chuyện" }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Conversation");

/** Lời mời kết bạn */
const FriendRequestSchema = z
  .object({
    id: z.string().openapi({ example: "652f1a2b3c4d5e6f7a8b9c0d" }),
    senderId: z.string().openapi({ description: "ID người gửi lời mời" }),
    receiverId: z.string().openapi({ description: "ID người nhận lời mời" }),
    status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELED"]),
    note: z.string().openapi({ description: "Lời nhắn kèm theo lời mời" }),
    respondedAt: z.string().datetime().nullable().openapi({ description: "Thời điểm phản hồi lời mời" }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("FriendRequest");

/** Quan hệ bạn bè đã được thiết lập */
const FriendshipSchema = z
  .object({
    id: z.string().openapi({ example: "652f1a2b3c4d5e6f7a8b9c0d" }),
    userA: z.string().openapi({ description: "ID người dùng thứ nhất" }),
    userB: z.string().openapi({ description: "ID người dùng thứ hai" }),
    friendRequestId: z.string().openapi({ description: "ID lời mời kết bạn đã dẫn tới quan hệ này" }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Friendship");

/** Bản ghi chặn người dùng */
const BlockSchema = z
  .object({
    id: z.string().openapi({ example: "652f1a2b3c4d5e6f7a8b9c0d" }),
    blockerId: z.string().openapi({ description: "ID người thực hiện chặn" }),
    blockedId: z.string().openapi({ description: "ID người bị chặn" }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Block");

/**
 * Factory tạo schema phản hồi thành công dạng danh sách kèm metadata phân trang offset.
 * @param item Schema của một phần tử trong mảng dữ liệu
 * @param name Tên component đăng ký trong OpenAPI
 */
const paginated = <T extends z.ZodTypeAny>(item: T, name: string) =>
  z
    .object({
      success: z.literal(true),
      data: z.array(item),
      pagination: PaginationMetaSchema,
    })
    .openapi(name);

/** Bảng mã phản hồi lỗi dùng chung — chỉ khai báo một lần, tái sử dụng cho mọi endpoint */
const ERROR_RESPONSES: Record<string, { description: string; content: { "application/json": { schema: typeof ErrorResponseSchema } } }> = {
  "400": { description: "Dữ liệu đầu vào không hợp lệ (Validation Error)", content: { "application/json": { schema: ErrorResponseSchema } } },
  "401": { description: "Thiếu token hoặc token không hợp lệ / đã hết hạn", content: { "application/json": { schema: ErrorResponseSchema } } },
  "403": { description: "Đã xác thực nhưng không đủ quyền truy cập tài nguyên", content: { "application/json": { schema: ErrorResponseSchema } } },
  "404": { description: "Không tìm thấy tài nguyên yêu cầu", content: { "application/json": { schema: ErrorResponseSchema } } },
  "409": { description: "Xung đột dữ liệu (trùng lặp unique constraint)", content: { "application/json": { schema: ErrorResponseSchema } } },
  "429": { description: "Vượt quá giới hạn tần suất gọi API (Rate Limited)", content: { "application/json": { schema: ErrorResponseSchema } } },
  "500": { description: "Lỗi hệ thống không lường trước", content: { "application/json": { schema: ErrorResponseSchema } } },
};

/** Gom nhóm các mã lỗi cần khai báo cho một endpoint */
const errors = (...codes: (keyof typeof ERROR_RESPONSES)[]) =>
  Object.fromEntries(codes.map((code) => [code, ERROR_RESPONSES[code]]));

/** Phản hồi thành công chỉ có thông điệp, không kèm dữ liệu */
const MessageOnlyResponseSchema = z
  .object({ success: z.literal(true), message: z.string() })
  .openapi("SuccessMessage");

/* ==========================================================================
   KHỐI 2: HÀM TIỆN ÍCH CHUYỂN ĐỔI SCHEMA VALIDATE → CẤU HÌNH REQUEST OPENAPI
   ========================================================================== */

type RequestConfig = NonNullable<RouteConfig["request"]>;

/**
 * Chuyển Zod Object dạng { body, query, params } (đúng dạng middleware validate đang dùng)
 * thành cấu hình request của OpenAPI, bảo đảm tài liệu phản ánh đúng ràng buộc thực tế.
 *
 * @param schema Schema tổng của tuyến đường
 * @param method Phương thức HTTP — GET/DELETE không khai báo request body theo quy ước RESTful
 */
function toRequest(
  schema: z.AnyZodObject,
  method: "get" | "post" | "put" | "patch" | "delete"
): RequestConfig {
  const shape = schema.shape as {
    body?: z.ZodTypeAny;
    query?: z.AnyZodObject;
    params?: z.AnyZodObject;
  };

  // Chỉ POST/PUT/PATCH mới mang request body
  const canHaveBody = method === "post" || method === "put" || method === "patch";

  return {
    params: shape.params,
    query: shape.query,
    body:
      canHaveBody && shape.body
        ? { content: { "application/json": { schema: shape.body } } }
        : undefined,
  };
}

/* ==========================================================================
   KHỐI 3: ĐĂNG KÝ ĐỊNH TUYẾN (PATHS) VÀO OPENAPI REGISTRY
   ========================================================================== */

const registry = new OpenAPIRegistry();

// Cơ chế xác thực: Bearer JWT gửi qua header Authorization
const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Access Token lấy từ /api/auth/login hoặc /api/auth/register",
});

/* ------------------------- Nhóm AUTH (Xác thực) ------------------------- */

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["Auth"],
  summary: "Đăng ký tài khoản mới",
  description: "Tạo tài khoản mới và trả về ngay cặp Access Token / Refresh Token.",
  request: toRequest(RegisterSchema, "post"),
  responses: {
    201: {
      description: "Đăng ký thành công",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: AuthTokenSchema }) } },
    },
    ...errors("400", "409", "500"),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  summary: "Đăng nhập",
  description: "Đăng nhập bằng email hoặc username. Bị giới hạn tần suất (rate limited) để chống brute-force.",
  request: toRequest(LoginSchema, "post"),
  responses: {
    200: {
      description: "Đăng nhập thành công",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: AuthTokenSchema }) } },
    },
    ...errors("400", "401", "429", "500"),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: ["Auth"],
  summary: "Làm mới Access Token",
  description: "Nhận Refresh Token từ body hoặc HTTP-Only Cookie và cấp lại cặp token mới.",
  request: toRequest(RefreshTokenSchema, "post"),
  responses: {
    200: {
      description: "Làm mới token thành công",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: AuthTokenSchema }) } },
    },
    ...errors("401", "500"),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  summary: "Đăng xuất",
  description: "Thu hồi Refresh Token trong CSDL và xóa toàn bộ cookie xác thực.",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "Đăng xuất thành công",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: z.object({ message: z.string() }) }),
        },
      },
    },
    ...errors("500"),
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  tags: ["Auth"],
  summary: "Lấy hồ sơ người dùng đang đăng nhập",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "Lấy hồ sơ thành công",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: UserPublicSchema }) } },
    },
    ...errors("401", "500"),
  },
});

/* ------------------------- Nhóm USERS (Người dùng) ------------------------- */

registry.registerPath({
  method: "patch",
  path: "/users/profile",
  tags: ["Users"],
  summary: "Cập nhật thông tin cá nhân",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(UpdateProfileSchema, "patch"),
  responses: {
    200: {
      description: "Cập nhật thành công",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: UserPublicSchema }) } },
    },
    ...errors("400", "401", "404", "500"),
  },
});

// Multipart upload không dùng toRequest() vì body là tệp nhị phân, không phải JSON.
// Register của zod-to-openapi yêu cầu bọc trong khóa `body` (kiểu ZodRequestBody),
// nên ta giữ phần content multipart và truyền qua `request: { body: ... }` ở dưới.
const avatarUploadRequestBody: ZodRequestBody = {
  required: true,
  content: {
    "multipart/form-data": {
      schema: z.object({
        file: z.any().openapi({ type: "string", format: "binary" }),
      }),
    },
  },
};

// Mọi endpoint của module này trả cùng một vỏ bọc { success, data }.
// Khai báo một lần để hai path bên dưới không lặp lại cùng một chuỗi schema.
const withUserData = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: z.object({ success: z.literal(true), data: UserPublicSchema }),
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/users/avatar",
  tags: ["Users"],
  summary: "Tải lên ảnh đại diện",
  description:
    "Nhận multipart/form-data với trường 'file'. Ảnh được cắt vuông 256x256 và nén sang WEBP. Tối đa 5MB, chấp nhận JPG/PNG/WEBP.",
  security: [{ [bearerAuth.name]: [] }],
  request: { body: avatarUploadRequestBody },
  responses: {
    200: withUserData("Tải ảnh đại diện thành công"),
    ...errors("400", "401", "404", "500"),
  },
});

registry.registerPath({
  method: "post",
  path: "/users/banner",
  tags: ["Users"],
  summary: "Tải lên ảnh bìa trang hồ sơ",
  description:
    "Nhận multipart/form-data với trường 'file'. Ảnh được thu nhỏ về tối đa 1200x400 và nén sang WEBP. Tối đa 5MB, chấp nhận JPG/PNG/WEBP.",
  security: [{ [bearerAuth.name]: [] }],
  request: { body: avatarUploadRequestBody },
  responses: {
    200: withUserData("Tải ảnh bìa thành công"),
    ...errors("400", "401", "404", "500"),
  },
});

registry.registerPath({
  method: "put",
  path: "/users/change-password",
  tags: ["Users"],
  summary: "Đổi mật khẩu",
  description: "Yêu cầu mật khẩu hiện tại; mật khẩu mới phải khác mật khẩu cũ và khớp với xác nhận.",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(ChangePasswordSchema, "put"),
  responses: {
    200: {
      description: "Đổi mật khẩu thành công",
      content: { "application/json": { schema: MessageOnlyResponseSchema } },
    },
    ...errors("400", "401", "404", "500"),
  },
});

registry.registerPath({
  method: "get",
  path: "/users/search",
  tags: ["Users"],
  summary: "Tìm kiếm người dùng",
  description: "Tìm theo username hoặc displayName, loại trừ chính người đang đăng nhập.",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(SearchUsersQuerySchema, "get"),
  responses: {
    200: {
      description: "Tìm kiếm thành công",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(UserPublicSchema),
            pagination: PaginationMetaSchema,
          }),
        },
      },
    },
    ...errors("400", "401", "500"),
  },
});

registry.registerPath({
  method: "get",
  path: "/users/{id}",
  tags: ["Users"],
  summary: "Xem hồ sơ công khai của người dùng",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(GetUserByIdParamsSchema, "get"),
  responses: {
    200: {
      description: "Lấy thông tin thành công",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: UserPublicSchema }) } },
    },
    ...errors("401", "404", "500"),
  },
});

/* -------------------- Nhóm CONVERSATIONS (Cuộc trò chuyện) -------------------- */

registry.registerPath({
  method: "post",
  path: "/conversations",
  tags: ["Conversations"],
  summary: "Tạo cuộc trò chuyện mới",
  description: "Tạo hội thoại 1-1 (DIRECT) hoặc nhóm (GROUP).",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(CreateConversationSchema, "post"),
  responses: {
    201: {
      description: "Tạo thành công",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: ConversationSchema }) } },
    },
    ...errors("400", "401", "500"),
  },
});

registry.registerPath({
  method: "get",
  path: "/conversations",
  tags: ["Conversations"],
  summary: "Lấy danh sách cuộc trò chuyện của tôi",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "Lấy danh sách thành công",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: z.array(ConversationSchema) }),
        },
      },
    },
    ...errors("401", "500"),
  },
});

registry.registerPath({
  method: "get",
  path: "/conversations/{id}",
  tags: ["Conversations"],
  summary: "Lấy chi tiết một cuộc trò chuyện",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(GetConversationParamsSchema, "get"),
  responses: {
    200: {
      description: "Lấy chi tiết thành công",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: ConversationSchema }) } },
    },
    ...errors("401", "403", "404", "500"),
  },
});

/* ------------------------- Nhóm MESSAGES (Tin nhắn) ------------------------- */

registry.registerPath({
  method: "post",
  path: "/conversations/{conversationId}/messages",
  tags: ["Messages"],
  summary: "Gửi tin nhắn vào cuộc trò chuyện",
  description: "Bắt buộc có nội dung văn bản hoặc ít nhất một tệp đính kèm. Tin nhắn được phát realtime qua Socket.IO.",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(SendMessageSchema, "post"),
  responses: {
    201: {
      description: "Gửi tin nhắn thành công",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: MessageSchema }) } },
    },
    ...errors("400", "401", "403", "404", "500"),
  },
});

registry.registerPath({
  method: "get",
  path: "/conversations/{conversationId}/messages",
  tags: ["Messages"],
  summary: "Lấy lịch sử tin nhắn (phân trang con trỏ)",
  description: "Trả về tối đa 50 tin nhắn mỗi lần. Dùng `nextCursor` của lần gọi trước để tải tiếp.",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(GetMessagesQuerySchema, "get"),
  responses: {
    200: {
      description: "Lấy lịch sử thành công",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(MessageSchema),
            pagination: CursorPaginationSchema,
          }),
        },
      },
    },
    ...errors("400", "401", "403", "500"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/conversations/{conversationId}/messages/{messageId}",
  tags: ["Messages"],
  summary: "Thu hồi tin nhắn (soft delete)",
  description: "Chỉ người gửi mới có quyền thu hồi tin nhắn của chính mình.",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(RecallMessageParamsSchema, "delete"),
  responses: {
    200: {
      description: "Thu hồi thành công",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: MessageSchema }) } },
    },
    ...errors("400", "401", "403", "404", "500"),
  },
});

registry.registerPath({
  method: "post",
  path: "/conversations/{conversationId}/messages/read",
  tags: ["Messages"],
  summary: "Đánh dấu đã đọc toàn bộ tin nhắn",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(MarkMessagesAsReadParamsSchema, "post"),
  responses: {
    200: {
      description: "Đánh dấu đã đọc thành công",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ success: z.boolean(), readCount: z.number().int() }),
          }),
        },
      },
    },
    ...errors("400", "401", "403", "500"),
  },
});

/* -------------------------- Nhóm FRIENDS (Bạn bè) -------------------------- */

registry.registerPath({
  method: "post",
  path: "/friends/requests",
  tags: ["Friends"],
  summary: "Gửi lời mời kết bạn",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(SendFriendRequestSchema, "post"),
  responses: {
    201: {
      description: "Gửi lời mời thành công",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: FriendRequestSchema }) } },
    },
    ...errors("400", "401", "403", "404", "409", "500"),
  },
});

registry.registerPath({
  method: "get",
  path: "/friends/requests/received",
  tags: ["Friends"],
  summary: "Danh sách lời mời kết bạn đã nhận",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(PaginationQuerySchema, "get"),
  responses: {
    200: {
      description: "Lấy danh sách thành công",
      content: { "application/json": { schema: paginated(FriendRequestSchema, "FriendRequestPage") } },
    },
    ...errors("400", "401", "500"),
  },
});

registry.registerPath({
  method: "get",
  path: "/friends/requests/sent",
  tags: ["Friends"],
  summary: "Danh sách lời mời kết bạn đã gửi",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(PaginationQuerySchema, "get"),
  responses: {
    200: {
      description: "Lấy danh sách thành công",
      content: { "application/json": { schema: paginated(FriendRequestSchema, "SentFriendRequestPage") } },
    },
    ...errors("400", "401", "500"),
  },
});

registry.registerPath({
  method: "post",
  path: "/friends/requests/{requestId}/accept",
  tags: ["Friends"],
  summary: "Chấp nhận lời mời kết bạn",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(RequestIdParamSchema, "post"),
  responses: {
    200: {
      description: "Chấp nhận thành công, quan hệ bạn bè được thiết lập",
      content: { "application/json": { schema: z.object({ success: z.literal(true), data: FriendshipSchema }) } },
    },
    ...errors("400", "401", "403", "404", "409", "500"),
  },
});

registry.registerPath({
  method: "post",
  path: "/friends/requests/{requestId}/reject",
  tags: ["Friends"],
  summary: "Từ chối lời mời kết bạn",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(RequestIdParamSchema, "post"),
  responses: {
    200: {
      description: "Từ chối thành công",
      content: { "application/json": { schema: MessageOnlyResponseSchema } },
    },
    ...errors("400", "401", "403", "404", "500"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/friends/requests/{requestId}/cancel",
  tags: ["Friends"],
  summary: "Hủy lời mời kết bạn đã gửi",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(RequestIdParamSchema, "delete"),
  responses: {
    200: {
      description: "Hủy lời mời thành công",
      content: { "application/json": { schema: MessageOnlyResponseSchema } },
    },
    ...errors("400", "401", "403", "404", "500"),
  },
});

registry.registerPath({
  method: "get",
  path: "/friends",
  tags: ["Friends"],
  summary: "Danh sách bạn bè của tôi",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(FriendQuerySchema, "get"),
  responses: {
    200: {
      description: "Lấy danh sách bạn bè thành công",
      content: { "application/json": { schema: paginated(UserPublicSchema, "FriendPage") } },
    },
    ...errors("400", "401", "500"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/friends/{targetUserId}",
  tags: ["Friends"],
  summary: "Hủy kết bạn",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(TargetUserParamSchema, "delete"),
  responses: {
    200: {
      description: "Hủy kết bạn thành công",
      content: { "application/json": { schema: MessageOnlyResponseSchema } },
    },
    ...errors("400", "401", "404", "500"),
  },
});

registry.registerPath({
  method: "get",
  path: "/friends/status/{targetUserId}",
  tags: ["Friends"],
  summary: "Tra cứu trạng thái quan hệ với một người dùng",
  description: "Cho biết hai người đã là bạn, đang có lời mời chờ, hay đã bị chặn.",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(TargetUserParamSchema, "get"),
  responses: {
    200: {
      description: "Tra cứu thành công",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              status: z.enum(["NONE", "PENDING_SENT", "PENDING_RECEIVED", "FRIEND", "BLOCKED", "BLOCKED_BY"]),
            }),
          }),
        },
      },
    },
    ...errors("400", "401", "404", "500"),
  },
});

registry.registerPath({
  method: "get",
  path: "/friends/blocks",
  tags: ["Friends"],
  summary: "Danh sách người dùng bị tôi chặn",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(PaginationQuerySchema, "get"),
  responses: {
    200: {
      description: "Lấy danh sách thành công",
      content: { "application/json": { schema: paginated(UserPublicSchema, "BlockedUserPage") } },
    },
    ...errors("400", "401", "500"),
  },
});

registry.registerPath({
  method: "post",
  path: "/friends/blocks/{targetUserId}",
  tags: ["Friends"],
  summary: "Chặn người dùng",
  description: "Tự động hủy quan hệ bạn bè và các lời mời kết bạn liên quan.",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(TargetUserParamSchema, "post"),
  responses: {
    201: {
      description: "Chặn thành công",
      content: { "application/json": { schema: MessageOnlyResponseSchema } },
    },
    ...errors("400", "401", "404", "409", "500"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/friends/blocks/{targetUserId}",
  tags: ["Friends"],
  summary: "Bỏ chặn người dùng",
  security: [{ [bearerAuth.name]: [] }],
  request: toRequest(TargetUserParamSchema, "delete"),
  responses: {
    200: {
      description: "Bỏ chặn thành công",
      content: { "application/json": { schema: MessageOnlyResponseSchema } },
    },
    ...errors("400", "401", "404", "500"),
  },
});

/* -------------------------- Nhóm HEALTH (Giám sát) -------------------------- */

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Kiểm tra trạng thái hoạt động của server",
  security: [],
  responses: {
    200: {
      description: "Server đang hoạt động",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              status: z.string(),
              uptime: z.number(),
              timestamp: z.string().datetime(),
            }),
          }),
        },
      },
    },
  },
});

/* ==========================================================================
   KHỐI 4: SINH TÀI LIỆU OPENAPI HOÀN CHỈNH
   ========================================================================== */

/**
 * Sinh đối tượng tài liệu OpenAPI 3.0.3 từ registry.
 * Hàm được gọi một lần duy nhất khi module được nạp (document là hằng số, không đổi ở runtime).
 */
function buildDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "appmessaging API",
      version: "1.0.0",
      description:
        "Tài liệu REST API của hệ thống nhắn tin thời gian thực appmessaging.\n\n" +
        "**Xác thực**: gọi `/api/auth/login` để lấy `accessToken`, sau đó bấm nút **Authorize** và dán token vào.",
    },
    // Tiền tố chung giúp nút Try it out gọi đúng địa chỉ /api/...
    servers: [{ url: "/api", description: "API server hiện tại" }],
    tags: [
      { name: "Auth", description: "Đăng ký, đăng nhập, làm mới token và đăng xuất" },
      { name: "Users", description: "Hồ sơ cá nhân và tìm kiếm người dùng" },
      { name: "Conversations", description: "Quản lý cuộc trò chuyện 1-1 và nhóm" },
      { name: "Messages", description: "Gửi, đọc lịch sử, thu hồi và đánh dấu đã đọc tin nhắn" },
      { name: "Friends", description: "Lời mời kết bạn, danh sách bạn bè và chặn người dùng" },
      { name: "Health", description: "Giám sát trạng thái hoạt động của server" },
    ],
  });
}

/** Tài liệu OpenAPI đã sinh sẵn — dùng cho cả Swagger UI và endpoint /api/docs/openapi.json */
export const openApiDocument = buildDocument();
