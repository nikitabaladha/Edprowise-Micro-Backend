import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import {
  getAllBySchoolId,
  getAllPaymentEntryBySchoolId,
  getAllReceiptBySchoolId,
} from "../controllers/AccountEntry/AllLedgers/index.js";

router.get(
  "/get-all-entry/:academicYear",
  roleBasedMiddleware("School"),
  getAllBySchoolId
);

router.get(
  "/get-only-payment-entry/:academicYear",
  roleBasedMiddleware("School"),
  getAllPaymentEntryBySchoolId
);

router.get(
  "/get-only-receipt/:academicYear",
  roleBasedMiddleware("School"),
  getAllReceiptBySchoolId
);

export default router;
