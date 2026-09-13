import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { openApiDocument } from "../src/docs/openapi";

/**
 * Kiểm thử tự động tài liệu Swagger/OpenAPI
 * Mục tiêu: bảo đảm tài liệu luôn đồng bộ với danh sách tuyến đường thực tế và Swagger UI phục vụ được.
 */
describe("Swagger / OpenAPI documentation", () => {
  const app = createApp();

  it("sinh đặc tả OpenAPI 3.0 với đầy đủ thông tin cơ bản", () => {
    expect(openApiDocument.openapi).toBe("3.0.3");
    expect(openApiDocument.info.title).toBe("appmessaging API");
    expect(openApiDocument.servers?.[0].url).toBe("/api");
  });

  it("khai báo đủ 31 thao tác (operation) trên 28 đường dẫn của hệ thống", () => {
    const operations = Object.values(openApiDocument.paths ?? {}).flatMap((p) =>
      Object.keys(p as Record<string, unknown>)
    );

    // 29 thao tác gốc + POST /users/avatar + POST /users/banner
    expect(operations).toHaveLength(31);
    // 26 path gốc + /users/avatar + /users/banner
    expect(Object.keys(openApiDocument.paths ?? {})).toHaveLength(28);
  });

  it("mọi tuyến đường đều có tag và mô tả", () => {
    for (const [path, operations] of Object.entries(openApiDocument.paths ?? {})) {
      for (const [method, operation] of Object.entries(operations as Record<string, { tags?: string[]; summary?: string }>)) {
        expect(operation.tags, `${method.toUpperCase()} ${path} thiếu tag`).toBeDefined();
        expect(operation.summary, `${method.toUpperCase()} ${path} thiếu summary`).toBeTruthy();
      }
    }
  });

  it("phục vụ Swagger UI tại GET /api/docs", async () => {
    const res = await request(app).get("/api/docs/").redirects(1);

    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });

  it("phục vụ đặc tả JSON thô tại GET /api/docs/openapi.json", async () => {
    const res = await request(app).get("/api/docs/openapi.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    // 26 path gốc + /users/avatar + /users/banner
    expect(Object.keys(res.body.paths)).toHaveLength(28);
  });
});
