import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import {
  getIncomeAndExpenditureAccount,
  getScheduleToIncome,
  getScheduleToExpenditure,
  getBalanceSheetForAssetsLiabilities,
} from "../controllers/FinancialStatement/index.js";

router.get(
  "/get-financial-statement-for-income-expenses",
  roleBasedMiddleware("School"),
  getIncomeAndExpenditureAccount
);

router.get(
  "/get-financial-statement-schedule-to-income",
  roleBasedMiddleware("School"),
  getScheduleToIncome
);

router.get(
  "/get-financial-statement-schedule-to-expenses",
  roleBasedMiddleware("School"),
  getScheduleToExpenditure
);

router.get(
  "/get-financial-statement-balance-sheet-assets-liabilities",
  roleBasedMiddleware("School"),
  getBalanceSheetForAssetsLiabilities
);
export default router;
