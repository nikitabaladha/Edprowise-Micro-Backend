import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import {
  getIncomeAndExpenditureAccount,
  getScheduleToIncome,
  getScheduleToExpenditure,
  getBalanceSheetForAssetsLiabilities,
  getScheduleToLiabilities,
  getScheduleToAssets,
  getFixedAssetsSchedule,
  getTotalNetdeficitNetSurplus,
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

router.get(
  "/get-financial-statement-schedule-to-liabilities",
  roleBasedMiddleware("School"),
  getScheduleToLiabilities
);

router.get(
  "/get-financial-statement-schedule-to-assets",
  roleBasedMiddleware("School"),
  getScheduleToAssets
);

router.get(
  "/get-financial-statement-fixed-assets-schedule",
  roleBasedMiddleware("School"),
  getFixedAssetsSchedule
);

router.get(
  "/get-total-netdeficit-netsurplus",
  roleBasedMiddleware("School"),
  getTotalNetdeficitNetSurplus
);

export default router;
