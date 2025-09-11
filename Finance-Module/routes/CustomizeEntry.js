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
  getAllCustomizeEntriesBySchoolId,
  updateByIdForPayment,
  updateByIdForReceipt,
  updateByIdForContra,
  updateByIdForJournal,
  draftForPayment,
  draftForReceipt,
  draftForContra,
  draftForJournal,
  updateDraftPayment,
  updateDraftForReceipt,
  updateDraftForContra,
  updateDraftForJournal,
} from "../controllers/AccountEntry/CustomizeEntry/index.js";

router.post(
  "/customize-entry-for-payment",
  uploadForPayment,
  roleBasedMiddleware("School"),
  createForPayment
);

router.post(
  "/draft-customize-entry-for-payment",
  uploadForPayment,
  roleBasedMiddleware("School"),
  draftForPayment
);

router.post(
  "/customize-entry-for-receipt",
  uploadForReceipt,
  roleBasedMiddleware("School"),
  createForReceipt
);

router.post(
  "/draft-customize-entry-for-receipt",
  uploadForReceipt,
  roleBasedMiddleware("School"),
  draftForReceipt
);

router.post(
  "/customize-entry-for-contra",
  uploadForContra,
  roleBasedMiddleware("School"),
  createForContra
);

router.post(
  "/draft-customize-entry-for-contra",
  uploadForContra,
  roleBasedMiddleware("School"),
  draftForContra
);

router.post(
  "/customize-entry-for-journal",
  uploadForJournal,
  roleBasedMiddleware("School"),
  createForJournal
);

router.post(
  "/draft-customize-entry-for-journal",
  uploadForJournal,
  roleBasedMiddleware("School"),
  draftForJournal
);

router.get(
  "/get-all-customize-entry/:academicYear",
  roleBasedMiddleware("School"),
  getAllCustomizeEntriesBySchoolId
);

router.put(
  "/update-customize-entry-for-payment/:id/:academicYear",
  uploadForPayment,
  roleBasedMiddleware("School"),
  updateByIdForPayment
);

router.put(
  "/draft-update-customize-entry-for-payment/:id/:academicYear",
  uploadForPayment,
  roleBasedMiddleware("School"),
  updateDraftPayment
);

router.put(
  "/update-customize-entry-for-receipt/:id/:academicYear",
  uploadForReceipt,
  roleBasedMiddleware("School"),
  updateByIdForReceipt
);

router.put(
  "/draft-update-customize-entry-for-receipt/:id/:academicYear",
  uploadForReceipt,
  roleBasedMiddleware("School"),
  updateDraftForReceipt
);

router.put(
  "/update-customize-entry-for-contra/:id/:academicYear",
  uploadForContra,
  roleBasedMiddleware("School"),
  updateByIdForContra
);

router.put(
  "/draft-update-customize-entry-for-contra/:id/:academicYear",
  uploadForContra,
  roleBasedMiddleware("School"),
  updateDraftForContra
);

router.put(
  "/update-customize-entry-for-journal/:id/:academicYear",
  uploadForJournal,
  roleBasedMiddleware("School"),
  updateByIdForJournal
);

router.put(
  "/draft-update-customize-entry-for-journal/:id/:academicYear",
  uploadForJournal,
  roleBasedMiddleware("School"),
  updateDraftForJournal
);

export default router;
