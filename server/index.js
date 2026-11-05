import { app } from "./app.js";
import { connectDB } from "./db.js";
import { config } from "./config.js";

async function startServer() {
  const server = app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
  });

  try {
    await connectDB();
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
  }

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer();
