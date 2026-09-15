import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock service trước khi import controller
vi.mock("../services/upload.service", () => ({
  signUpload: vi.fn().mockResolvedValue({
    cloudName: "test_cloud",
    apiKey: "test_key",
    timestamp: 1234567890,
    folder: "chat/64f6c0a1e1b2c3d4e5f60718",
    resourceType: "image",
    maxFileSize: 10485760,
    signature: "abc123",
  }),
}));

import { uploadController } from "./upload.controller";
import { signUpload } from "../services/upload.service";

describe("uploadController.sign", () => {
  const VALID_FOLDER = "chat/64f6c0a1e1b2c3d4e5f60718";

  const mockReq = (userId: string, body: object) =>
    ({
      user: { userId },
      body,
    }) as any;

  const mockRes = () => {
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    return res;
  };

  const mockNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("trả 200 + data signed khi hợp lệ", async () => {
    const req = mockReq("u1", { resourceType: "image", folder: VALID_FOLDER });
    const res = mockRes();
    await uploadController.sign(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ signature: "abc123" }),
    });
    expect(signUpload).toHaveBeenCalledWith("u1", { resourceType: "image", folder: VALID_FOLDER });
  });

  it("gọi next(err) khi service throw NotFoundError", async () => {
    vi.mocked(signUpload).mockRejectedValueOnce(new Error("Không tìm thấy"));
    const req = mockReq("u1", { resourceType: "raw", folder: VALID_FOLDER });
    const res = mockRes();
    await uploadController.sign(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    expect(res.json).not.toHaveBeenCalled();
  });

  it("truyền đúng userId từ req.user", async () => {
    const req = mockReq("user_abc_123", { resourceType: "video", folder: VALID_FOLDER });
    const res = mockRes();
    await uploadController.sign(req, res, mockNext);

    expect(signUpload).toHaveBeenCalledWith("user_abc_123", expect.any(Object));
  });
});
