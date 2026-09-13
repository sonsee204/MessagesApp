---
name: vitest
description: Vitest fast unit testing framework powered by Vite with Jest-compatible API. Use when writing tests, mocking, configuring coverage, or working with test filtering and fixtures. Khung kiểm thử (testing framework) tự động tốc độ cao với Vite/TypeScript, hỗ trợ unit test, integration test, mock `vi`, snapshots và coverage.
metadata:
  author: Anthony Fu
  version: "2026.6.22"
  source: Generated from https://github.com/vitest-dev/vitest, scripts located at https://github.com/antfu/skills
---

# Vitest (Framework Kiểm Thử Tự Động)

Vitest là framework kiểm thử thế hệ mới dựa trên nền tảng Vite, cung cấp API tương thích hoàn toàn với Jest, hỗ trợ native ESM, TypeScript và JSX mà không cần cấu hình phức tạp. Vitest chia sẻ chung config, resolver và plugins với ứng dụng.

**Các Tính Năng Cốt Lõi:**
- **Tốc độ cực nhanh**: Tận dụng pipeline của Vite cho tốc độ chạy test tức thì.
- **Tương thích Jest**: Dễ dàng chuyển đổi hoặc thay thế hầu hết các bộ test Jest hiện có.
- **Smart watch mode**: Chỉ chạy lại các file test bị ảnh hưởng dựa trên module graph.
- **Hỗ trợ TypeScript & ESM mặc định**: Không cần cấu hình babel hay ts-jest rườm rà.
- **Thực thi song song đa luồng (Multi-threaded workers)**: Tối ưu tối đa thời gian chạy test suite.
- **Báo cáo độ phủ mã nguồn (Coverage)**: Tích hợp sẵn V8 hoặc Istanbul.
- **Snapshot testing, mocking, và spy utilities**: Đầy đủ công cụ giả lập qua helper `vi`.

---

## 1. Thành Phần Cốt Lõi (Core API)

| Chủ Đề | Mô Tả Nghiệp Vụ | Tài Liệu Chi Tiết |
|---|---|---|
| **Configuration** | Cấu hình Vitest và Vite, sử dụng `defineConfig` | [core-config](references/core-config.md) |
| **CLI** | Giao diện dòng lệnh, cờ chạy test và các tùy chọn | [core-cli](references/core-cli.md) |
| **Test API** | Hàm `test` / `it`, modifier như `skip`, `only`, `concurrent` | [core-test-api](references/core-test-api.md) |
| **Describe API** | Gom nhóm test suite với `describe` / `suite` lồng nhau | [core-describe](references/core-describe.md) |
| **Expect API** | Các hàm assert: `toBe`, `toEqual`, matchers và asymmetric matchers | [core-expect](references/core-expect.md) |
| **Hooks** | Vòng đời test: `beforeEach`, `afterEach`, `beforeAll`, `afterAll` | [core-hooks](references/core-hooks.md) |

---

## 2. Tính Năng Nâng Cao (Features)

| Chủ Đề | Mô Tả Nghiệp Vụ | Tài Liệu Chi Tiết |
|---|---|---|
| **Mocking** | Mock hàm, module, timer, date với tiện ích `vi` | [features-mocking](references/features-mocking.md) |
| **Snapshots** | Kiểm thử snapshot với `toMatchSnapshot` và inline snapshots | [features-snapshots](references/features-snapshots.md) |
| **Coverage** | Đo độ bao phủ code qua V8 hoặc Istanbul | [features-coverage](references/features-coverage.md) |
| **Test Context** | Fixtures kiểm thử, `context.expect`, `test.extend` | [features-context](references/features-context.md) |
| **Concurrency** | Thực thi test song song, sharding trên CI/CD | [features-concurrency](references/features-concurrency.md) |
| **Filtering** | Lọc test theo tên, đường dẫn file, regex | [features-filtering](references/features-filtering.md) |
| **Test Tags** | Gắn nhãn tag cho test để chọn lọc môi trường chạy | [features-test-tags](references/features-test-tags.md) |
| **Reporters** | Định dạng output kết quả test, cấu hình CI | [features-reporters](references/features-reporters.md) |
| **Benchmarking** | Đo kiểm hiệu năng thực thi với fixture `bench` (Tinybench) | [features-benchmarking](references/features-benchmarking.md) |

---

## 3. Kiến Trúc & Chuyên Sâu (Advanced)

| Chủ Đề | Mô Tả Nghiệp Vụ | Tài Liệu Chi Tiết |
|---|---|---|
| **Vi Utilities** | Trợ thủ `vi`: `vi.fn()`, `vi.spyOn()`, fake timers, `vi.waitFor` | [advanced-vi](references/advanced-vi.md) |
| **Environments** | Môi trường test: `node`, `jsdom`, `happy-dom`, custom | [advanced-environments](references/advanced-environments.md) |
| **Type Testing** | Kiểm thử static type TypeScript: `expectTypeOf`, `assertType` | [advanced-type-testing](references/advanced-type-testing.md) |
| **Projects** | Quản lý monorepo đa dự án, config độc lập theo project | [advanced-projects](references/advanced-projects.md) |
