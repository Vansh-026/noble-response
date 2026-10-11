import mongoose from "mongoose";
import { config } from "./config.js";

let isConnected = false;

export async function connectDB() {
  if (isConnected) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });
    isConnected = true;
    console.log(
      `[Database] MongoDB connected successfully to ${conn.connection.host}/${conn.connection.name}`,
    );
    return conn.connection;
  } catch (error) {
    console.error(`[Database] MongoDB connection error:`, error.message);
    throw error;
  }
}

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.warn("[Database] MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("[Database] MongoDB error:", err);
});
