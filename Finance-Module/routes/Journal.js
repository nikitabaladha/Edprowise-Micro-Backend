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
} from "../controllers/AccountEntry/Journal/index.js";

router.post(
  "/create-Journal",
  upload,
  roleBasedMiddleware("School"),
  createJournal
);

router.get(
  "/get-all-Journal/:academicYear",
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
  "/update-Journal/:id/:academicYear",
  upload,
  roleBasedMiddleware("School"),
  updateJournalById
);

router.put(
  "/update-draft-Journal/:id/:academicYear",
  upload,
  roleBasedMiddleware("School"),
  updateDraftJournalById
);

router.put(
  "/cancel-Journal/:id/:academicYear",
  roleBasedMiddleware("School"),
  cancelJournalById
);

router.get(
  "/get-journal-with-ledger-by-tds-tcs/:id/:academicYear",
  roleBasedMiddleware("School"),
  getAllLedgerByNameWithTDSorTCS
);

export default router;
