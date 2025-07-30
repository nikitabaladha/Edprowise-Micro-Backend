import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import { createFinancialInformation } from "../controllers/FinancialInformation/index.js";

router.post(
  "/create-financial-information",
  roleBasedMiddleware("School"),
  createFinancialInformation
);

// router.get(
//   "/get-all-rate-chart/:academicYear",
//   roleBasedMiddleware("School"),
//   getAllTDSTCSRateChartBySchoolId
// );

// router.get(
//   "/get-all-rate-chart-by-tds-or-tcs/:TDSorTCS/:academicYear",
//   roleBasedMiddleware("School"),
//   getAllByTDSOrTCS
// );

// router.put(
//   "/update-rate-chart-by-id/:id/:academicYear",
//   roleBasedMiddleware("School"),
//   updateTDSTCSRateChartById
// );

// router.delete(
//   "/delete-rate-chart-by-id/:id/:academicYear",
//   roleBasedMiddleware("School"),
//   deleteTDSTCSRateChartById
// );

export default router;
