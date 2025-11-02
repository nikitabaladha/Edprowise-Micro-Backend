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
  "/get-all-cash-book-entry/:financialYear",
  roleBasedMiddleware("School"),
  getAllCashBookBySchoolId
);

router.get(
  "/get-all-bank-book-entry/:financialYear",
  roleBasedMiddleware("School"),
  getAllBankBookBySchoolId
);

router.get(
  "/get-all-income-book-entry/:financialYear",
  roleBasedMiddleware("School"),
  getAllIncomeBookBySchoolId
);

router.get(
  "/get-all-expenses-book-entry/:financialYear",
  roleBasedMiddleware("School"),
  getAllExpensesBookBySchoolId
);

router.get(
  "/get-all-journal-without-bank-cash-entry/:financialYear",
  roleBasedMiddleware("School"),
  getAllJournalWIthoutBankCashBySchoolId
);

router.get(
  "/get-all-payment-with-TDS",
  roleBasedMiddleware("School"),
  getAllPaymentWhichHasTDSBySchoolId
);

export default router;
