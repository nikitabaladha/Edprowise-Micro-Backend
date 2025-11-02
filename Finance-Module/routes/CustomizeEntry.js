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
  copyForPayment,
  copyForReceipt,
  copyForContra,
  copyForJournal,
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
  "/copy-customize-entry-for-payment",
  uploadForPayment,
  roleBasedMiddleware("School"),
  copyForPayment
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
  "/copy-customize-entry-for-receipt",
  uploadForReceipt,
  roleBasedMiddleware("School"),
  copyForReceipt
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
  "/copy-customize-entry-for-contra",
  uploadForContra,
  roleBasedMiddleware("School"),
  copyForContra
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

router.post(
  "/copy-customize-entry-for-journal",
  uploadForJournal,
  roleBasedMiddleware("School"),
  copyForJournal
);

router.get(
  "/get-all-customize-entry/:financialYear",
  roleBasedMiddleware("School"),
  getAllCustomizeEntriesBySchoolId
);

router.put(
  "/update-customize-entry-for-payment/:id/:financialYear",
  uploadForPayment,
  roleBasedMiddleware("School"),
  updateByIdForPayment
);

router.put(
  "/draft-update-customize-entry-for-payment/:id/:financialYear",
  uploadForPayment,
  roleBasedMiddleware("School"),
  updateDraftPayment
);

router.put(
  "/update-customize-entry-for-receipt/:id/:financialYear",
  uploadForReceipt,
  roleBasedMiddleware("School"),
  updateByIdForReceipt
);

router.put(
  "/draft-update-customize-entry-for-receipt/:id/:financialYear",
  uploadForReceipt,
  roleBasedMiddleware("School"),
  updateDraftForReceipt
);

router.put(
  "/update-customize-entry-for-contra/:id/:financialYear",
  uploadForContra,
  roleBasedMiddleware("School"),
  updateByIdForContra
);

router.put(
  "/draft-update-customize-entry-for-contra/:id/:financialYear",
  uploadForContra,
  roleBasedMiddleware("School"),
  updateDraftForContra
);

router.put(
  "/update-customize-entry-for-journal/:id/:financialYear",
  uploadForJournal,
  roleBasedMiddleware("School"),
  updateByIdForJournal
);

router.put(
  "/draft-update-customize-entry-for-journal/:id/:financialYear",
  uploadForJournal,
  roleBasedMiddleware("School"),
  updateDraftForJournal
);

export default router;
