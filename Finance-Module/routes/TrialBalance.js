import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import { getAllTrialBalanceBySchoolId } from "../controllers/TrialBalance/index.js";

// router.get(
//   "/get-all-trial-balance/:academicYear",
//   roleBasedMiddleware("School"),
//   getAllTrialBalanceBySchoolId
// );

router.get(
  "/get-all-trial-balance",
  roleBasedMiddleware("School"),
  getAllTrialBalanceBySchoolId
);

export default router;
