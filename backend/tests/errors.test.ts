import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { logger } from "../src/core/logger";

describe("Error Handling & Error Logging Middleware", () => {
  const app = createApp();

  it("Ghi log và trả về 404 NOT_FOUND khi gọi endpoint không tồn tại", async () => {
    const logSpy = vi.spyOn(logger, "logError");
    const res = await request(app).get("/api/unknown-endpoint-404");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("Không tìm thấy endpoint");

    // Kiểm tra logError được gọi với mã lỗi và text tường minh
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "NOT_FOUND",
        statusCode: 404,
        message: expect.stringContaining("Không tìm thấy endpoint"),
      })
    );
  });

  it("Ghi log và trả về 400 VALIDATION_ERROR khi dữ liệu gửi lên không hợp lệ", async () => {
    const logSpy = vi.spyOn(logger, "logError");
    const res = await request(app).post("/api/auth/register").send({
      username: "testuser",
      email: "invalid-email-format",
      password: "123", // Quá ngắn (<6 ký tự)
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(1);

    // Kiểm tra logError ghi nhận đúng mã lỗi VALIDATION_ERROR và chi tiết
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: "Dữ liệu đầu vào không hợp lệ",
        details: expect.any(Array),
      })
    );
  });

  it("Ghi log và trả về 400 INVALID_JSON_SYNTAX khi client gửi chuỗi JSON hỏng", async () => {
    const logSpy = vi.spyOn(logger, "logError");
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{ malformed-json: ");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_JSON_SYNTAX");
    expect(res.body.error.message).toContain("JSON trong request body không hợp lệ");

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "INVALID_JSON_SYNTAX",
        statusCode: 400,
      })
    );
  });
});
