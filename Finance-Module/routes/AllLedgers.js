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
  "/get-all-entry/:financialYear",
  roleBasedMiddleware("School"),
  getAllBySchoolId
);

router.get(
  "/get-all-disapproved-entry/:financialYear",
  roleBasedMiddleware("School"),
  getAllDisapprovedEntriesBySchoolId
);

router.get(
  "/get-all-month-with-debit-credit/:financialYear",
  roleBasedMiddleware("School"),
  getAllMonthWithdebitCredit
);

router.get(
  "/get-all-date-month-data-with-debit-credit",
  roleBasedMiddleware("School"),
  getAllDateMonthDataWithDebitCredit
);

router.get(
  "/get-only-payment-entry/:financialYear",
  roleBasedMiddleware("School"),
  getAllPaymentEntryBySchoolId
);

router.get(
  "/get-only-receipt/:financialYear",
  roleBasedMiddleware("School"),
  getAllReceiptBySchoolId
);

router.get(
  "/get-only-contra/:financialYear",
  roleBasedMiddleware("School"),
  getAllContraBySchoolId
);

router.get(
  "/get-only-journal/:financialYear",
  roleBasedMiddleware("School"),
  getAllJournalBySchoolId
);

export default router;
