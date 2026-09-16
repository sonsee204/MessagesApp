import { Router } from "express";
import { healthRoutes } from "./health.routes";
import { authRoutes } from "./auth.routes";
import { conversationRoutes } from "./conversation.routes";
import { userRoutes } from "./user.routes";
import { friendRoutes } from "./friend.routes";
import { notificationRoutes } from "./notification.routes";
import { docsRoutes } from "./docs.routes";
import { uploadRoutes } from "./upload.routes";
import { callRoutes } from "./call.routes";

const apiRouter = Router();

// Tài liệu API (Swagger UI) — đăng ký trước để không bị các route động bên dưới bắt mất
apiRouter.use("/docs", docsRoutes);

apiRouter.use("/health", healthRoutes);
apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/conversations", conversationRoutes);
apiRouter.use("/friends", friendRoutes);
apiRouter.use("/notifications", notificationRoutes);
apiRouter.use("/uploads", uploadRoutes);
apiRouter.use("/calls", callRoutes);

export { apiRouter };
