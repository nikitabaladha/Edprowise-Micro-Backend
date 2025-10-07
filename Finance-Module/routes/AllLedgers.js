import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import {
  getAllBySchoolId,
  getAllPaymentEntryBySchoolId,
  getAllReceiptBySchoolId,
  getAllContraBySchoolId,
  getAllJournalBySchoolId,
  getAllMonthWithdebitCredit,
  getAllDateMonthDataWithDebitCredit,
  getAllDisapprovedEntriesBySchoolId,
} from "../controllers/AccountEntry/AllLedgers/index.js";

router.get(
  "/get-all-entry/:academicYear",
  roleBasedMiddleware("School"),
  getAllBySchoolId
);

router.get(
  "/get-all-disapproved-entry/:academicYear",
  roleBasedMiddleware("School"),
  getAllDisapprovedEntriesBySchoolId
);

router.get(
  "/get-all-month-with-debit-credit/:academicYear",
  roleBasedMiddleware("School"),
  getAllMonthWithdebitCredit
);

router.get(
  "/get-all-date-month-data-with-debit-credit",
  roleBasedMiddleware("School"),
  getAllDateMonthDataWithDebitCredit
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

router.get(
  "/get-only-contra/:academicYear",
  roleBasedMiddleware("School"),
  getAllContraBySchoolId
);

router.get(
  "/get-only-journal/:academicYear",
  roleBasedMiddleware("School"),
  getAllJournalBySchoolId
);

export default router;
