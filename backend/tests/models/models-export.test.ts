import { describe, it, expect } from "vitest";
import {
  UserModel,
  ConversationModel,
  RefreshTokenModel,
  MessageModel,
  FriendRequestModel,
  FriendModel,
  BlockModel,
  normalizeFriendIds,
} from "../../src/models";

describe("Models Barrel Export (index.ts)", () => {
  it("export đầy đủ tất cả models và hàm tiện ích", () => {
    expect(UserModel).toBeDefined();
    expect(ConversationModel).toBeDefined();
    expect(RefreshTokenModel).toBeDefined();
    expect(MessageModel).toBeDefined();
    expect(FriendRequestModel).toBeDefined();
    expect(FriendModel).toBeDefined();
    expect(BlockModel).toBeDefined();
    expect(typeof normalizeFriendIds).toBe("function");
  });
});
