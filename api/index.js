import { app } from "../server/app.js";
import { connectDB } from "../server/db.js";

// Ensure DB connection is established for serverless invocation
export default async function handler(req, res) {
  await connectDB();
  return app(req, res);
}
