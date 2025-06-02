// Edprowise-Micro-Backend\User-And-Profile-Service\app.js

import dotenv from "dotenv";
import path from "path";
import express from "express";
import connectDB from "./config/db.js";
import routes from "./routes/index.js";
import configureServer from "../shared/config/server-config.js";

dotenv.config();

const app = express();

configureServer(app);

connectDB();

// Static paths
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
const PORT = process.env.EMAIL_SERVICE_PORT;

app.listen(PORT, () => {
  console.log(`${process.env.SERVICE_NAME} running on port ${PORT}`);
});
