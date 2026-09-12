import { Router } from "express";
import { healthRoutes } from "./health.routes";
import { authRoutes } from "./auth.routes";
import { conversationRoutes } from "./conversation.routes";
import { userRoutes } from "./user.routes";
import { friendRoutes } from "./friend.routes";

const apiRouter = Router();

apiRouter.use("/health", healthRoutes);
apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/conversations", conversationRoutes);
apiRouter.use("/friends", friendRoutes);

export { apiRouter };
