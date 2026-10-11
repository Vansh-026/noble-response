import express from "express";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { File } from "../models/File.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";
import {
  uploadMiddleware,
  extractTextFromFile,
  deletePhysicalFile,
} from "../services/file.service.js";
import { config } from "../config.js";

const router = express.Router();

router.use(requireAuth);

// POST /api/v1/files/upload
router.post("/upload", (req, res, next) => {
  uploadMiddleware.single("file")(req, res, async (err) => {
    if (err) return next(err);

    try {
      if (!req.file) {
        throw ApiError.badRequest("No file uploaded. Expected 'file' field.");
      }

      const { originalname, filename, mimetype, size, path: filePath } = req.file;

      // Extract text content from document/text/pdf for AI context
      const extractedText = await extractTextFromFile(filePath, mimetype, originalname);

      const fileRecord = await File.create({
        userId: req.userId,
        originalName: originalname,
        storageKey: filename,
        storageProvider: "local",
        mimeType: mimetype,
        size,
        status: "uploaded",
        processingStatus: "completed",
        extractedText,
      });

      return res.status(201).json({
        success: true,
        data: {
          id: fileRecord._id.toString(),
          originalName: fileRecord.originalName,
          mimeType: fileRecord.mimeType,
          size: fileRecord.size,
          status: fileRecord.status,
          createdAt: fileRecord.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  });
});

// GET /api/v1/files/:fileId (Metadata)
router.get("/:fileId", async (req, res, next) => {
  try {
    const { fileId } = req.params;
    if (!mongoose.isValidObjectId(fileId)) {
      throw ApiError.badRequest("Invalid file ID format.");
    }

    const file = await File.findOne({
      _id: fileId,
      userId: req.userId,
      deletedAt: null,
    });

    if (!file) {
      throw ApiError.notFound("File not found or unauthorized.");
    }

    return res.status(200).json({
      success: true,
      data: {
        id: file._id.toString(),
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        status: file.status,
        createdAt: file.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/files/:fileId/download (Stream/download)
router.get("/:fileId/download", async (req, res, next) => {
  try {
    const { fileId } = req.params;
    if (!mongoose.isValidObjectId(fileId)) {
      throw ApiError.badRequest("Invalid file ID format.");
    }

    const file = await File.findOne({
      _id: fileId,
      userId: req.userId,
      deletedAt: null,
    });

    if (!file) {
      throw ApiError.notFound("File not found or unauthorized.");
    }

    const filePath = path.join(config.UPLOAD_DIR, file.storageKey);
    if (!fs.existsSync(filePath)) {
      throw ApiError.notFound("Physical file storage not found.");
    }

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.originalName)}"`,
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/files/:fileId
router.delete("/:fileId", async (req, res, next) => {
  try {
    const { fileId } = req.params;
    if (!mongoose.isValidObjectId(fileId)) {
      throw ApiError.badRequest("Invalid file ID format.");
    }

    const file = await File.findOne({
      _id: fileId,
      userId: req.userId,
      deletedAt: null,
    });

    if (!file) {
      throw ApiError.notFound("File not found.");
    }

    await deletePhysicalFile(file.storageKey);
    file.deletedAt = new Date();
    file.status = "deleted";
    await file.save();

    return res.status(200).json({
      success: true,
      data: {
        id: fileId,
        deleted: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
