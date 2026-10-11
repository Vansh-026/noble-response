import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { hashToken, generateRandomToken, hashIp } from "../utils/crypto.js";
import { RefreshTokenSession } from "../models/RefreshTokenSession.js";
import { ApiError } from "../middleware/errorHandler.js";

export function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id || user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES_IN },
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw ApiError.unauthorized("Access token has expired.");
    }
    throw ApiError.unauthorized("Invalid access token.");
  }
}

export async function createRefreshTokenSession(user, req) {
  const rawToken = generateRandomToken(40);
  const tokenHash = hashToken(rawToken);
  const familyId = uuidv4();
  const expiresAt = new Date(Date.now() + config.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const session = await RefreshTokenSession.create({
    userId: user._id || user.id,
    tokenHash,
    familyId,
    expiresAt,
    userAgent: req?.headers?.["user-agent"]?.slice(0, 255) || null,
    ipHash: hashIp(req?.ip || req?.socket?.remoteAddress),
    lastUsedAt: new Date(),
  });

  return { session, rawToken, expiresAt };
}

export async function rotateRefreshToken(rawToken, req) {
  if (!rawToken) {
    throw ApiError.unauthorized("Refresh token is required.");
  }

  const tokenHash = hashToken(rawToken);

  // Find session with this tokenHash
  const session = await RefreshTokenSession.findOne({ tokenHash }).populate("userId");

  if (!session) {
    throw ApiError.unauthorized("Invalid refresh token session.");
  }

  // Detect token reuse / replay of an already-revoked token
  if (session.revokedAt) {
    console.warn(
      `[Security] Detected reuse of revoked refresh token family ${session.familyId} for user ${session.userId?._id}`,
    );
    // Invalidate the ENTIRE token family for security
    await RefreshTokenSession.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { revokedAt: new Date() },
    );
    throw ApiError.unauthorized(
      "Security alert: Refresh token already used. All family sessions revoked.",
    );
  }

  // Check expiration
  if (session.expiresAt < new Date()) {
    session.revokedAt = new Date();
    await session.save();
    throw ApiError.unauthorized("Refresh token has expired. Please sign in again.");
  }

  // User status check
  const user = session.userId;
  if (!user || user.status === "disabled") {
    session.revokedAt = new Date();
    await session.save();
    throw ApiError.unauthorized("User account is disabled or no longer exists.");
  }

  // Generate new token in the same family
  const newRawToken = generateRandomToken(40);
  const newTokenHash = hashToken(newRawToken);
  const newExpiresAt = new Date(Date.now() + config.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const newSession = await RefreshTokenSession.create({
    userId: user._id,
    tokenHash: newTokenHash,
    familyId: session.familyId,
    expiresAt: newExpiresAt,
    userAgent: req?.headers?.["user-agent"]?.slice(0, 255) || null,
    ipHash: hashIp(req?.ip || req?.socket?.remoteAddress),
    lastUsedAt: new Date(),
  });

  // Mark old session as revoked and replaced
  session.revokedAt = new Date();
  session.replacedBySessionId = newSession._id;
  await session.save();

  const accessToken = generateAccessToken(user);

  return {
    user,
    accessToken,
    newRawToken,
    expiresAt: newExpiresAt,
  };
}

export async function revokeSessionByRawToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await RefreshTokenSession.updateOne({ tokenHash, revokedAt: null }, { revokedAt: new Date() });
}

export async function revokeAllSessionsForUser(userId) {
  await RefreshTokenSession.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

export function setRefreshTokenCookie(res, rawToken, expiresAt) {
  const isProd = config.NODE_ENV === "production";
  res.cookie("refreshToken", rawToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    expires: expiresAt,
    path: "/",
  });
}

export function clearRefreshTokenCookie(res) {
  const isProd = config.NODE_ENV === "production";
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
}
