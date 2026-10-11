import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import authRouter from "./routes/auth.js";
import conversationsRouter from "./routes/conversations.js";
import { messagesRouter, conversationMessagesRouter } from "./routes/messages.js";
import generationsRouter from "./routes/generations.js";
import filesRouter from "./routes/files.js";
import { errorHandler, ApiError } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { callAiBackend } from "./services/ai.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Trust proxy for secure cookies behind reverse proxies (Vercel, Render, Nginx)
app.set("trust proxy", 1);

// CORS configuration
const allowedOrigins = [
  config.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "https://intellichat-sigma.vercel.app",
  "https://intelligentchat.onrender.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".onrender.com")
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Dev-friendly fallback
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// General API rate limiter
app.use("/api/v1", apiLimiter);

// API Documentation / Health Check
app.get("/api/v1/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      service: "IntelliChat API v1",
      timestamp: new Date().toISOString(),
      modelsSupported: ["n8n-genius"],
    },
  });
});

// Mount Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/conversations", conversationsRouter);
app.use("/api/v1/conversations/:conversationId/messages", conversationMessagesRouter);
app.use("/api/v1/messages", messagesRouter);
app.use("/api/v1/generations", generationsRouter);
app.use("/api/v1/files", filesRouter);

// Legacy `/api/chat` route to maintain backwards compatibility with existing clients
app.post("/api/chat", async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    const response = await callAiBackend({
      message: message || "",
      sessionId: sessionId || "legacy-session",
    });
    return res.status(200).json({ output: response });
  } catch (error) {
    next(error);
  }
});

// Serve static frontend in production
const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));

// Fallback to index.html for SPA routes (only if not an API request)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next(ApiError.notFound(`API route ${req.method} ${req.path} not found.`));
  }
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

// Standard Error Handler
app.use(errorHandler);
