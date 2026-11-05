import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/noble_response",
  JWT_SECRET: process.env.JWT_SECRET || "change_this_in_production_jwt_secret",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "change_this_in_production_refresh_secret",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  JWT_REFRESH_EXPIRES_DAYS: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || "7", 10),
  VITE_N8N_WEBHOOK_URL:
    process.env.VITE_N8N_WEBHOOK_URL || "https://n8n-v3-tjln.onrender.com/webhook/mychatapp",
  FRONTEND_URL: process.env.FRONTEND_URL || "https://intelligentresponse.vercel.app",
  UPLOAD_DIR: path.resolve(__dirname, "../uploads"),
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  RATE_LIMIT_MAX_AUTH: 30,
  RATE_LIMIT_MAX_API: 300,
};
