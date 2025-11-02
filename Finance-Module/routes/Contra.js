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
  updateApprovalStatusById,
  deleteContraEntryById,
} from "../controllers/AccountEntry/Contra/index.js";

router.post(
  "/create-contra",
  upload,
  roleBasedMiddleware("School"),
  createContra
);

router.get(
  "/get-all-contra/:financialYear",
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
  "/update-contra/:id/:financialYear",
  upload,
  roleBasedMiddleware("School"),
  updateContraById
);

router.put(
  "/update-approval-status-for-contra/:id/:financialYear",
  roleBasedMiddleware("School"),
  updateApprovalStatusById
);

router.put(
  "/update-draft-contra/:id/:financialYear",
  upload,
  roleBasedMiddleware("School"),
  updateDraftContraById
);

router.put(
  "/cancel-contra/:id/:financialYear",
  roleBasedMiddleware("School"),
  cancelContraById
);

router.get(
  "/get-contra-with-ledger-by-tds-tcs/:id/:financialYear",
  roleBasedMiddleware("School"),
  getAllLedgerByNameWithTDSorTCS
);

router.delete(
  "/delete-contra-entry/:id/:financialYear",
  roleBasedMiddleware("School"),
  deleteContraEntryById
);

export default router;
