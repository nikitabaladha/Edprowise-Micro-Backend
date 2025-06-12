//Edprowise-Micro-Backend\Notification-Service\app.js

import dotenv from "dotenv";
import path from "path";
import express from "express";
import connectDB from "./config/db.js";
import routes from "./routes/index.js";
import configureServer from "../shared/config/server-config.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { setIO } from "./socket.js";

dotenv.config();

const app = express();
const server = createServer(app);

configureServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/notification-service",
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  const { userId, userType } = socket.handshake.query;

  if (userId && userType) {
    const room = `${userType}-${userId}`;
    socket.join(room);
    console.log(`User ${userId} joined room ${room}`);
  }

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

setIO(io);

// Database connection
connectDB();

app.use("/Images", express.static(path.resolve("Images")));
app.use("/Documents", express.static(path.resolve("Documents")));

// Routes
routes(app);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    service: process.env.SERVICE_NAME,
  });
});

// Start server
const PORT = process.env.NOTIFICATION_SERVICE_PORT;

app.listen(PORT, () => {
  console.log(`${process.env.SERVICE_NAME} running on port ${PORT}`);
});
