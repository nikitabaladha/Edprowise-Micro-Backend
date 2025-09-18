import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import {
  getAllCashBookBySchoolId,
  getAllBankBookBySchoolId,
  getAllIncomeBookBySchoolId,
  getAllExpensesBookBySchoolId,
  getAllJournalWIthoutBankCashBySchoolId,
  getAllPaymentWhichHasTDSBySchoolId,
} from "../controllers/Reports/index.js";

router.get(
  "/get-all-cash-book-entry/:academicYear",
  roleBasedMiddleware("School"),
  getAllCashBookBySchoolId
);

router.get(
  "/get-all-bank-book-entry/:academicYear",
  roleBasedMiddleware("School"),
  getAllBankBookBySchoolId
);

router.get(
  "/get-all-income-book-entry/:academicYear",
  roleBasedMiddleware("School"),
  getAllIncomeBookBySchoolId
);

router.get(
  "/get-all-expenses-book-entry/:academicYear",
  roleBasedMiddleware("School"),
  getAllExpensesBookBySchoolId
);

router.get(
  "/get-all-journal-without-bank-cash-entry/:academicYear",
  roleBasedMiddleware("School"),
  getAllJournalWIthoutBankCashBySchoolId
);

router.get(
  "/get-all-payment-with-TDS",
  roleBasedMiddleware("School"),
  getAllPaymentWhichHasTDSBySchoolId
);

export default router;
