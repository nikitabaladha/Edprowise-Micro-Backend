import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import upload from "../UploadFiles/InvoiceImageFiles.js";

import {
  createPaymentEntry,
  getAllPaymentEntryBySchoolId,
} from "../controllers/AccountEntry/PaymentEntry/index.js";

router.post(
  "/create-payment-entry",
  upload,
  roleBasedMiddleware("School"),
  createPaymentEntry
);

router.get(
  "/get-all-payment-entry",
  upload,
  roleBasedMiddleware("School"),
  getAllPaymentEntryBySchoolId
);

export default router;
