import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
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

app.set("trust proxy", 1);

const allowedOrigins = [
  config.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "https://intelligentresponse.vercel.app",
  "https://intellichatresponse.vercel.app",
  "https://intelligentresponse.onrender.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".onrender.com")
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    optionsSuccessStatus: 200,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api/v1", apiLimiter);

app.get("/api/v1/health", (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  res.json({
    status: isDbReady ? "ok" : "degraded",
    database: isDbReady ? "connected" : "disconnected",
    timestamp: Date.now(),
  });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/conversations", conversationsRouter);
app.use("/api/v1/conversations/:conversationId/messages", conversationMessagesRouter);
app.use("/api/v1/messages", messagesRouter);
app.use("/api/v1/generations", generationsRouter);
app.use("/api/v1/files", filesRouter);

app.post("/api/chat", async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    const response = await callAiBackend({
      message: message || "",
      sessionId: sessionId || "session",
    });
    return res.status(200).json({ output: response });
  } catch (error) {
    next(error);
  }
});

const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next(ApiError.notFound(`Route ${req.method} ${req.path} not found.`));
  }
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) next();
  });
});

app.use(errorHandler);
