import express from "express";
import mongoose from "mongoose";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { File } from "../models/File.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";
import { deletePhysicalFile } from "../services/file.service.js";

const router = express.Router();

// Apply auth to all conversation routes
router.use(requireAuth);

// 1. DELETE /api/v1/conversations/trash (MUST BE BEFORE /:conversationId)
router.delete("/trash", async (req, res, next) => {
  try {
    const trashed = await Conversation.find({
      userId: req.userId,
      deletedAt: { $ne: null },
    });

    const conversationIds = trashed.map((c) => c._id);

    if (conversationIds.length > 0) {
      // Find associated messages and files
      const messages = await Message.find({
        conversationId: { $in: conversationIds },
      });

      const fileIds = messages.flatMap((m) => m.attachmentIds || []);
      if (fileIds.length > 0) {
        const files = await File.find({ _id: { $in: fileIds } });
        for (const file of files) {
          await deletePhysicalFile(file.storageKey);
          await File.findByIdAndDelete(file._id);
        }
      }

      await Message.deleteMany({ conversationId: { $in: conversationIds } });
      await Conversation.deleteMany({ _id: { $in: conversationIds } });
    }

    return res.status(200).json({
      success: true,
      data: {
        message: `Successfully emptied trash (${conversationIds.length} conversations removed).`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 2. POST /api/v1/conversations (Create conversation)
router.post("/", async (req, res, next) => {
  try {
    const { title = "New chat", model = "n8n-genius" } = req.body;

    const conversation = await Conversation.create({
      userId: req.userId,
      title: (title || "New chat").trim().slice(0, 100),
      titleSource: title && title !== "New chat" ? "user" : "default",
      model,
    });

    return res.status(201).json({
      success: true,
      data: conversation.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// 3. GET /api/v1/conversations (List user's conversations with pagination & search)
router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || "30", 10), 1), 100);
    const cursor = req.query.cursor; // ISO date string of updatedAt
    const search = (req.query.search || "").trim();
    const includeDeleted = req.query.trash === "true";

    const query = {
      userId: req.userId,
      deletedAt: includeDeleted ? { $ne: null } : null,
    };

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    if (cursor) {
      query.updatedAt = { $lt: new Date(cursor) };
    }

    const items = await Conversation.find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;
    const nextCursor =
      hasMore && results.length > 0 ? results[results.length - 1].updatedAt.toISOString() : null;

    return res.status(200).json({
      success: true,
      data: {
        items: results.map((c) => c.toJSON()),
        nextCursor,
      },
      meta: {
        limit,
        hasMore,
        totalReturned: results.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 4. GET /api/v1/conversations/:conversationId
router.get("/:conversationId", async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.isValidObjectId(conversationId)) {
      throw ApiError.badRequest("Invalid conversation ID format.");
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.userId,
    });

    if (!conversation) {
      throw ApiError.notFound("Conversation not found.");
    }

    return res.status(200).json({
      success: true,
      data: conversation.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// 5. PATCH /api/v1/conversations/:conversationId (Rename)
router.patch("/:conversationId", async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { title } = req.body;

    if (!mongoose.isValidObjectId(conversationId)) {
      throw ApiError.badRequest("Invalid conversation ID format.");
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      throw ApiError.unprocessableEntity("A valid title is required.");
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.userId,
      deletedAt: null,
    });

    if (!conversation) {
      throw ApiError.notFound("Conversation not found.");
    }

    conversation.title = title.trim().slice(0, 100);
    conversation.titleSource = "user"; // Flag that user customized the title
    conversation.updatedAt = new Date();
    await conversation.save();

    return res.status(200).json({
      success: true,
      data: conversation.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// 6. DELETE /api/v1/conversations/:conversationId (Soft delete or permanent)
router.delete("/:conversationId", async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const permanent = req.query.permanent === "true";

    if (!mongoose.isValidObjectId(conversationId)) {
      throw ApiError.badRequest("Invalid conversation ID format.");
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.userId,
    });

    if (!conversation) {
      throw ApiError.notFound("Conversation not found.");
    }

    if (permanent || conversation.deletedAt !== null) {
      // Permanent removal: clean messages and attachments
      const messages = await Message.find({ conversationId });
      const fileIds = messages.flatMap((m) => m.attachmentIds || []);
      if (fileIds.length > 0) {
        const files = await File.find({ _id: { $in: fileIds } });
        for (const file of files) {
          await deletePhysicalFile(file.storageKey);
          await File.findByIdAndDelete(file._id);
        }
      }
      await Message.deleteMany({ conversationId });
      await Conversation.findByIdAndDelete(conversationId);

      return res.status(200).json({
        success: true,
        data: { id: conversationId, deleted: true, permanent: true },
      });
    }

    // Soft delete
    conversation.deletedAt = new Date();
    await conversation.save();

    return res.status(200).json({
      success: true,
      data: {
        id: conversationId,
        deleted: true,
        deletedAt: conversation.deletedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 7. POST /api/v1/conversations/:conversationId/restore
router.post("/:conversationId/restore", async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.isValidObjectId(conversationId)) {
      throw ApiError.badRequest("Invalid conversation ID format.");
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.userId,
      deletedAt: { $ne: null },
    });

    if (!conversation) {
      throw ApiError.notFound("Trashed conversation not found.");
    }

    conversation.deletedAt = null;
    conversation.updatedAt = new Date();
    await conversation.save();

    return res.status(200).json({
      success: true,
      data: conversation.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
