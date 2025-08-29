import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import { getAllOpeningClosingBalanceBySchoolId } from "../controllers/OpeningClosingBalance/index.js";

router.get(
  "/get-all-opening-closing-balance",
  roleBasedMiddleware("School"),
  getAllOpeningClosingBalanceBySchoolId
);

export default router;
