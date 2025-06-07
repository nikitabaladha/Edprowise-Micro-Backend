import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import {
  rejectCommentFromBuyer,
  updateVenderStatus,
} from "../controllers/QuoteAcceptanceStatus/index.js";

router.put(
  "/reject-comment-from-buyer",
  roleBasedMiddleware("School"),
  rejectCommentFromBuyer
);

router.put(
  "/update-vender-status",
  roleBasedMiddleware("Admin"),
  updateVenderStatus
);

export default router;
