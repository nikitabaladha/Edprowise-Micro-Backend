import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import upload from "../UploadFiles/InvoiceImageFiles.js";

import {
  createPaymentEntry,
  getAllPaymentEntryBySchoolId,
  cancelPaymentEntryById,
  updatePaymentEntryById,
  dreaftPaymentEntry,
  updateDraftPaymentEntryById,
  getAllLedgerByNameWithTDSorTCS,
  updateApprovalStatusById,
  deletePaymentEntryById,
} from "../controllers/AccountEntry/PaymentEntry/index.js";

router.post(
  "/create-payment-entry",
  upload,
  roleBasedMiddleware("School"),
  createPaymentEntry
);

router.post(
  "/draft-payment-entry",
  upload,
  roleBasedMiddleware("School"),
  dreaftPaymentEntry
);

router.get(
  "/get-all-payment-entry/:financialYear",
  roleBasedMiddleware("School"),
  getAllPaymentEntryBySchoolId
);

router.put(
  "/update-payment-entry/:id/:financialYear",
  upload,
  roleBasedMiddleware("School"),
  updatePaymentEntryById
);

router.put(
  "/update-approval-status-for-payment/:id/:financialYear",
  roleBasedMiddleware("School"),
  updateApprovalStatusById
);

router.put(
  "/update-draft-payment-entry/:id/:financialYear",
  upload,
  roleBasedMiddleware("School"),
  updateDraftPaymentEntryById
);

router.put(
  "/cancel-payment-entry/:id/:financialYear",
  roleBasedMiddleware("School"),
  cancelPaymentEntryById
);

router.get(
  "/get-payment-entry-with-ledger-by-tds-tcs/:id/:financialYear",
  roleBasedMiddleware("School"),
  getAllLedgerByNameWithTDSorTCS
);

router.delete(
  "/delete-payment-entry/:id/:financialYear",
  roleBasedMiddleware("School"),
  deletePaymentEntryById
);

export default router;
