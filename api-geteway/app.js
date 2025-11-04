// Edprowise-Micro-Backend\api-geteway\app.js
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

const SERVICE_TARGETS = {
  user: process.env.USER_SERVICE_URL,
  email: process.env.EMAIL_SERVICE_URL,
  enquiry: process.env.ENQUIRY_SERVICE_URL,
  subscription: process.env.SUBSCRIPTION_SERVICE_URL,

  procurementCategory: process.env.PROCUREMENT_CATEGORY_SERVICE_URL,
  procurementQuoteRequest: process.env.PROCUREMENT_QUOTE_REQUEST_SERVICE_URL,
  procurementQuoteProposal: process.env.PROCUREMENT_QUOTE_PROPOSAL_SERVICE_URL,
  procurementCart: process.env.PROCUREMENT_CART_SERVICE_URL,
  procurementOrder: process.env.PROCUREMENT_ORDER_SERVICE_URL,

  notification: process.env.NOTIFICATION_SERVICE_URL,

  bankdetailsAndPaymentService: process.env.BANKDETAILS_AND_PAYMENT_SERVICE_URL,

  financeModule: process.env.FINANCE_MODULE_URL,
  feesModule: process.env.FEES_MODULE_URL,
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
  "/api/enquiry",
  proxy(SERVICE_TARGETS.enquiry, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/enquiry", "/api"),
  })
);

app.use(
  "/api/subscription",
  proxy(SERVICE_TARGETS.subscription, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/subscription", "/api"),
  })
);

app.use(
  "/api/procurementCategory",
  proxy(SERVICE_TARGETS.procurementCategory, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/procurementCategory", "/api"),
  })
);

app.use(
  "/api/procurementQuoteRequest",
  proxy(SERVICE_TARGETS.procurementQuoteRequest, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/procurementQuoteRequest", "/api"),
  })
);

app.use(
  "/api/procurementQuoteProposal",
  proxy(SERVICE_TARGETS.procurementQuoteProposal, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/procurementQuoteProposal", "/api"),
  })
);

app.use(
  "/api/procurementCart",
  proxy(SERVICE_TARGETS.procurementCart, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/procurementCart", "/api"),
  })
);

app.use(
  "/api/procurementOrder",
  proxy(SERVICE_TARGETS.procurementOrder, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/procurementOrder", "/api"),
  })
);

app.use(
  "/api/notification",
  proxy(SERVICE_TARGETS.notification, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/notification", "/api"),
  })
);

app.use(
  "/api/bankdetailsAndPaymentService",
  proxy(SERVICE_TARGETS.bankdetailsAndPaymentService, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/bankdetailsAndPaymentService", "/api"),
  })
);

app.use(
  "/api/financeModule",
  proxy(SERVICE_TARGETS.financeModule, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/financeModule", "/api"),
  })
);

app.use(
  "/api/feesModule",
  proxy(SERVICE_TARGETS.feesModule, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/api/feesModule", "/api"),
  })
);

// ======================================

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
  "/enquiry-service",
  proxy(SERVICE_TARGETS.enquiry, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/enquiry-service", ""),
  })
);

app.use(
  "/subscription-service",
  proxy(SERVICE_TARGETS.subscription, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/subscription-service", ""),
  })
);

app.use(
  "/procurementCategory-service",
  proxy(SERVICE_TARGETS.procurementCategory, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/procurementCategory-service", ""),
  })
);

app.use(
  "/procurementQuoteRequest-service",
  proxy(SERVICE_TARGETS.procurementQuoteRequest, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/procurementQuoteRequest-service", ""),
  })
);

app.use(
  "/procurementQuoteProposal-service",
  proxy(SERVICE_TARGETS.procurementQuoteProposal, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/procurementQuoteProposal-service", ""),
  })
);

app.use(
  "/procurementCart-service",
  proxy(SERVICE_TARGETS.procurementCart, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/procurementCart-service", ""),
  })
);

app.use(
  "/procurementOrder-service",
  proxy(SERVICE_TARGETS.procurementOrder, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/procurementOrder-service", ""),
  })
);

app.use(
  "/notification-service",
  proxy(SERVICE_TARGETS.notification, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/notification-service", ""),
  })
);

app.use(
  "/bankdetailsAndPayment-service",
  proxy(SERVICE_TARGETS.bankdetailsAndPaymentService, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/bankdetailsAndPayment-service", ""),
  })
);

app.use(
  "/financeModule",
  proxy(SERVICE_TARGETS.financeModule, {
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace("/financeModule", ""),
  })
);

app.use(
  "/feesModule",
  proxy(SERVICE_TARGETS.feesModule, {
    proxyReqPathResolver: (req) => req.originalUrl.replace("/feesModule", ""),
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});

// Start server
const PORT = process.env.GATEWAY_PORT || 3001;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
