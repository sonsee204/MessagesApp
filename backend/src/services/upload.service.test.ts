import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies trước khi import service
vi.mock("../repositories/conversation.repository", () => ({
  conversationRepository: {
    findById: vi.fn().mockResolvedValue({ participants: [{ toString: () => "u1" }] }),
  },
}));

vi.mock("../config/cloudinary", () => ({
  CLOUDINARY: {
    cloudName: "test_cloud",
    apiKey: "test_api_key",
    apiSecret: "test_api_secret",
  },
}));

import { signUpload } from "./upload.service";
import { conversationRepository } from "../repositories/conversation.repository";
import crypto from "node:crypto";

describe("signUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const VALID_FOLDER = "chat/64f6c0a1e1b2c3d4e5f60718";

  it("trả đủ 7 field + signature đúng SHA-1 khi hợp lệ", async () => {
    const res = await signUpload("u1", { resourceType: "image", folder: VALID_FOLDER });

    expect(res.cloudName).toBe("test_cloud");
    expect(res.apiKey).toBe("test_api_key");
    expect(res.folder).toBe(VALID_FOLDER);
    expect(res.resourceType).toBe("image");
    expect(res.maxFileSize).toBe(10 * 1024 * 1024);
    expect(res.timestamp).toBeTypeOf("number");

    // Verify signature = SHA1(sorted params + secret)
    const sorted = `folder=${VALID_FOLDER}&max_file_size=${res.maxFileSize}&resource_type=image&timestamp=${res.timestamp}`;
    const expectedSig = crypto.createHash("sha1").update(sorted + "test_api_secret").digest("hex");
    expect(res.signature).toBe(expectedSig);
  });

  it("throw ForbiddenError nếu user không phải participant", async () => {
    vi.mocked(conversationRepository.findById).mockResolvedValueOnce({
      participants: [{ toString: () => "other_user" }],
    } as any);

    await expect(signUpload("u1", { resourceType: "raw", folder: VALID_FOLDER })).rejects.toThrow(
      "thành viên"
    );
  });

  it("throw NotFoundError nếu conversation không tồn tại", async () => {
    vi.mocked(conversationRepository.findById).mockResolvedValueOnce(null);

    await expect(signUpload("u1", { resourceType: "video", folder: VALID_FOLDER })).rejects.toThrow(
      "Không tìm thấy"
    );
  });

  it("resourceType 'video' trả maxFileSize = 50MB", async () => {
    const res = await signUpload("u1", { resourceType: "video", folder: VALID_FOLDER });
    expect(res.maxFileSize).toBe(50 * 1024 * 1024);
  });

  it("resourceType 'raw' trả maxFileSize = 25MB", async () => {
    const res = await signUpload("u1", { resourceType: "raw", folder: VALID_FOLDER });
    expect(res.maxFileSize).toBe(25 * 1024 * 1024);
  });
});
