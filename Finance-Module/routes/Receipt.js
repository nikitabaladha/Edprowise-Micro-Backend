import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import upload from "../UploadFiles/ReceiptImageFiles.js";

import {
  createReceipt,
  getAllReceiptBySchoolId,
  cancelReceiptById,
  updateReceiptById,
  updateApprovalStatusById,
  dreaftReceipt,
  updateDraftReceiptById,
  getAllLedgerByNameWithTDSorTCS,
  deleteReceiptEntryById,
} from "../controllers/AccountEntry/Receipt/index.js";

router.post(
  "/create-receipt",
  upload,
  roleBasedMiddleware("School"),
  createReceipt
);

router.post(
  "/draft-receipt",
  upload,
  roleBasedMiddleware("School"),
  dreaftReceipt
);

router.get(
  "/get-all-receipt/:financialYear",
  roleBasedMiddleware("School"),
  getAllReceiptBySchoolId
);

router.put(
  "/update-receipt/:id/:financialYear",
  upload,
  roleBasedMiddleware("School"),
  updateReceiptById
);

router.put(
  "/update-approval-status-for-receipt/:id/:financialYear",
  roleBasedMiddleware("School"),
  updateApprovalStatusById
);

router.put(
  "/update-draft-receipt/:id/:financialYear",
  upload,
  roleBasedMiddleware("School"),
  updateDraftReceiptById
);

router.put(
  "/cancel-receipt/:id/:financialYear",
  roleBasedMiddleware("School"),
  cancelReceiptById
);

router.get(
  "/get-receipt-with-ledger-by-tds-tcs/:id/:financialYear",
  roleBasedMiddleware("School"),
  getAllLedgerByNameWithTDSorTCS
);

router.delete(
  "/delete-receipt-entry/:id/:financialYear",
  roleBasedMiddleware("School"),
  deleteReceiptEntryById
);

export default router;
