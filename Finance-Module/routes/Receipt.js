import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import upload from "../UploadFiles/InvoiceImageFiles.js";

import {
  createReceipt,
  getAllReceiptBySchoolId,
  cancelReceiptById,
} from "../controllers/AccountEntry/Receipt/index.js";

router.post(
  "/create-receipt-entry",
  upload,
  roleBasedMiddleware("School"),
  createReceipt
);

router.get(
  "/get-all-receipt/:academicYear",
  upload,
  roleBasedMiddleware("School"),
  getAllReceiptBySchoolId
);

router.put(
  "/cancel-receipt/:id/:academicYear",
  upload,
  roleBasedMiddleware("School"),
  cancelReceiptById
);

export default router;
