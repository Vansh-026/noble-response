import { app } from "./app.js";
import { connectDB } from "./db.js";
import { config } from "./config.js";

async function startServer() {
  try {
    await connectDB();

    const server = app.listen(config.PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 IntelliChat API Server running on port ${config.PORT}`);
      console.log(`📡 Base URL: http://localhost:${config.PORT}/api/v1`);
      console.log(`🩺 Health check: http://localhost:${config.PORT}/api/v1/health`);
      console.log(`===============================================`);
    });

    const shutdown = async () => {
      console.log("Shutting down server gracefully...");
      server.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start IntelliChat server:", error);
    process.exit(1);
  }
}

startServer();
