import express from "express";
import { User } from "../models/User.js";
import { VerificationToken } from "../models/VerificationToken.js";
import { hashPassword, comparePassword, hashToken, generateRandomToken } from "../utils/crypto.js";
import {
  generateAccessToken,
  createRefreshTokenSession,
  rotateRefreshToken,
  revokeSessionByRawToken,
  revokeAllSessionsForUser,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from "../services/token.service.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = express.Router();

// POST /api/v1/auth/register
router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      throw ApiError.unprocessableEntity("Name must be at least 2 characters.");
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      throw ApiError.unprocessableEntity("A valid email address is required.");
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      throw ApiError.unprocessableEntity("Password must be at least 6 characters.");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw ApiError.conflict("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      emailVerified: true, // Auto-verify on registration for smooth UX
    });

    const accessToken = generateAccessToken(user);
    const { rawToken, expiresAt } = await createRefreshTokenSession(user, req);
    setRefreshTokenCookie(res, rawToken, expiresAt);

    return res.status(201).json({
      success: true,
      data: {
        user: user.toJSON(),
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/login
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw ApiError.badRequest("Email and password are required.");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.passwordHash) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    if (user.status === "disabled") {
      throw ApiError.forbidden("Your account has been disabled.");
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    const accessToken = generateAccessToken(user);
    const { rawToken, expiresAt } = await createRefreshTokenSession(user, req);
    setRefreshTokenCookie(res, rawToken, expiresAt);

    return res.status(200).json({
      success: true,
      data: {
        user: user.toJSON(),
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/refresh
router.post("/refresh", async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      throw ApiError.unauthorized("No refresh token provided in cookie.");
    }

    const { user, accessToken, newRawToken, expiresAt } = await rotateRefreshToken(rawToken, req);

    setRefreshTokenCookie(res, newRawToken, expiresAt);

    return res.status(200).json({
      success: true,
      data: {
        user: user.toJSON(),
        accessToken,
      },
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
    next(error);
  }
});

// POST /api/v1/auth/logout
router.post("/logout", async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (rawToken) {
      await revokeSessionByRawToken(rawToken);
    }
    clearRefreshTokenCookie(res);

    return res.status(200).json({
      success: true,
      data: { message: "Logged out successfully." },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/logout-all
router.post("/logout-all", requireAuth, async (req, res, next) => {
  try {
    await revokeAllSessionsForUser(req.userId);
    clearRefreshTokenCookie(res);

    return res.status(200).json({
      success: true,
      data: { message: "All sessions have been revoked." },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/auth/me
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: req.user.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/forgot-password
router.post("/forgot-password", authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw ApiError.badRequest("Email is required.");
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      const resetToken = generateRandomToken(32);
      const tokenHash = hashToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await VerificationToken.create({
        userId: user._id,
        tokenHash,
        purpose: "password_reset",
        expiresAt,
      });

      console.log(`[Auth] Password reset token for ${user.email}: ${resetToken}`);
    }

    // Generic response to prevent email enumeration
    return res.status(200).json({
      success: true,
      data: {
        message:
          "If an account with that email exists, password reset instructions have been issued.",
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/reset-password
router.post("/reset-password", authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      throw ApiError.badRequest("Valid token and new password (min 6 chars) are required.");
    }

    const tokenHash = hashToken(token);
    const record = await VerificationToken.findOne({
      tokenHash,
      purpose: "password_reset",
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      throw ApiError.badRequest("Invalid or expired password reset token.");
    }

    const user = await User.findById(record.userId);
    if (!user) {
      throw ApiError.notFound("User not found.");
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    record.consumedAt = new Date();
    await record.save();

    // Invalidate all active sessions for security
    await revokeAllSessionsForUser(user._id);
    clearRefreshTokenCookie(res);

    return res.status(200).json({
      success: true,
      data: {
        message: "Password reset successfully. Please sign in with your new password.",
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/verify-email
router.post("/verify-email", async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) throw ApiError.badRequest("Verification token is required.");

    const tokenHash = hashToken(token);
    const record = await VerificationToken.findOne({
      tokenHash,
      purpose: "email_verification",
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      throw ApiError.badRequest("Invalid or expired verification token.");
    }

    await User.findByIdAndUpdate(record.userId, { emailVerified: true });
    record.consumedAt = new Date();
    await record.save();

    return res.status(200).json({
      success: true,
      data: { message: "Email verified successfully." },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/resend-verification
router.post("/resend-verification", authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw ApiError.badRequest("Email is required.");

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user && !user.emailVerified) {
      const verifyToken = generateRandomToken(32);
      const tokenHash = hashToken(verifyToken);
      await VerificationToken.create({
        userId: user._id,
        tokenHash,
        purpose: "email_verification",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      console.log(`[Auth] Verification token for ${user.email}: ${verifyToken}`);
    }

    return res.status(200).json({
      success: true,
      data: { message: "If your email is unverified, a verification link has been sent." },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/auth/google
router.get("/google", (req, res) => {
  // Configurable Google OAuth redirect
  return res.status(501).json({
    success: false,
    error: {
      code: "NOT_CONFIGURED",
      message:
        "Google OAuth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
    },
  });
});

export default router;
