import { describe, it, expect } from "vitest";
import { SignUploadSchema } from "./upload.schema";

describe("SignUploadSchema", () => {
  const VALID_OID = "64f6c0a1e1b2c3d4e5f60718";
  const body = (over: Record<string, unknown>) => ({ body: over });

  it("accept hợp lệ: resourceType 'image' + folder đúng format", () => {
    const r = SignUploadSchema.safeParse(body({ resourceType: "image", folder: `chat/${VALID_OID}` }));
    expect(r.success).toBe(true);
  });

  it("accept hợp lệ: resourceType 'video'", () => {
    const r = SignUploadSchema.safeParse(body({ resourceType: "video", folder: `chat/${VALID_OID}` }));
    expect(r.success).toBe(true);
  });

  it("accept hợp lệ: resourceType 'raw' cho file", () => {
    const r = SignUploadSchema.safeParse(body({ resourceType: "raw", folder: `chat/${VALID_OID}` }));
    expect(r.success).toBe(true);
  });

  it("reject resourceType 'exe' — không nằm trong whitelist Cloudinary", () => {
    const r = SignUploadSchema.safeParse(body({ resourceType: "exe", folder: `chat/${VALID_OID}` }));
    expect(r.success).toBe(false);
  });

  it("reject folder sai regex — đường dẫn avatar bị chặn", () => {
    const r = SignUploadSchema.safeParse(body({ resourceType: "raw", folder: "avatar/123" }));
    expect(r.success).toBe(false);
  });

  it("reject folder sai regex — thiếu tiền tố chat/", () => {
    const r = SignUploadSchema.safeParse(body({ resourceType: "image", folder: VALID_OID }));
    expect(r.success).toBe(false);
  });

  it("reject field lạ trong body do .strict() — chặn Mass Assignment", () => {
    const r = SignUploadSchema.safeParse(
      body({ resourceType: "image", folder: `chat/${VALID_OID}`, extraField: "should be stripped" })
    );
    expect(r.success).toBe(false);
  });

  it("reject resourceType thiếu", () => {
    const r = SignUploadSchema.safeParse(body({ folder: `chat/${VALID_OID}` }));
    expect(r.success).toBe(false);
  });

  it("reject folder thiếu", () => {
    const r = SignUploadSchema.safeParse(body({ resourceType: "image" }));
    expect(r.success).toBe(false);
  });
});
