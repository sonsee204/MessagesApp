import { describe, it, expect } from "vitest";
import { UserModel } from "../../src/models/user.model";
import { UpdateProfileSchema } from "../../src/schemas/user.schema";

describe("UserModel — trường bannerUrl", () => {
  const base = {
    username: "haxuanson",
    email: "user@example.com",
    passwordHash: "hash",
    displayName: "Hà Xuân Sơn",
  };

  it("mặc định bannerUrl là null khi không truyền", () => {
    const doc = new UserModel(base);
    expect(doc.bannerUrl).toBeNull();
  });

  it("nhận giá trị bannerUrl khi được truyền vào", () => {
    const doc = new UserModel({ ...base, bannerUrl: "/api/uploads/banner-u1-abcd1234.webp" });
    expect(doc.bannerUrl).toBe("/api/uploads/banner-u1-abcd1234.webp");
  });
});

describe("UpdateProfileSchema — trường bannerUrl", () => {
  it("chấp nhận đường dẫn nội bộ do backend sinh ra", () => {
    const result = UpdateProfileSchema.safeParse({
      body: { bannerUrl: "/api/uploads/banner-u1-abcd1234.webp" },
    });
    expect(result.success).toBe(true);
  });

  it("chấp nhận URL tuyệt đối (dữ liệu cũ hoặc ảnh ngoài)", () => {
    const result = UpdateProfileSchema.safeParse({
      body: { bannerUrl: "https://example.com/anh-bia.png" },
    });
    expect(result.success).toBe(true);
  });

  it("chấp nhận null để xoá ảnh bìa", () => {
    const result = UpdateProfileSchema.safeParse({ body: { bannerUrl: null } });
    expect(result.success).toBe(true);
  });

  it("từ chối chuỗi không phải URL lẫn không phải đường dẫn nội bộ", () => {
    const result = UpdateProfileSchema.safeParse({ body: { bannerUrl: "khong-phai-url" } });
    expect(result.success).toBe(false);
  });

  it("avatarUrl cũng chấp nhận đường dẫn nội bộ (không phá vỡ luồng upload mới)", () => {
    const result = UpdateProfileSchema.safeParse({
      body: { avatarUrl: "/api/uploads/avatar-u1-abcd1234.webp" },
    });
    expect(result.success).toBe(true);
  });
});
