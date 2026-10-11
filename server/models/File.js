import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    storageProvider: {
      type: String,
      enum: ["local", "s3"],
      default: "local",
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    checksum: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["uploading", "uploaded", "processing", "failed", "deleted"],
      default: "uploaded",
    },
    processingStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
    extractedText: {
      type: String,
      default: "",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

fileSchema.index({ userId: 1, createdAt: -1 });

fileSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  delete obj.extractedText; // Don't serialize extracted text in standard metadata responses
  return obj;
};

export const File = mongoose.model("File", fileSchema);
