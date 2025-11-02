import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";
import upload from "../UploadFiles/JournalImageFiles.js";

import {
  createJournal,
  getAllJournalBySchoolId,
  getAllLedgerByNameWithTDSorTCS,
  cancelJournalById,
  updateJournalById,
  dreaftJournal,
  updateDraftJournalById,
  updateApprovalStatusById,
  deleteJournalEntryById,
} from "../controllers/AccountEntry/Journal/index.js";

router.post(
  "/create-Journal",
  upload,
  roleBasedMiddleware("School"),
  createJournal
);

router.get(
  "/get-all-Journal/:financialYear",
  roleBasedMiddleware("School"),
  getAllJournalBySchoolId
);

router.post(
  "/draft-Journal",
  upload,
  roleBasedMiddleware("School"),
  dreaftJournal
);

router.put(
  "/update-Journal/:id/:financialYear",
  upload,
  roleBasedMiddleware("School"),
  updateJournalById
);

router.put(
  "/update-approval-status-for-journal/:id/:financialYear",
  roleBasedMiddleware("School"),
  updateApprovalStatusById
);

router.put(
  "/update-draft-Journal/:id/:financialYear",
  upload,
  roleBasedMiddleware("School"),
  updateDraftJournalById
);

router.put(
  "/cancel-Journal/:id/:financialYear",
  roleBasedMiddleware("School"),
  cancelJournalById
);

router.get(
  "/get-journal-with-ledger-by-tds-tcs/:id/:financialYear",
  roleBasedMiddleware("School"),
  getAllLedgerByNameWithTDSorTCS
);

router.delete(
  "/delete-journal-entry/:id/:financialYear",
  roleBasedMiddleware("School"),
  deleteJournalEntryById
);

export default router;
