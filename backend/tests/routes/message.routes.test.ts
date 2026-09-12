import { describe, it, expect } from "vitest";
import { messageController } from "../../src/controllers/message.controller";
import { conversationRoutes } from "../../src/routes/conversation.routes";

describe("Message Routes & Controller Configuration", () => {
  it("messageController có đầy đủ các phương thức handler", () => {
    expect(typeof messageController.send).toBe("function");
    expect(typeof messageController.getMessages).toBe("function");
    expect(typeof messageController.recall).toBe("function");
    expect(typeof messageController.markAsRead).toBe("function");
  });

  it("conversationRoutes đăng ký đầy đủ các endpoint cho messages", () => {
    expect(conversationRoutes).toBeDefined();
    expect(typeof conversationRoutes).toBe("function");

    const routes = conversationRoutes.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route?.path,
        methods: Object.keys(layer.route?.methods || {}),
      }));

    const paths = routes.map((r: any) => r.path);
    expect(paths).toContain("/:conversationId/messages");
    expect(paths).toContain("/:conversationId/messages/:messageId");
    expect(paths).toContain("/:conversationId/messages/read");
  });
});
