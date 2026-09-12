import { describe, it, expect } from "vitest";
import { friendRoutes } from "../../src/routes/friend.routes";
import { friendController } from "../../src/controllers/friend.controller";

describe("Friend Routes & Controller Configuration", () => {
  it("friendController có đầy đủ các handler methods", () => {
    expect(typeof friendController.sendRequest).toBe("function");
    expect(typeof friendController.getReceivedRequests).toBe("function");
    expect(typeof friendController.getSentRequests).toBe("function");
    expect(typeof friendController.acceptRequest).toBe("function");
    expect(typeof friendController.rejectRequest).toBe("function");
    expect(typeof friendController.cancelRequest).toBe("function");
    expect(typeof friendController.getFriends).toBe("function");
    expect(typeof friendController.removeFriend).toBe("function");
    expect(typeof friendController.getRelationshipStatus).toBe("function");
    expect(typeof friendController.blockUser).toBe("function");
    expect(typeof friendController.unblockUser).toBe("function");
    expect(typeof friendController.getBlockedUsers).toBe("function");
  });

  it("friendRoutes là một router instance hợp lệ của Express", () => {
    expect(friendRoutes).toBeDefined();
    expect(typeof friendRoutes).toBe("function");
  });
});
