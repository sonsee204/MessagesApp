/**
 * Kiểm thử cấu hình Cloudinary (lazy validation khi thiếu biến môi trường).
 */
import { describe, it, expect, afterEach, vi } from "vitest";

describe("Cloudinary config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("throws nếu thiếu CLOUDINARY_CLOUD_NAME", async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_API_KEY = "test_key";
    process.env.CLOUDINARY_API_SECRET = "test_secret";

    const { getCloudinaryConfig } = await import("./cloudinary");
    expect(() => getCloudinaryConfig()).toThrow(
      "[Cloudinary] Thiếu biến môi trường CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET"
    );
  });

  it("throws nếu thiếu CLOUDINARY_API_KEY", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test_cloud";
    delete process.env.CLOUDINARY_API_KEY;
    process.env.CLOUDINARY_API_SECRET = "test_secret";

    const { getCloudinaryConfig } = await import("./cloudinary");
    expect(() => getCloudinaryConfig()).toThrow(
      "[Cloudinary] Thiếu biến môi trường CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET"
    );
  });

  it("throws nếu thiếu CLOUDINARY_API_SECRET", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test_cloud";
    process.env.CLOUDINARY_API_KEY = "test_key";
    delete process.env.CLOUDINARY_API_SECRET;

    const { getCloudinaryConfig } = await import("./cloudinary");
    expect(() => getCloudinaryConfig()).toThrow(
      "[Cloudinary] Thiếu biến môi trường CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET"
    );
  });

  it("khởi tạo thành công khi có đầy đủ biến môi trường", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test_cloud";
    process.env.CLOUDINARY_API_KEY = "test_key";
    process.env.CLOUDINARY_API_SECRET = "test_secret";

    const { getCloudinaryConfig } = await import("./cloudinary");
    expect(getCloudinaryConfig()).toEqual({
      cloudName: "test_cloud",
      apiKey: "test_key",
      apiSecret: "test_secret",
    });
  });
});
