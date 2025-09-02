import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";
import uploadForPayment from "../UploadFiles/CutomizeEntryForPayment.js";
import uploadForReceipt from "../UploadFiles/CutomizeEntryForReceipt.js";
import uploadForContra from "../UploadFiles/ContraImageFiles.js";
import uploadForJournal from "../UploadFiles/JournalImageFiles.js";

import {
  createForPayment,
  createForReceipt,
  createForContra,
  createForJournal,
} from "../controllers/AccountEntry/CustomizeEntry/index.js";

router.post(
  "/customize-entry-for-payment",
  uploadForPayment,
  roleBasedMiddleware("School"),
  createForPayment
);

router.post(
  "/customize-entry-for-receipt",
  uploadForReceipt,
  roleBasedMiddleware("School"),
  createForReceipt
);

router.post(
  "/customize-entry-for-contra",
  uploadForContra,
  roleBasedMiddleware("School"),
  createForContra
);

router.post(
  "/customize-entry-for-journal",
  uploadForJournal,
  roleBasedMiddleware("School"),
  createForJournal
);

export default router;
