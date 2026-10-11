import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters"],
      default: "New chat",
    },
    titleSource: {
      type: String,
      enum: ["default", "generated", "user"],
      default: "default",
    },
    model: {
      type: String,
      default: "n8n-genius",
    },
    lastMessagePreview: {
      type: String,
      default: "",
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

conversationSchema.index({ userId: 1, updatedAt: -1, _id: -1 });
conversationSchema.index({ userId: 1, deletedAt: 1, updatedAt: -1 });

conversationSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

export const Conversation = mongoose.model("Conversation", conversationSchema);
