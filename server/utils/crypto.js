import crypto from "crypto";
import bcrypt from "bcryptjs";

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

export function hashIp(ip) {
  if (!ip) return null;
  return crypto
    .createHash("sha256")
    .update(ip + "salt-intellichat")
    .digest("hex");
}
