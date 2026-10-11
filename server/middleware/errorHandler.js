export class ApiError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = Array.isArray(details) ? details : [details];
  }

  static badRequest(message = "Bad Request", details = []) {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }

  static unauthorized(message = "Authentication required", details = []) {
    return new ApiError(401, "UNAUTHORIZED", message, details);
  }

  static forbidden(message = "Access denied", details = []) {
    return new ApiError(403, "FORBIDDEN", message, details);
  }

  static notFound(message = "Resource not found", details = []) {
    return new ApiError(404, "NOT_FOUND", message, details);
  }

  static conflict(message = "Resource already exists", details = []) {
    return new ApiError(409, "CONFLICT", message, details);
  }

  static payloadTooLarge(message = "Payload too large", details = []) {
    return new ApiError(413, "PAYLOAD_TOO_LARGE", message, details);
  }

  static unsupportedMediaType(message = "Unsupported media type", details = []) {
    return new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", message, details);
  }

  static unprocessableEntity(message = "Validation error", details = []) {
    return new ApiError(422, "VALIDATION_ERROR", message, details);
  }

  static tooManyRequests(message = "Too many requests. Please try again later.", details = []) {
    return new ApiError(429, "RATE_LIMIT_EXCEEDED", message, details);
  }

  static internal(message = "Internal server error", details = []) {
    return new ApiError(500, "INTERNAL_ERROR", message, details);
  }
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let code = err.code || "INTERNAL_ERROR";
  let message = err.message || "An unexpected error occurred.";
  let details = err.details || [];

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 422;
    code = "VALIDATION_ERROR";
    message = "Validation failed.";
    details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_KEY";
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    message = `A record with that ${field} already exists.`;
    details = [{ field, message: `${field} is already in use.` }];
  }

  // CastError (invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 400;
    code = "INVALID_ID";
    message = `Invalid ID format for ${err.path}.`;
    details = [];
  }

  // Multer error
  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Uploaded file exceeds the maximum allowed size (10MB).";
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    code = "INVALID_TOKEN";
    message = "Invalid access token.";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    code = "TOKEN_EXPIRED";
    message = "Access token has expired.";
  }

  // Do not leak stack traces or internal secrets in production
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
}
