import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import { createFinancialInformation } from "../controllers/FinancialInformation/index.js";

router.post(
  "/create-financial-information",
  roleBasedMiddleware("School"),
  createFinancialInformation
);

export default router;
