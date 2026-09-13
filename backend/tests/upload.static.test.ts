import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";

const TMP_DIR = path.join(os.tmpdir(), `uupm-static-${Date.now()}`);
process.env.UPLOAD_DIR = TMP_DIR;

const { createApp } = await import("../src/app");
const app = createApp();

describe("Phục vụ tệp tĩnh tại /api/uploads", () => {
  const fileName = "banner-testuser-abcd1234.webp";
  const fileBody = Buffer.from("noi dung anh gia lap");

  beforeAll(async () => {
    await fs.mkdir(TMP_DIR, { recursive: true });
    await fs.writeFile(path.join(TMP_DIR, fileName), fileBody);
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  it("trả 200 và đúng nội dung tệp", async () => {
    const res = await request(app).get(`/api/uploads/${fileName}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fileBody);
  });

  it("gỡ rào Cross-Origin-Resource-Policy của helmet cho riêng mount này", async () => {
    // helmet() mặc định gắn same-origin, sẽ chặn ảnh khi client gọi thẳng BE:5000
    const res = await request(app).get(`/api/uploads/${fileName}`);

    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("đặt cache dài hạn vì tên tệp đã chứa phần ngẫu nhiên", async () => {
    const res = await request(app).get(`/api/uploads/${fileName}`);

    expect(res.headers["cache-control"]).toContain("immutable");
  });

  it("trả 404 cho tệp không tồn tại", async () => {
    const res = await request(app).get("/api/uploads/khong-ton-tai.webp");

    expect(res.status).toBe(404);
  });
});
