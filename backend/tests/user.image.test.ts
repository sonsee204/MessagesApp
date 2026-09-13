import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import sharp from "sharp";
import { IUser } from "../src/models/user.model";

// Dùng thư mục tạm để không ghi rác vào backend/uploads khi chạy test.
// BẮT BUỘC đặt process.env.UPLOAD_DIR trước khi import app, vì ES module hoist static import.
const TMP_DIR = path.join(os.tmpdir(), `uupm-user-image-${Date.now()}`);
process.env.UPLOAD_DIR = TMP_DIR;

const { createApp } = await import("../src/app");
const { userRepository } = await import("../src/repositories/user.repository");
const { generateAccessToken } = await import("../src/utils/auth");

const app = createApp();
const uploadsDir = () => TMP_DIR;

function authHeader() {
  return `Bearer ${generateAccessToken({
    userId: "user_image_1",
    username: "haxuanson",
    email: "user@example.com",
  })}`;
}

function mockUser(overrides: Partial<IUser> = {}): IUser {
  return {
    id: "user_image_1",
    _id: "user_image_1",
    username: "haxuanson",
    email: "user@example.com",
    displayName: "Hà Xuân Sơn",
    avatarUrl: null,
    bannerUrl: null,
    bio: "",
    statusMessage: "",
    role: "USER",
    isOnline: false,
    ...overrides,
  } as unknown as IUser;
}

async function makePng(width = 600, height = 600): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
}

/** Danh sách tên tệp hiện có trong thư mục uploads của bài test */
async function listUploads(): Promise<string[]> {
  try {
    return await fs.readdir(uploadsDir());
  } catch {
    return [];
  }
}

describe("POST /api/users/avatar và /api/users/banner", () => {
  beforeAll(async () => {
    sharp.cache(false);
    await fs.mkdir(TMP_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("trả 401 khi không có Access Token", async () => {
    const res = await request(app)
      .post("/api/users/avatar")
      .attach("file", await makePng(), { filename: "a.png", contentType: "image/png" });

    expect(res.status).toBe(401);
  });

  it("trả 400 khi không đính kèm tệp", async () => {
    vi.spyOn(userRepository, "findById").mockResolvedValue(mockUser());

    const res = await request(app).post("/api/users/avatar").set("Authorization", authHeader());

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("Vui lòng chọn một tệp ảnh");
  });

  it("tải ảnh đại diện thành công, trả URL và ghi tệp thật lên đĩa", async () => {
    vi.spyOn(userRepository, "findById").mockResolvedValue(mockUser());
    const updateSpy = vi
      .spyOn(userRepository, "updateImage")
      .mockImplementation(async (_id, field, url) => mockUser({ [field]: url } as Partial<IUser>));

    const res = await request(app)
      .post("/api/users/avatar")
      .set("Authorization", authHeader())
      .attach("file", await makePng(), { filename: "a.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.avatarUrl).toMatch(/^\/api\/uploads\/avatar-user_image_1-[0-9a-f]{8}\.webp$/);
    expect(updateSpy).toHaveBeenCalledWith("user_image_1", "avatarUrl", expect.any(String));

    // Tệp phải thật sự nằm trên đĩa
    const files = await listUploads();
    expect(files).toContain(path.basename(res.body.data.avatarUrl));
  });

  it("thay ảnh lần hai thì xoá tệp cũ và giữ lại tệp mới", async () => {
    const oldUrl = "/api/uploads/avatar-user_image_1-deadbeef.webp";
    // Tạo sẵn tệp "cũ" để kiểm tra nó bị dọn
    await fs.writeFile(path.join(TMP_DIR, path.basename(oldUrl)), Buffer.from("anh cu"));

    vi.spyOn(userRepository, "findById").mockResolvedValue(mockUser({ avatarUrl: oldUrl }));
    vi.spyOn(userRepository, "updateImage").mockImplementation(async (_id, field, url) =>
      mockUser({ [field]: url } as Partial<IUser>)
    );

    const res = await request(app)
      .post("/api/users/avatar")
      .set("Authorization", authHeader())
      .attach("file", await makePng(), { filename: "b.png", contentType: "image/png" });

    expect(res.status).toBe(200);

    const files = await listUploads();
    expect(files).not.toContain(path.basename(oldUrl)); // tệp cũ đã bị xoá
    expect(files).toContain(path.basename(res.body.data.avatarUrl)); // tệp mới còn nguyên
  });

  it("KHÔNG mất ảnh cũ khi bước ghi CSDL thất bại", async () => {
    // Đây là test bảo vệ thứ tự ghi-tệp-trước-xoá-tệp-sau (spec §3.6)
    const oldUrl = "/api/uploads/avatar-user_image_1-cafe1234.webp";
    await fs.writeFile(path.join(TMP_DIR, path.basename(oldUrl)), Buffer.from("anh cu"));

    vi.spyOn(userRepository, "findById").mockResolvedValue(mockUser({ avatarUrl: oldUrl }));
    vi.spyOn(userRepository, "updateImage").mockRejectedValue(new Error("CSDL lỗi"));

    const res = await request(app)
      .post("/api/users/avatar")
      .set("Authorization", authHeader())
      .attach("file", await makePng(), { filename: "c.png", contentType: "image/png" });

    expect(res.status).toBe(500);

    // Ảnh cũ PHẢI còn trên đĩa vì CSDL chưa hề trỏ sang ảnh mới
    const files = await listUploads();
    expect(files).toContain(path.basename(oldUrl));
  });

  it("tải ảnh bìa thành công với hình học của preset banner", async () => {
    vi.spyOn(userRepository, "findById").mockResolvedValue(mockUser());
    vi.spyOn(userRepository, "updateImage").mockImplementation(async (_id, field, url) =>
      mockUser({ [field]: url } as Partial<IUser>)
    );

    const res = await request(app)
      .post("/api/users/banner")
      .set("Authorization", authHeader())
      .attach("file", await makePng(2400, 800), { filename: "b.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.data.bannerUrl).toMatch(/^\/api\/uploads\/banner-user_image_1-[0-9a-f]{8}\.webp$/);

    const outBuf = await fs.readFile(path.join(TMP_DIR, path.basename(res.body.data.bannerUrl)));
    const meta = await sharp(outBuf).metadata();
    expect(meta.width).toBe(1200);
  });
});
