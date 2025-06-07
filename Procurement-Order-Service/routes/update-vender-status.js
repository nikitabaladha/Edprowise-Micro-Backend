import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import { updateOrderStatus } from "../controllers/UpdateVenderStatus/index.js";

router.put(
  "/update-order-status",
  roleBasedMiddleware("Admin"),
  updateOrderStatus
);

export default router;
