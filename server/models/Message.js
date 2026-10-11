import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["system", "user", "assistant", "tool"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: [100000, "Message content is too long"],
    },
    attachmentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
      },
    ],
    parentMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    generationId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "streaming", "completed", "failed", "cancelled"],
      default: "completed",
    },
    model: {
      type: String,
      default: "n8n-genius",
    },
    usage: {
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
    },
    feedback: {
      rating: {
        type: String,
        enum: ["positive", "negative", null],
        default: null,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.index({ conversationId: 1, createdAt: 1, _id: 1 });
messageSchema.index({ userId: 1, conversationId: 1 });

messageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

export const Message = mongoose.model("Message", messageSchema);
