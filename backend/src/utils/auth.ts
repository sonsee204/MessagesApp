import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { env } from "../config/env";

/**
 * Cấu trúc thông tin định danh (Payload) được mã hóa bên trong Access Token
 */
export interface AccessTokenPayload {
  userId: string;
  email: string;
  username: string;
}

/**
 * Cấu trúc thông tin định danh (Payload) được mã hóa bên trong Refresh Token
 */
export interface RefreshTokenPayload {
  userId: string;
  // Mã định danh ngẫu nhiên (JTI / Token ID) để đảm bảo tính duy nhất tuyệt đối cho mỗi lần sinh token
  tokenId?: string;
}

/**
 * Kiểu tương thích ngược cho các phần code hiện hành sử dụng TokenPayload
 */
export type TokenPayload = AccessTokenPayload;

/**
 * Tên khóa lưu trữ token trong Cookie
 */
export const AUTH_COOKIE_NAME = "token";

/**
 * Tên khóa lưu trữ Refresh Token trong HTTP-Only Cookie
 */
export const REFRESH_COOKIE_NAME = "refreshToken";

/**
 * Cấu hình bảo mật nâng cao chống hack cho HTTP-Only Cookie (Refresh Token):
 * - httpOnly: Ngăn chặn tuyệt đối JavaScript (document.cookie), miễn nhiễm trước tấn công XSS
 * - secure: Chỉ truyền cookie qua giao thức HTTPS bảo mật khi ở môi trường production (chống MitM / Sniffing)
 * - sameSite: 'lax' để ngăn chặn trình duyệt gửi cookie tự động trong các kịch bản Cross-Site Request Forgery (CSRF)
 * - path: '/api/auth' giới hạn cookie chỉ được gửi tới các endpoint xác thực, chống rò rỉ khi tải tài nguyên tĩnh
 * - signed: Bật chữ ký số mật mã HMAC-SHA256, tự động vô hiệu hóa nếu cookie bị hacker chỉnh sửa hoặc giả mạo
 * - maxAge: Thời hạn 7 ngày tính theo milliseconds
 */
export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  signed: true,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
};

/**
 * Cấu hình an toàn cho HTTP-Only Cookie cơ bản (tương thích ngược)
 */
export const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  signed: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Băm chuỗi token sử dụng thuật toán mật mã SHA-256 an toàn
 * Dùng để lưu trữ bản băm của Refresh Token vào cơ sở dữ liệu (chống lộ token nếu CSDL bị rò rỉ)
 * @param token Chuỗi token gốc
 * @returns Chuỗi băm hex 64 ký tự
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Băm mật khẩu người dùng sử dụng thư viện bcrypt với Salt rounds = 10
 * @param password Mật khẩu gốc dưới dạng văn bản thuần
 * @returns Chuỗi mật khẩu đã được mã hóa an toàn
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * So sánh mật khẩu người dùng nhập với chuỗi băm lưu trữ trong CSDL bằng bcrypt
 * @param password Mật khẩu người dùng nhập vào
 * @param hash Chuỗi mật khẩu băm đã lưu trước đó
 * @returns true nếu mật khẩu trùng khớp, ngược lại false
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Sinh chuỗi Access Token (ngắn hạn: 15 phút) ký bằng JWT_ACCESS_SECRET
 * @param payload Dữ liệu định danh người dùng cần đưa vào token
 * @returns Chuỗi token hoàn chỉnh
 */
export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Sinh chuỗi Refresh Token (dài hạn: 7 ngày) ký bằng JWT_REFRESH_SECRET
 * Tự động gắn mã tokenId ngẫu nhiên để hỗ trợ cơ chế Token Rotation (không bao giờ trùng lặp)
 * @param payload Dữ liệu định danh người dùng (userId, tokenId tùy chọn)
 * @returns Chuỗi refresh token hoàn chỉnh
 */
export function generateRefreshToken(payload: RefreshTokenPayload): string {
  const tokenId = payload.tokenId || crypto.randomBytes(16).toString("hex");
  return jwt.sign(
    { userId: payload.userId, tokenId },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    }
  );
}

/**
 * Sinh đồng thời cả cặp Access Token và Refresh Token
 * @param payload Thông tin định danh người dùng
 * @returns Đối tượng chứa accessToken và refreshToken
 */
export function generateAuthTokens(payload: AccessTokenPayload): {
  accessToken: string;
  refreshToken: string;
} {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ userId: payload.userId });
  return { accessToken, refreshToken };
}

/**
 * Xác thực và giải mã chuỗi Access Token sử dụng JWT_ACCESS_SECRET
 * @param token Chuỗi access token nhận được từ client
 * @returns Dữ liệu AccessTokenPayload nếu token hợp lệ và còn hạn
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

/**
 * Xác thực và giải mã chuỗi Refresh Token sử dụng JWT_REFRESH_SECRET
 * @param token Chuỗi refresh token nhận được từ client
 * @returns Dữ liệu RefreshTokenPayload nếu token hợp lệ và còn hạn
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

/**
 * Tương thích ngược: Sinh token mặc định
 */
export function generateToken(payload: TokenPayload): string {
  return generateAccessToken(payload);
}

/**
 * Tương thích ngược: Xác thực token mặc định
 */
export function verifyToken(token: string): TokenPayload {
  return verifyAccessToken(token);
}

/**
 * Thiết lập HTTP-Only Cookie chứa Refresh Token đã được ký số mật mã HMAC-SHA256
 * @param res Đối tượng Response của Express
 * @param token Chuỗi Refresh Token
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions);
}

/**
 * Xóa HTTP-Only Cookie Refresh Token khi người dùng đăng xuất
 * 1. Xóa cookie có chữ ký số (Signed Cookie) với đúng đường dẫn path: "/api/auth"
 * 2. Xóa cookie không chữ ký số phòng ngừa các phiên bản client cũ
 * @param res Đối tượng Response của Express
 */
export function clearRefreshTokenCookie(res: Response): void {
  // Xóa cookie đã ký số HMAC-SHA256
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth",
    signed: true,
  });

  // Xóa cookie không có chữ ký số để đảm bảo dọn dẹp sạch sẽ
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth",
  });
}

/**
 * Tương thích ngược: Thiết lập HTTP-Only Cookie cơ bản
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
}

/**
 * Tương thích ngược: Xóa HTTP-Only Cookie cơ bản
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    signed: true,
  });
}

/**
 * Trích xuất chuyên biệt Refresh Token từ Cookie bằng cookie-parser
 * 1. Đọc từ req.signedCookies (đã kiểm tra chữ ký HMAC-SHA256 hợp lệ)
 * 2. Dự phòng đọc từ req.cookies (cookie thông thường không ký)
 * @param req Đối tượng Request của Express
 * @returns Chuỗi token hợp lệ hoặc undefined nếu không có
 */
export function extractRefreshTokenFromCookie(req: Request): string | undefined {
  // Bước 1: Kiểm tra trong signedCookies (được cookie-parser xác thực chữ ký số)
  if (req.signedCookies && req.signedCookies[REFRESH_COOKIE_NAME]) {
    return req.signedCookies[REFRESH_COOKIE_NAME];
  }

  // Bước 2: Dự phòng kiểm tra trong cookies thông thường
  if (req.cookies && req.cookies[REFRESH_COOKIE_NAME]) {
    return req.cookies[REFRESH_COOKIE_NAME];
  }

  return undefined;
}

/**
 * Trích xuất và xác thực an toàn Refresh Token từ HTTP Request
 * 1. Ưu tiên đọc từ Signed Cookies (đã được cookie-parser kiểm tra chữ ký số HMAC-SHA256)
 * 2. Dự phòng đọc từ Cookies thông thường (hỗ trợ client không ký hoặc kiểm thử)
 * 3. Dự phòng đọc từ Request Body (dành cho Mobile App / API Client)
 * @param req Đối tượng Request của Express
 * @returns Chuỗi token hợp lệ hoặc undefined nếu không tìm thấy
 */
export function extractRefreshToken(req: Request): string | undefined {
  // 1. Kiểm tra từ Cookie trước (sử dụng hàm chuyên biệt)
  const tokenFromCookie = extractRefreshTokenFromCookie(req);
  if (tokenFromCookie) {
    return tokenFromCookie;
  }

  // 2. Dự phòng trong request body (cho mobile clients / API không dùng cookie)
  if (req.body && req.body.refreshToken) {
    return req.body.refreshToken;
  }

  return undefined;
}

/**
 * Trích xuất Access Token từ Header hoặc Cookie
 */
export function extractAccessToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  if (req.signedCookies) {
    const signed = req.signedCookies.accessToken || req.signedCookies[AUTH_COOKIE_NAME];
    if (signed) return signed;
  }

  if (req.cookies) {
    const regular = req.cookies.accessToken || req.cookies[AUTH_COOKIE_NAME];
    if (regular) return regular;
  }

  return undefined;
}
