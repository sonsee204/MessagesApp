import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import sharp from "sharp";

// Trỏ UPLOAD_DIR vào thư mục tạm TRƯỚC khi import module cần dùng nó
const TMP_DIR = path.join(os.tmpdir(), `uupm-upload-test-${Date.now()}`);
process.env.UPLOAD_DIR = TMP_DIR;

const { saveImage, deleteImageByUrl } = await import("../../src/utils/image-storage");

// Sinh một ảnh PNG lớn hơn kích thước preset để kiểm tra việc resize thật sự diễn ra
async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .png()
    .toBuffer();
}

describe("Tiện ích lưu ảnh (image-storage)", () => {
  beforeAll(async () => {
    sharp.cache(false);
    await fs.mkdir(TMP_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  it("lưu ảnh và trả về URL công khai đúng tiền tố", async () => {
    const png = await makePng(800, 800);

    const url = await saveImage(png, "avatar", "user123");

    expect(url).toMatch(/^\/api\/uploads\/avatar-user123-[0-9a-f]{8}\.webp$/);

    // Tệp phải thật sự tồn tại trên đĩa
    const fileName = path.basename(url);
    const stat = await fs.stat(path.join(TMP_DIR, fileName));
    expect(stat.size).toBeGreaterThan(0);
  });

  it("resize ảnh đại diện về đúng 256x256 và xuất WEBP", async () => {
    const png = await makePng(1000, 600);

    const url = await saveImage(png, "avatar", "user456");
    const outPath = path.join(TMP_DIR, path.basename(url));

    const outBuf = await fs.readFile(outPath);
    const meta = await sharp(outBuf).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(256);
    expect(meta.height).toBe(256);
  });

  it("không phóng to ảnh bìa nhỏ hơn ngưỡng", async () => {
    const small = await makePng(400, 200);

    const url = await saveImage(small, "banner", "user789");
    const outPath = path.join(TMP_DIR, path.basename(url));
    const outBuf = await fs.readFile(outPath);
    const meta = await sharp(outBuf).metadata();

    // withoutEnlargement: ảnh nhỏ hơn preset phải giữ nguyên kích thước gốc
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(200);
  });

  it("mỗi lần lưu cho ra URL khác nhau để phá cache trình duyệt", async () => {
    const png = await makePng(300, 300);

    const first = await saveImage(png, "avatar", "sameuser");
    const second = await saveImage(png, "avatar", "sameuser");

    expect(first).not.toBe(second);
  });

  it("ném lỗi khi tệp không giải mã được thành ảnh", async () => {
    const garbage = Buffer.from("day khong phai la anh");

    await expect(saveImage(garbage, "avatar", "userBad")).rejects.toThrow();
  });

  it("xoá đúng tệp theo URL", async () => {
    const url = await saveImage(await makePng(300, 300), "banner", "userDel");
    const outPath = path.join(TMP_DIR, path.basename(url));

    await deleteImageByUrl(url);

    await expect(fs.stat(outPath)).rejects.toThrow();
  });

  it("KHÔNG xoá gì khi URL nằm ngoài thư mục uploads", async () => {
    // Tạo một tệp nằm ngoài UPLOAD_DIR để chắc chắn hàm không chạm tới
    const outsidePath = path.join(os.tmpdir(), `uupm-outside-${Date.now()}.txt`);
    await fs.writeFile(outsidePath, "du lieu quan trong");

    await deleteImageByUrl("/api/uploads/../../../etc/passwd");
    await deleteImageByUrl("https://example.com/anh.png");
    await deleteImageByUrl(null);
    await deleteImageByUrl(undefined);

    // Tệp ngoài thư mục phải còn nguyên
    await expect(fs.stat(outsidePath)).resolves.toBeDefined();
    await fs.rm(outsidePath, { force: true });
  });
});
