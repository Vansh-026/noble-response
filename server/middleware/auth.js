import { verifyAccessToken } from "../services/token.service.js";
import { User } from "../models/User.js";
import { ApiError } from "./errorHandler.js";

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Authentication required. Missing Bearer token.");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw ApiError.unauthorized("Authentication required. Missing token.");
    }

    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.sub);
    if (!user || user.status === "disabled") {
      throw ApiError.unauthorized("User account not found or disabled.");
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token) {
        const payload = verifyAccessToken(token);
        const user = await User.findById(payload.sub);
        if (user && user.status === "active") {
          req.user = user;
          req.userId = user._id;
        }
      }
    }
  } catch {
    // Optional auth silently ignores failures
  }
  next();
}
