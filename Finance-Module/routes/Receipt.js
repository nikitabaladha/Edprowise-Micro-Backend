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
  "/get-all-receipt/:academicYear",
  roleBasedMiddleware("School"),
  getAllReceiptBySchoolId
);

router.put(
  "/update-receipt/:id/:academicYear",
  upload,
  roleBasedMiddleware("School"),
  updateReceiptById
);

router.put(
  "/update-approval-status-for-receipt/:id/:academicYear",
  roleBasedMiddleware("School"),
  updateApprovalStatusById
);

router.put(
  "/update-draft-receipt/:id/:academicYear",
  upload,
  roleBasedMiddleware("School"),
  updateDraftReceiptById
);

router.put(
  "/cancel-receipt/:id/:academicYear",
  roleBasedMiddleware("School"),
  cancelReceiptById
);

router.get(
  "/get-receipt-with-ledger-by-tds-tcs/:id/:academicYear",
  roleBasedMiddleware("School"),
  getAllLedgerByNameWithTDSorTCS
);

export default router;
