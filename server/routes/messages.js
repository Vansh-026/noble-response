import express from "express";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { File } from "../models/File.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/errorHandler.js";
import {
  callAiBackend,
  generateTitle,
  registerGeneration,
  removeGeneration,
  streamTextToSSE,
} from "../services/ai.service.js";

export const messagesRouter = express.Router(); // Mounted at /api/v1/messages
export const conversationMessagesRouter = express.Router({ mergeParams: true }); // Mounted at /api/v1/conversations/:conversationId/messages

// ==========================================
// 1. /api/v1/conversations/:conversationId/messages
// ==========================================

conversationMessagesRouter.use(requireAuth);

// GET /api/v1/conversations/:conversationId/messages
conversationMessagesRouter.get("/", async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.isValidObjectId(conversationId)) {
      throw ApiError.badRequest("Invalid conversation ID format.");
    }

    // Verify conversation ownership
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.userId,
      deletedAt: null,
    });

    if (!conversation) {
      throw ApiError.notFound("Conversation not found.");
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 100);
    const cursor = req.query.cursor; // ISO date string

    const query = { conversationId };
    if (cursor) {
      query.createdAt = { $gt: new Date(cursor) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1, _id: 1 })
      .limit(limit)
      .populate("attachmentIds", "originalName mimeType size storageKey");

    return res.status(200).json({
      success: true,
      data: {
        items: messages.map((m) => {
          const json = m.toJSON();
          json.attachments = (m.attachmentIds || []).map((att) => ({
            id: att._id?.toString(),
            originalName: att.originalName,
            mimeType: att.mimeType,
            size: att.size,
          }));
          delete json.attachmentIds;
          return json;
        }),
      },
      meta: {
        totalReturned: messages.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/conversations/:conversationId/messages (Send user message + generate AI reply)
conversationMessagesRouter.post("/", async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const {
      content,
      attachmentIds = [],
      model = "n8n-genius",
      stream = true,
      customInstructions,
      userBio,
    } = req.body;

    if (!mongoose.isValidObjectId(conversationId)) {
      throw ApiError.badRequest("Invalid conversation ID format.");
    }

    if ((!content || !content.trim()) && (!attachmentIds || attachmentIds.length === 0)) {
      throw ApiError.unprocessableEntity("Message content or attachments are required.");
    }

    // Verify conversation ownership
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.userId,
      deletedAt: null,
    });

    if (!conversation) {
      throw ApiError.notFound("Conversation not found.");
    }

    // Verify attachments ownership if provided
    let verifiedAttachments = [];
    if (attachmentIds && attachmentIds.length > 0) {
      const validIds = attachmentIds.filter((id) => mongoose.isValidObjectId(id));
      verifiedAttachments = await File.find({
        _id: { $in: validIds },
        userId: req.userId,
      });

      if (verifiedAttachments.length !== attachmentIds.length) {
        throw ApiError.badRequest("One or more attachment IDs are invalid or not owned by you.");
      }
    }

    const generationId = uuidv4();
    const userMessageContent = (content || "").trim();

    // 1. Persist user message
    const userMessage = await Message.create({
      conversationId,
      userId: req.userId,
      role: "user",
      content: userMessageContent || "[Attached files]",
      attachmentIds: verifiedAttachments.map((f) => f._id),
      status: "completed",
      model,
    });

    // 2. Auto-generate title if this is the first message or title is default
    if (conversation.titleSource === "default" || conversation.messageCount === 0) {
      const newTitle = generateTitle(userMessageContent || verifiedAttachments[0]?.originalName);
      conversation.title = newTitle;
      conversation.titleSource = "generated";
    }

    conversation.messageCount = (conversation.messageCount || 0) + 1;
    conversation.lastMessagePreview = userMessageContent.slice(0, 80);
    conversation.updatedAt = new Date();
    await conversation.save();

    // 3. Prepare AI generation
    const abortController = new AbortController();
    registerGeneration(generationId, abortController);

    req.on("close", () => {
      abortController.abort();
      removeGeneration(generationId);
    });

    // Handle Streaming SSE
    if (stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      try {
        const aiResponseText = await callAiBackend({
          message: userMessageContent,
          sessionId: conversationId.toString(),
          attachments: verifiedAttachments,
          customInstructions,
          userBio,
          signal: abortController.signal,
        });

        await streamTextToSSE(res, aiResponseText, {
          generationId,
          messageId: userMessage._id.toString(),
          onComplete: async (finalContent) => {
            // Save assistant message
            const assistantMessage = await Message.create({
              conversationId,
              userId: req.userId,
              role: "assistant",
              content: finalContent,
              generationId,
              status: "completed",
              model,
            });

            conversation.messageCount += 1;
            conversation.lastMessagePreview = finalContent.slice(0, 80);
            conversation.updatedAt = new Date();
            await conversation.save();

            const assistantJson = assistantMessage.toJSON();
            assistantJson.attachments = [];
            return assistantJson;
          },
        });
      } catch (aiErr) {
        if (aiErr.name === "AbortError") {
          res.write(
            `event: message.error\ndata: ${JSON.stringify({ error: "Generation cancelled by user" })}\n\n`,
          );
        } else {
          res.write(`event: message.error\ndata: ${JSON.stringify({ error: aiErr.message })}\n\n`);
        }
        res.end();
      } finally {
        removeGeneration(generationId);
      }
      return;
    }

    // Handle Non-streaming
    try {
      const aiResponseText = await callAiBackend({
        message: userMessageContent,
        sessionId: conversationId.toString(),
        attachments: verifiedAttachments,
        customInstructions,
        userBio,
        signal: abortController.signal,
      });

      const assistantMessage = await Message.create({
        conversationId,
        userId: req.userId,
        role: "assistant",
        content: aiResponseText,
        generationId,
        status: "completed",
        model,
      });

      conversation.messageCount += 1;
      conversation.lastMessagePreview = aiResponseText.slice(0, 80);
      conversation.updatedAt = new Date();
      await conversation.save();

      const userJson = userMessage.toJSON();
      userJson.attachments = verifiedAttachments.map((f) => ({
        id: f._id.toString(),
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
      }));

      const assistantJson = assistantMessage.toJSON();
      assistantJson.attachments = [];

      return res.status(201).json({
        success: true,
        data: {
          userMessage: userJson,
          assistantMessage: assistantJson,
        },
      });
    } finally {
      removeGeneration(generationId);
    }
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 2. /api/v1/messages/*
// ==========================================

messagesRouter.use(requireAuth);

// PATCH /api/v1/messages/:messageId (Edit user message)
messagesRouter.patch("/:messageId", async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!mongoose.isValidObjectId(messageId)) {
      throw ApiError.badRequest("Invalid message ID format.");
    }
    if (!content || !content.trim()) {
      throw ApiError.unprocessableEntity("Updated message content is required.");
    }

    const message = await Message.findOne({
      _id: messageId,
      userId: req.userId,
      role: "user",
    });

    if (!message) {
      throw ApiError.notFound("User message not found or unauthorized.");
    }

    message.content = content.trim();
    message.editedAt = new Date();
    await message.save();

    return res.status(200).json({
      success: true,
      data: message.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/messages/:messageId/regenerate (Regenerate assistant response)
messagesRouter.post("/:messageId/regenerate", async (req, res, next) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.isValidObjectId(messageId)) {
      throw ApiError.badRequest("Invalid message ID format.");
    }

    const targetMessage = await Message.findOne({
      _id: messageId,
      userId: req.userId,
    });

    if (!targetMessage) {
      throw ApiError.notFound("Message not found.");
    }

    // Find the prompt message to regenerate for
    let userPrompt = "";
    let conversationId = targetMessage.conversationId;

    if (targetMessage.role === "assistant") {
      // Find preceding user message
      const prevUserMsg = await Message.findOne({
        conversationId,
        userId: req.userId,
        role: "user",
        createdAt: { $lt: targetMessage.createdAt },
      }).sort({ createdAt: -1 });

      userPrompt = prevUserMsg ? prevUserMsg.content : targetMessage.content;
    } else {
      userPrompt = targetMessage.content;
    }

    const generationId = uuidv4();
    const abortController = new AbortController();
    registerGeneration(generationId, abortController);

    req.on("close", () => {
      abortController.abort();
      removeGeneration(generationId);
    });

    const stream = req.query.stream !== "false";

    if (stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      try {
        const aiResponseText = await callAiBackend({
          message: userPrompt,
          sessionId: conversationId.toString(),
          signal: abortController.signal,
        });

        await streamTextToSSE(res, aiResponseText, {
          generationId,
          messageId: targetMessage._id.toString(),
          onComplete: async (finalContent) => {
            const newAssistantMsg = await Message.create({
              conversationId,
              userId: req.userId,
              role: "assistant",
              content: finalContent,
              generationId,
              status: "completed",
            });

            await Conversation.findByIdAndUpdate(conversationId, {
              updatedAt: new Date(),
              lastMessagePreview: finalContent.slice(0, 80),
            });

            const json = newAssistantMsg.toJSON();
            json.attachments = [];
            return json;
          },
        });
      } catch (err) {
        res.write(`event: message.error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      } finally {
        removeGeneration(generationId);
      }
      return;
    }

    const reply = await callAiBackend({
      message: userPrompt,
      sessionId: conversationId.toString(),
      signal: abortController.signal,
    });

    const newAssistantMsg = await Message.create({
      conversationId,
      userId: req.userId,
      role: "assistant",
      content: reply,
      generationId,
      status: "completed",
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      updatedAt: new Date(),
      lastMessagePreview: reply.slice(0, 80),
    });

    removeGeneration(generationId);
    return res.status(200).json({
      success: true,
      data: newAssistantMsg.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/messages/:messageId/feedback (Thumbs up / thumbs down)
messagesRouter.post("/:messageId/feedback", async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { rating } = req.body; // 'positive' | 'negative' | null

    if (!mongoose.isValidObjectId(messageId)) {
      throw ApiError.badRequest("Invalid message ID format.");
    }
    if (rating !== null && !["positive", "negative"].includes(rating)) {
      throw ApiError.unprocessableEntity("Rating must be 'positive', 'negative', or null.");
    }

    const message = await Message.findOne({
      _id: messageId,
      userId: req.userId,
    });

    if (!message) {
      throw ApiError.notFound("Message not found.");
    }

    message.feedback = {
      rating,
      updatedAt: new Date(),
    };
    await message.save();

    return res.status(200).json({
      success: true,
      data: {
        id: messageId,
        feedback: message.feedback,
      },
    });
  } catch (error) {
    next(error);
  }
});
