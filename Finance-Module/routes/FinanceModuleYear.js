import express from "express";

import roleBasedMiddleware from "../middleware/index.js";

import {
  createFinanceModuleYear,
  getFinanceModuleYearsBySchoolId,
} from "../controllers/FinanceModuleYear/index.js";

const router = express.Router();

router.post(
  "/create-finance-module-year",
  roleBasedMiddleware("School"),
  createFinanceModuleYear
);

router.get(
  "/get-finance-module-year",
  roleBasedMiddleware("School"),
  getFinanceModuleYearsBySchoolId
);
export default router;
