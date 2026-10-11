import fs from "fs";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { ApiError } from "../middleware/errorHandler.js";

// Ensure upload directory exists
if (!fs.existsSync(config.UPLOAD_DIR)) {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
}

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/javascript",
  "text/html",
  "text/css",
  "application/xml",
  "text/x-python",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
]);

// Allowed extensions
const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".html",
  ".css",
  ".xml",
  ".py",
  ".docx",
]);

// Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE_BYTES, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) && !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(
        new ApiError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          `File type ${file.mimetype || ext} is not supported. Supported types include PDF, images, text, Markdown, CSV, JSON, code, and documents.`,
        ),
      );
    }
    cb(null, true);
  },
});

export async function extractTextFromFile(filePath, mimeType, originalName) {
  try {
    const ext = path.extname(originalName || filePath).toLowerCase();

    // Plain text / code / JSON / CSV / Markdown
    if (
      mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      mimeType === "application/xml" ||
      [
        ".txt",
        ".md",
        ".csv",
        ".json",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".py",
        ".html",
        ".css",
      ].includes(ext)
    ) {
      const content = await fs.promises.readFile(filePath, "utf-8");
      // Truncate to first 30,000 characters for token limit safety
      return content.slice(0, 30000);
    }

    // PDF extraction
    if (mimeType === "application/pdf" || ext === ".pdf") {
      try {
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const dataBuffer = await fs.promises.readFile(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text ? data.text.slice(0, 30000) : "";
      } catch (pdfErr) {
        console.warn(`[FileService] PDF parsing failed: ${pdfErr.message}`);
        return `[PDF Document: ${originalName}]`;
      }
    }

    // Image description placeholder
    if (mimeType.startsWith("image/")) {
      return `[Image attachment: ${originalName}]`;
    }

    return `[Attached file: ${originalName}]`;
  } catch (err) {
    console.error(`[FileService] Failed to extract text: ${err.message}`);
    return "";
  }
}

export async function deletePhysicalFile(storageKey) {
  try {
    const filePath = path.join(config.UPLOAD_DIR, storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (err) {
    console.warn(`[FileService] Could not remove file ${storageKey}:`, err.message);
  }
}
