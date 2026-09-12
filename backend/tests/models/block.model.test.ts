import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { BlockModel } from "../../src/models/block.model";

describe("BlockModel Schema & Validation", () => {
  it("khởi tạo thành công với blockerId và blockedId hợp lệ", () => {
    const blockerId = new Types.ObjectId();
    const blockedId = new Types.ObjectId();

    const block = new BlockModel({
      blockerId,
      blockedId,
    });

    const error = block.validateSync();
    expect(error).toBeUndefined();
    expect(block.blockerId.toString()).toBe(blockerId.toString());
    expect(block.blockedId.toString()).toBe(blockedId.toString());
  });

  it("thất bại nếu thiếu blockerId hoặc blockedId", () => {
    const block = new BlockModel({});

    const error = block.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["blockerId"]).toBeDefined();
    expect(error?.errors["blockedId"]).toBeDefined();
  });

  it("thất bại nếu tự chặn chính mình", () => {
    const userId = new Types.ObjectId();
    const block = new BlockModel({
      blockerId: userId,
      blockedId: userId,
    });

    const error = block.validateSync();
    expect(error).toBeDefined();
    expect(error?.errors["blockedId"]).toBeDefined();
  });
});
