import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.string().default("5000").transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/appmessaging"),
  JWT_SECRET: z.string().min(10).default("appmessaging_super_secret_jwt_key_at_least_32_characters_long"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  // Khóa bí mật riêng dùng để ký Access Token (ngắn hạn)
  JWT_ACCESS_SECRET: z
    .string()
    .min(10)
    .default("appmessaging_super_secret_jwt_key_at_least_32_characters_long"),
  // Thời hạn của Access Token (mặc định 15 phút)
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  // Khóa bí mật riêng biệt dùng để ký Refresh Token (dài hạn)
  JWT_REFRESH_SECRET: z
    .string()
    .min(10)
    .default("appmessaging_super_secret_refresh_jwt_key_at_least_32_characters_long"),
  // Thời hạn của Refresh Token (mặc định 7 ngày)
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  // Khóa bí mật dùng để ký chữ ký số mật mã HMAC-SHA256 cho Cookies (phòng chống Cookie Tampering & Forgery)
  COOKIE_SECRET: z
    .string()
    .min(16)
    .default("appmessaging_super_secret_cookie_hmac_signing_key_at_least_32_chars"),
});

export const env = EnvSchema.parse(process.env);
