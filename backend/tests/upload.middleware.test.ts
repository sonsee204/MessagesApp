import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { upload } from "../src/middlewares/upload";
import { errorHandler } from "../src/middlewares/error-handler";
import { MAX_FILE_SIZE } from "../src/config/upload";
import { ValidationError } from "../src/core/errors";

/**
 * App tối giản phục vụ kiểm thử đơn vị cho upload middleware:
 * Chỉ gắn middleware upload thật và global error handler thật,
 * nhằm cô lập hoàn toàn hành vi tải tệp mà không phụ thuộc controller hay cơ sở dữ liệu.
 */
function buildApp() {
  const app = express();
  app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      throw new ValidationError("Vui lòng chọn một tệp ảnh để tải lên");
    }
    res.status(200).json({ success: true });
  });
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe("Middleware tải tệp (upload)", () => {
  it("trả 400 khi không có tệp", async () => {
    const res = await request(app).post("/upload");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("Vui lòng chọn một tệp ảnh");
  });

  it("trả 400 khi mimetype không phải ảnh được chấp nhận", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("not an image"), {
        filename: "evil.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP");
  });

  it("trả 400 LIMIT_FILE_SIZE (KHÔNG phải 500) khi tệp vượt trần dung lượng", async () => {
    // Đây là test bắt lỗi thiếu nhánh MulterError trong global error handler:
    // MulterError có `code` dạng CHUỖI nên không khớp nhánh nào, sẽ rơi xuống 500 nếu thiếu nhánh.
    const oversized = Buffer.alloc(MAX_FILE_SIZE + 1024);

    const res = await request(app)
      .post("/upload")
      .attach("file", oversized, { filename: "big.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("LIMIT_FILE_SIZE");
    expect(res.body.error.message).toContain("dung lượng cho phép");
  });

  it("trả 200 với ảnh PNG hợp lệ", async () => {
    // Ảnh PNG 1x1 hợp lệ tối thiểu
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
      "base64"
    );

    const res = await request(app)
      .post("/upload")
      .attach("file", png, { filename: "ok.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
