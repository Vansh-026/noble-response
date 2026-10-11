import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/intellichat",
  JWT_SECRET: process.env.JWT_SECRET || "intellichat-jwt-secret-secure-key-2026-v1",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || "intellichat-refresh-secret-secure-key-2026-v1",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  JWT_REFRESH_EXPIRES_DAYS: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || "7", 10),
  VITE_N8N_WEBHOOK_URL:
    process.env.VITE_N8N_WEBHOOK_URL || "https://n8n-v3-tjln.onrender.com/webhook/mychatapp",
  FRONTEND_URL: process.env.FRONTEND_URL || "https://intellichat-sigma.vercel.app",
  UPLOAD_DIR: path.resolve(__dirname, "../uploads"),
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 mins
  RATE_LIMIT_MAX_AUTH: 20, // 20 requests per 15 min for auth sensitive
  RATE_LIMIT_MAX_API: 300, // 300 requests per 15 min for normal api
};
