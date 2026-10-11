import mongoose from "mongoose";

const refreshTokenSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedBySessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RefreshTokenSession",
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    ipHash: {
      type: String,
      default: null,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

refreshTokenSessionSchema.index({ userId: 1, revokedAt: 1 });

export const RefreshTokenSession = mongoose.model("RefreshTokenSession", refreshTokenSessionSchema);
