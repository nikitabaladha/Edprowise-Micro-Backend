// Edprowise-Micro-Backend\Email-Service\app.js
import dotenv from "dotenv";
import express from "express";
import connectDB from "./config/db.js";
import routes from "./routes/index.js";
import configureServer from "../shared/config/server-config.js";

dotenv.config();

const app = express();

configureServer(app);

connectDB();

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
const PORT = process.env.BANKDETAILS_AND_PAYMENT_SERVICE_PORT;

app.listen(PORT, () => {
  console.log(`${process.env.SERVICE_NAME} running on port ${PORT}`);
});
