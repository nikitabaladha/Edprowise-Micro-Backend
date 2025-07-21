import express from "express";
const router = express.Router();

import roleBasedMiddleware from "../middleware/index.js";

import upload from "../UploadFiles/ContraImageFiles.js";

import {
  createContra,
  getAllContraBySchoolId,
  cancelContraById,
  updateContraById,
  dreaftContra,
  updateDraftContraById,
  getAllLedgerByNameWithTDSorTCS,
} from "../controllers/AccountEntry/Contra/index.js";

router.post(
  "/create-contra",
  upload,
  roleBasedMiddleware("School"),
  createContra
);

router.get(
  "/get-all-contra/:academicYear",
  roleBasedMiddleware("School"),
  getAllContraBySchoolId
);

router.post(
  "/draft-contra",
  upload,
  roleBasedMiddleware("School"),
  dreaftContra
);

router.put(
  "/update-contra/:id/:academicYear",
  upload,
  roleBasedMiddleware("School"),
  updateContraById
);

router.put(
  "/update-draft-contra/:id/:academicYear",
  upload,
  roleBasedMiddleware("School"),
  updateDraftContraById
);

router.put(
  "/cancel-contra/:id/:academicYear",
  roleBasedMiddleware("School"),
  cancelContraById
);

router.get(
  "/get-contra-with-ledger-by-tds-tcs/:id/:academicYear",
  roleBasedMiddleware("School"),
  getAllLedgerByNameWithTDSorTCS
);

export default router;
