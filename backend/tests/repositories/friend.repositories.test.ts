import { describe, it, expect } from "vitest";
import { friendRequestRepository } from "../../src/repositories/friend-request.repository";
import { friendRepository } from "../../src/repositories/friend.repository";
import { blockRepository } from "../../src/repositories/block.repository";

describe("Friend Repositories Instantiation & Methods", () => {
  it("friendRequestRepository export đầy đủ các phương thức nghiệp vụ", () => {
    expect(typeof friendRequestRepository.create).toBe("function");
    expect(typeof friendRequestRepository.findById).toBe("function");
    expect(typeof friendRequestRepository.findPending).toBe("function");
    expect(typeof friendRequestRepository.updateStatus).toBe("function");
    expect(typeof friendRequestRepository.findReceived).toBe("function");
    expect(typeof friendRequestRepository.findSent).toBe("function");
    expect(typeof friendRequestRepository.cancelPendingBetween).toBe("function");
  });

  it("friendRepository export đầy đủ các phương thức nghiệp vụ", () => {
    expect(typeof friendRepository.createFriendship).toBe("function");
    expect(typeof friendRepository.isFriend).toBe("function");
    expect(typeof friendRepository.removeFriendship).toBe("function");
    expect(typeof friendRepository.findFriends).toBe("function");
    expect(typeof friendRepository.countFriends).toBe("function");
  });

  it("blockRepository export đầy đủ các phương thức nghiệp vụ", () => {
    expect(typeof blockRepository.createBlock).toBe("function");
    expect(typeof blockRepository.removeBlock).toBe("function");
    expect(typeof blockRepository.isBlocked).toBe("function");
    expect(typeof blockRepository.isBlockedBy).toBe("function");
    expect(typeof blockRepository.findBlockedUsers).toBe("function");
  });
});
