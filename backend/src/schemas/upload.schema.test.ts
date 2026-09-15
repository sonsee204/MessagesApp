import { describe, it, expect } from "vitest";
import { SignUploadSchema } from "./upload.schema";

describe("SignUploadSchema", () => {
  const VALID_OID = "64f6c0a1e1b2c3d4e5f60718";

  it("accept hợp lệ: resourceType 'image' + folder đúng format", () => {
    const r = SignUploadSchema.safeParse({ resourceType: "image", folder: `chat/${VALID_OID}` });
    expect(r.success).toBe(true);
  });

  it("accept hợp lệ: resourceType 'video'", () => {
    const r = SignUploadSchema.safeParse({ resourceType: "video", folder: `chat/${VALID_OID}` });
    expect(r.success).toBe(true);
  });

  it("accept hợp lệ: resourceType 'raw' cho file", () => {
    const r = SignUploadSchema.safeParse({ resourceType: "raw", folder: `chat/${VALID_OID}` });
    expect(r.success).toBe(true);
  });

  it("reject resourceType 'exe' — không nằm trong whitelist Cloudinary", () => {
    const r = SignUploadSchema.safeParse({ resourceType: "exe", folder: `chat/${VALID_OID}` });
    expect(r.success).toBe(false);
  });

  it("reject folder sai regex — đường dẫn avatar bị chặn", () => {
    const r = SignUploadSchema.safeParse({ resourceType: "raw", folder: "avatar/123" });
    expect(r.success).toBe(false);
  });

  it("reject folder sai regex — thiếu tiền tố chat/", () => {
    const r = SignUploadSchema.safeParse({ resourceType: "image", folder: VALID_OID });
    expect(r.success).toBe(false);
  });

  it("reject field lạ do .strict() — chặn Mass Assignment", () => {
    const r = SignUploadSchema.safeParse({
      resourceType: "image",
      folder: `chat/${VALID_OID}`,
      extraField: "should be stripped",
    });
    expect(r.success).toBe(false);
  });

  it("reject resourceType thiếu", () => {
    const r = SignUploadSchema.safeParse({ folder: `chat/${VALID_OID}` });
    expect(r.success).toBe(false);
  });

  it("reject folder thiếu", () => {
    const r = SignUploadSchema.safeParse({ resourceType: "image" });
    expect(r.success).toBe(false);
  });
});
