import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { AuthService, authService as defaultAuthService } from "../src/services/auth.service";
import { IUserRepository, userRepository } from "../src/repositories/user.repository";
import { IRefreshTokenRepository } from "../src/repositories/refresh-token.repository";
import { IRefreshToken } from "../src/models/refresh-token.model";
import { IUser } from "../src/models/user.model";
import { ConflictError, UnauthorizedError, NotFoundError } from "../src/core/errors";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import {
  verifyAccessToken,
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  REFRESH_COOKIE_NAME,
} from "../src/utils/auth";

class MockUserRepository implements IUserRepository {
  private users: Map<string, IUser> = new Map();

  async findById(id: string): Promise<IUser | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string, _includePassword = false): Promise<IUser | null> {
    const normalized = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === normalized) return u;
    }
    return null;
  }

  async findByUsername(username: string): Promise<IUser | null> {
    const normalized = username.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === normalized) return u;
    }
    return null;
  }

  async findByIdentifier(identifier: string, _includePassword = false): Promise<IUser | null> {
    const clean = identifier.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === clean || u.username.toLowerCase() === clean) {
        return u;
      }
    }
    return null;
  }

  async create(data: Partial<IUser>): Promise<IUser> {
    const id = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      ...data,
      id,
      _id: id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    this.users.set(id, user);
    return user;
  }

  async updateOnlineStatus(id: string, isOnline: boolean): Promise<IUser | null> {
    const user = this.users.get(id);
    if (user) user.isOnline = isOnline;
    return user ?? null;
  }

  async updateProfile(id: string, data: Partial<IUser>): Promise<IUser | null> {
    const user = this.users.get(id);
    if (user) Object.assign(user, data);
    return user ?? null;
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const user = this.users.get(id);
    if (user) user.passwordHash = passwordHash;
  }

  async searchUsers(keyword: string, currentUserId: string): Promise<{ users: IUser[]; total: number }> {
    const list = Array.from(this.users.values()).filter(
      (u) => u.id !== currentUserId && (u.username.includes(keyword) || u.displayName.includes(keyword))
    );
    return { users: list, total: list.length };
  }
}

class MockRefreshTokenRepository implements IRefreshTokenRepository {
  private tokens: Map<string, { userId: string; tokenHash: string; expiresAt: Date }> = new Map();

  async createToken(userId: string, tokenHash: string, expiresAt: Date): Promise<IRefreshToken> {
    const doc = { userId, tokenHash, expiresAt } as unknown as IRefreshToken;
    this.tokens.set(tokenHash, { userId, tokenHash, expiresAt });
    return doc;
  }

  async findByTokenHash(tokenHash: string): Promise<IRefreshToken | null> {
    const item = this.tokens.get(tokenHash);
    if (!item) return null;
    return item as unknown as IRefreshToken;
  }

  async deleteByTokenHash(tokenHash: string): Promise<boolean> {
    return this.tokens.delete(tokenHash);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [hash, item] of this.tokens.entries()) {
      if (item.userId === userId) {
        this.tokens.delete(hash);
      }
    }
  }

  async deleteExpiredTokens(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const [hash, item] of this.tokens.entries()) {
      if (item.expiresAt <= now) {
        this.tokens.delete(hash);
        count++;
      }
    }
    return count;
  }

  hasTokenHash(tokenHash: string): boolean {
    return this.tokens.has(tokenHash);
  }
}

describe("API Xác thực người dùng (Auth API - Access Token & Refresh Token)", () => {
  let mockUserRepo: MockUserRepository;
  let mockRefreshTokenRepo: MockRefreshTokenRepository;
  let authService: AuthService;
  const app = createApp();

  beforeEach(() => {
    mockUserRepo = new MockUserRepository();
    mockRefreshTokenRepo = new MockRefreshTokenRepository();
    authService = new AuthService(mockUserRepo, mockRefreshTokenRepo);
  });

  describe("Service Layer: AuthService.register", () => {
    it("Đăng ký thành công và cấp đủ cả Access Token (15m) lẫn Refresh Token (7d)", async () => {
      const result = await authService.register({
        username: "nguyen_van_a",
        email: "nguyenvana@example.com",
        password: "password123",
        displayName: "Nguyễn Văn A",
      });

      expect(result).toBeDefined();
      expect(result.user.id).toBeDefined();
      expect(result.user.username).toBe("nguyen_van_a");
      expect(result.user.email).toBe("nguyenvana@example.com");
      expect(result.user.displayName).toBe("Nguyễn Văn A");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.token).toBe(result.accessToken);

      // Kiểm tra Access Token được ký chính xác
      const decodedAccess = verifyAccessToken(result.accessToken);
      expect(decodedAccess.userId).toBe(result.user.id);
      expect(decodedAccess.email).toBe(result.user.email);

      // Kiểm tra Refresh Token được ký chính xác
      const decodedRefresh = verifyRefreshToken(result.refreshToken);
      expect(decodedRefresh.userId).toBe(result.user.id);
    });

    it("Ném ConflictError nếu email đã được đăng ký", async () => {
      await authService.register({
        username: "user_one",
        email: "duplicate@example.com",
        password: "password123",
      });

      await expect(
        authService.register({
          username: "user_two",
          email: "duplicate@example.com",
          password: "password456",
        })
      ).rejects.toThrow(ConflictError);
    });

    it("Ném ConflictError nếu username đã tồn tại", async () => {
      await authService.register({
        username: "same_username",
        email: "user1@example.com",
        password: "password123",
      });

      await expect(
        authService.register({
          username: "same_username",
          email: "user2@example.com",
          password: "password456",
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("Service Layer: AuthService.login", () => {
    beforeEach(async () => {
      await authService.register({
        username: "login_tester",
        email: "logintester@example.com",
        password: "securePassword123",
        displayName: "Tester Đăng Nhập",
      });
    });

    it("Đăng nhập thành công bằng email và cấp cả Access Token lẫn Refresh Token", async () => {
      const result = await authService.login({
        email: "logintester@example.com",
        password: "securePassword123",
      });

      expect(result).toBeDefined();
      expect(result.user.email).toBe("logintester@example.com");
      expect(result.user.username).toBe("login_tester");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      const decoded = verifyAccessToken(result.accessToken);
      expect(decoded.email).toBe("logintester@example.com");
    });

    it("Đăng nhập thành công bằng username", async () => {
      const result = await authService.login({
        identifier: "login_tester",
        password: "securePassword123",
      });

      expect(result).toBeDefined();
      expect(result.user.username).toBe("login_tester");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it("Cập nhật trạng thái isOnline = true khi đăng nhập thành công", async () => {
      await authService.login({
        identifier: "login_tester",
        password: "securePassword123",
      });

      const user = await mockUserRepo.findByUsername("login_tester");
      expect(user?.isOnline).toBe(true);
    });

    it("Ném UnauthorizedError nếu tài khoản không tồn tại trong hệ thống", async () => {
      await expect(
        authService.login({
          identifier: "nonexistent_account",
          password: "securePassword123",
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it("Ném UnauthorizedError nếu mật khẩu không chính xác", async () => {
      await expect(
        authService.login({
          identifier: "login_tester",
          password: "wrongPassword999",
        })
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("Service Layer: AuthService.refreshToken & Token Rotation", () => {
    let originalRefreshToken: string;
    let registeredUserId: string;

    beforeEach(async () => {
      const reg = await authService.register({
        username: "refresh_tester",
        email: "refreshtester@example.com",
        password: "password123",
      });
      registeredUserId = reg.user.id;
      originalRefreshToken = reg.refreshToken;
    });

    it("Làm mới token thành công và áp dụng Token Rotation (hủy token cũ, cấp token mới)", async () => {
      const result = await authService.refreshToken(originalRefreshToken);

      expect(result).toBeDefined();
      expect(result.user.id).toBe(registeredUserId);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      // Token mới phải khác token ban đầu
      expect(result.refreshToken).not.toBe(originalRefreshToken);

      // Thử dùng lại token cũ -> Phải bị từ chối do cơ chế Token Rotation đã xóa token cũ
      await expect(authService.refreshToken(originalRefreshToken)).rejects.toThrow(
        UnauthorizedError
      );

      // Token mới có thể tiếp tục được dùng để refresh
      const secondRefresh = await authService.refreshToken(result.refreshToken);
      expect(secondRefresh.accessToken).toBeDefined();
    });

    it("Ném UnauthorizedError nếu chuỗi refresh token bị sai lệch hoặc giả mạo", async () => {
      await expect(authService.refreshToken("invalid.refresh.token")).rejects.toThrow(
        UnauthorizedError
      );
    });

    it("Ném UnauthorizedError nếu refresh token không tồn tại trong CSDL (đã bị thu hồi)", async () => {
      // Tạo một refresh token hợp lệ về mặt chữ ký nhưng chưa được lưu vào mock repo
      const fakeToken = generateRefreshToken({ userId: "unknown_user_id" });

      await expect(authService.refreshToken(fakeToken)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("Service Layer: AuthService.logout", () => {
    it("Đăng xuất thành công: thu hồi Refresh Token và cập nhật trạng thái offline", async () => {
      const reg = await authService.register({
        username: "logout_tester",
        email: "logout@example.com",
        password: "password123",
      });

      // Kiểm tra token có thể refresh trước khi logout
      const beforeLogout = await authService.refreshToken(reg.refreshToken);
      expect(beforeLogout).toBeDefined();

      // Đăng xuất và thu hồi token mới
      await authService.logout(reg.user.id, beforeLogout.refreshToken);

      // Thử refresh sau khi đăng xuất -> Phải bị từ chối
      await expect(authService.refreshToken(beforeLogout.refreshToken)).rejects.toThrow(
        UnauthorizedError
      );

      // Trạng thái người dùng chuyển về offline
      const user = await mockUserRepo.findById(reg.user.id);
      expect(user?.isOnline).toBe(false);
    });

    it("Đăng xuất thành công chỉ với Refresh Token (tự động truy xuất userId từ session CSDL)", async () => {
      const reg = await authService.register({
        username: "token_only_logout_user",
        email: "tokenonly@example.com",
        password: "password123",
      });

      // Giả lập người dùng đang trực tuyến
      await mockUserRepo.updateOnlineStatus(reg.user.id, true);
      let user = await mockUserRepo.findById(reg.user.id);
      expect(user?.isOnline).toBe(true);

      // Đăng xuất mà KHÔNG truyền userId (chỉ truyền refreshToken đọc từ Cookie)
      await authService.logout(undefined, reg.refreshToken);

      // Session Refresh Token đã bị xóa khỏi CSDL
      const tokenHash = hashToken(reg.refreshToken);
      const tokenDoc = await mockRefreshTokenRepo.findByTokenHash(tokenHash);
      expect(tokenDoc).toBeNull();

      // Người dùng tự động được cập nhật trạng thái ngoại tuyến
      user = await mockUserRepo.findById(reg.user.id);
      expect(user?.isOnline).toBe(false);
    });

    it("Đăng xuất hoạt động an toàn và lũy đẳng (idempotent) khi token không tồn tại trong CSDL", async () => {
      // Khi client gửi refresh token không tồn tại, hàm logout không quăng lỗi
      await expect(
        authService.logout(undefined, "non_existent_refresh_token_string")
      ).resolves.not.toThrow();
    });
  });

  describe("HTTP Endpoint: POST /api/auth/register Validation", () => {
    it("Trả về 400 VALIDATION_ERROR nếu thiếu toàn bộ body", async () => {
      const res = await request(app).post("/api/auth/register").send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
    });

    it("Trả về 400 nếu email sai định dạng", async () => {
      const res = await request(app).post("/api/auth/register").send({
        username: "valid_user",
        email: "not-an-email",
        password: "password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("HTTP Endpoint: POST /api/auth/login Validation", () => {
    it("Trả về 400 nếu thiếu cả email lẫn identifier", async () => {
      const res = await request(app).post("/api/auth/login").send({
        password: "password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("HTTP Endpoint: Cookie & Token Integration (/register, /login, /refresh, /logout)", () => {
    it("POST /api/auth/register thiết lập HTTP-Only Cookie chứa Refresh Token và trả Access Token", async () => {
      const mockUser = {
        id: "mock_user_123",
        username: "cookie_user",
        email: "cookie_user@example.com",
        displayName: "Cookie User",
      };
      const mockAccessToken = generateAccessToken({
        userId: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
      });
      const mockRefreshToken = generateRefreshToken({ userId: mockUser.id });

      vi.spyOn(defaultAuthService, "register").mockResolvedValueOnce({
        user: mockUser,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        token: mockAccessToken,
      });

      const res = await request(app).post("/api/auth/register").send({
        username: "cookie_user",
        email: "cookie_user@example.com",
        password: "password123",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe(mockAccessToken);
      // Refresh Token KHÔNG được trả trong body — chỉ tồn tại trong HTTP-Only Cookie để chống XSS
      expect(res.body.data.refreshToken).toBeUndefined();

      // Kiểm tra Set-Cookie chứa refreshToken có chữ ký HMAC (s:...), cờ HttpOnly và path=/api/auth
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : cookies;
      expect(cookieStr).toContain(`${REFRESH_COOKIE_NAME}=s%3A${mockRefreshToken}`);
      expect(cookieStr.toLowerCase()).toContain("httponly");
      expect(cookieStr).toContain("Path=/api/auth");
    });

    it("POST /api/auth/login thiết lập HTTP-Only Cookie chứa Refresh Token đã ký mật mã", async () => {
      const mockUser = {
        id: "mock_user_login",
        username: "login_user",
        email: "login_user@example.com",
        displayName: "Login User",
      };
      const mockAccessToken = generateAccessToken({
        userId: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
      });
      const mockRefreshToken = generateRefreshToken({ userId: mockUser.id });

      vi.spyOn(defaultAuthService, "login").mockResolvedValueOnce({
        user: mockUser,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        token: mockAccessToken,
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "login_user@example.com",
        password: "securePassword123",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe(mockAccessToken);

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : cookies;
      expect(cookieStr).toContain(`${REFRESH_COOKIE_NAME}=s%3A${mockRefreshToken}`);
      expect(cookieStr.toLowerCase()).toContain("httponly");
      expect(cookieStr).toContain("Path=/api/auth");
    });

    it("POST /api/auth/refresh thành công khi gửi Refresh Token qua HTTP-Only Cookie", async () => {
      const mockUser = {
        id: "refresh_user_id",
        username: "refresh_user",
        email: "refresh@example.com",
        displayName: "Refresh User",
      };
      const oldRefreshToken = generateRefreshToken({ userId: mockUser.id });
      const newAccessToken = generateAccessToken({
        userId: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
      });
      const newRefreshToken = generateRefreshToken({ userId: mockUser.id });

      vi.spyOn(defaultAuthService, "refreshToken").mockResolvedValueOnce({
        user: mockUser,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        token: newAccessToken,
      });

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [`${REFRESH_COOKIE_NAME}=${oldRefreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe(newAccessToken);

      // Kiểm tra Set-Cookie cập nhật refreshToken mới có ký số
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : cookies;
      expect(cookieStr).toContain(`${REFRESH_COOKIE_NAME}=s%3A${newRefreshToken}`);
    });

    it("POST /api/auth/refresh thành công khi gửi Refresh Token qua Request Body (cho Mobile App)", async () => {
      const mockUser = {
        id: "mobile_user_id",
        username: "mobile_user",
        email: "mobile@example.com",
        displayName: "Mobile User",
      };
      const validRefreshToken = generateRefreshToken({ userId: mockUser.id });
      const newAccessToken = generateAccessToken({
        userId: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
      });
      const newRefreshToken = generateRefreshToken({ userId: mockUser.id });

      vi.spyOn(defaultAuthService, "refreshToken").mockResolvedValueOnce({
        user: mockUser,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        token: newAccessToken,
      });

      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: validRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe(newAccessToken);
    });

    it("POST /api/auth/refresh từ chối nếu chữ ký Signed Cookie bị giả mạo / can thiệp (Tampered Cookie)", async () => {
      // Gửi cookie có tiền tố s: nhưng chữ ký sai lệch
      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", [`${REFRESH_COOKIE_NAME}=s%3Afake_token_value.invalid_tampered_signature`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("POST /api/auth/refresh chặn đứng tấn công CSRF nếu Origin không thuộc danh sách cho phép", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Origin", "https://malicious-hacker-site.com")
        .send({ refreshToken: "any_token" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CSRF_ORIGIN_FORBIDDEN");
    });

    it("POST /api/auth/refresh trả về 401 UNAUTHORIZED nếu thiếu Refresh Token", async () => {
      const res = await request(app).post("/api/auth/refresh").send({});

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(res.body.error.message).toContain("Vui lòng cung cấp refresh token");
    });

    it("POST /api/auth/logout xóa HTTP-Only Cookie phiên xác thực", async () => {
      const res = await request(app).post("/api/auth/logout");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe("Đăng xuất thành công");

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : cookies;
      // Trình duyệt xóa cookie khi ngày hết hạn lùi về quá khứ (Epoch: 01 Jan 1970)
      expect(cookieStr).toContain("1970");
      expect(cookieStr).toContain("Path=/api/auth");
    });

    it("POST /api/auth/logout nhận diện Refresh Token từ Signed Cookie đọc bởi cookie-parser và thu hồi session", async () => {
      const mockRefreshToken = generateRefreshToken({ userId: "mock_logout_user" });
      const logoutSpy = vi.spyOn(defaultAuthService, "logout").mockResolvedValueOnce();

      // Ký cookie bằng HMAC-SHA256 chuẩn định dạng của cookie-parser (s:<token>.<sig>)
      const hmacSignature = crypto
        .createHmac("sha256", env.COOKIE_SECRET)
        .update(mockRefreshToken)
        .digest("base64")
        .replace(/=+$/, "");
      const signedCookieValue = `s:${mockRefreshToken}.${hmacSignature}`;

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [`${REFRESH_COOKIE_NAME}=${encodeURIComponent(signedCookieValue)}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe("Đăng xuất thành công");
      // Xác nhận AuthService.logout được gọi với đúng refresh token đã trích xuất từ Signed Cookie
      expect(logoutSpy).toHaveBeenCalledWith(undefined, mockRefreshToken);

      // Trình duyệt nhận chỉ thị xóa cookie qua Set-Cookie
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : cookies;
      expect(cookieStr).toContain("1970");
      expect(cookieStr).toContain("Path=/api/auth");
    });
  });

  describe("HTTP Endpoint: GET /api/auth/me Authentication Guard", () => {
    it("Truy cập thành công với Access Token trong Header Authorization: Bearer <token>", async () => {
      const mockUser = {
        id: "user_via_header_id",
        username: "header_user",
        email: "header@example.com",
        displayName: "Header User",
      } as unknown as IUser;

      const accessToken = generateAccessToken({
        userId: "user_via_header_id",
        username: "header_user",
        email: "header@example.com",
      });

      vi.spyOn(userRepository, "findById").mockResolvedValueOnce(mockUser);
      vi.spyOn(defaultAuthService, "getProfile").mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("user_via_header_id");
    });

    it("Trả về 401 UNAUTHORIZED nếu thiếu Header Authorization lẫn Cookie", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(res.body.error.message).toContain("Vui lòng đăng nhập để truy cập tài nguyên này");
    });

    it("Trả về 401 UNAUTHORIZED nếu Access Token không hợp lệ hoặc bị giả mạo", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid.fake.token");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(res.body.error.message).toContain("không hợp lệ hoặc đã bị chỉnh sửa");
    });

    it("Trả về 401 TOKEN_EXPIRED nếu Access Token đã hết hạn sử dụng", async () => {
      // Sinh token đã hết hạn 10 giây trước
      const expiredToken = jwt.sign(
        { userId: "expired_user_id", username: "expired_user", email: "expired@example.com" },
        env.JWT_ACCESS_SECRET,
        { expiresIn: "-10s" }
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("TOKEN_EXPIRED");
      expect(res.body.error.message).toContain("Token đã hết hạn, vui lòng làm mới token");
    });

    it("Trả về 401 UNAUTHORIZED nếu người dùng không tồn tại trong CSDL (đã bị xóa tài khoản)", async () => {
      const validToken = generateAccessToken({
        userId: "deleted_user_id",
        username: "deleted_user",
        email: "deleted@example.com",
      });

      // Giả lập CSDL không tìm thấy người dùng
      vi.spyOn(userRepository, "findById").mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(res.body.error.message).toContain("không tồn tại hoặc đã bị xóa");
    });
  });
});
