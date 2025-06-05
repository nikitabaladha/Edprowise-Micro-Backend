// Edprowise-Micro-Backend\api-geteway\app.js
import morgan from "morgan";
import express from "express";
import proxy from "express-http-proxy";
import configureServer from "../shared/config/server-config.js";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();

app.use(morgan("combined"));

// Apply common server configuration
configureServer(app);

const SERVICE_TARGETS = {
  user: process.env.USER_SERVICE_URL,
  email: process.env.EMAIL_SERVICE_URL,
  procurement: process.env.PROCUREMENT_SERVICE_URL,
  enquiry: process.env.ENQUIRY_SERVICE_URL,
};

// Route specific API prefixes
app.use(
  "/api/user",
  proxy(SERVICE_TARGETS.user, {
    proxyReqPathResolver: (req) => req.originalUrl.replace("/api/user", "/api"),
  })
);

app.use(
  "/api/email",
  proxy(SERVICE_TARGETS.email, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/email", "/api"),
  })
);

app.use(
  "/api/procurement",
  proxy(SERVICE_TARGETS.procurement, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/procurement", "/api"),
  })
);

app.use(
  "/api/enquiry",
  proxy(SERVICE_TARGETS.enquiry, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/enquiry", "/api"),
  })
);

app.use(
  "/user-and-profile-service",
  proxy(SERVICE_TARGETS.user, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/user-and-profile-service", ""),
  })
);

app.use(
  "/email-service",
  proxy(SERVICE_TARGETS.email, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/email-service", ""),
  })
);

app.use(
  "/procurement-service",
  proxy(SERVICE_TARGETS.procurement, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/procurement-service", ""),
  })
);

app.use(
  "/enquiry-service",
  proxy(SERVICE_TARGETS.enquiry, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/enquiry-service", ""),
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});

// Start server
const PORT = process.env.GATEWAY_PORT || 3001;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
