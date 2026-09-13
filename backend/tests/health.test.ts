import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("GET /api/health", () => {
  const app = createApp();

  it("should return 200 OK with health status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("healthy");
    expect(res.body.data.service).toBe("appmessaging-backend");
    expect(res.body.data.timestamp).toBeDefined();
  });
});
