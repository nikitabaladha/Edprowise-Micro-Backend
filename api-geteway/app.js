// Microservice-Learning-Backend/api-geteway/app.js

import morgan from "morgan";
import express from "express";
import proxy from "express-http-proxy";
import configureServer from "../shared/config/server-config.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(morgan("combined"));

// Apply common server configuration
configureServer(app);

const userServiceTarget = process.env.USER_SERVICE_URL; // Use correct backend URL

// Proxy all /user-and-profile-service/* requests
app.use(
  "/user-and-profile-service",
  proxy(userServiceTarget, {
    proxyReqPathResolver: (req) => {
      const proxiedPath = req.originalUrl.replace(
        /^\/user-and-profile-service/,
        ""
      );
      return proxiedPath;
    },
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});

// Start server
const PORT = process.env.GATEWAY_PORT || 3000;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
