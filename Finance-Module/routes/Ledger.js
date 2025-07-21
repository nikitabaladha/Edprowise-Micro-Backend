import express from "express";
const router = express.Router();
import roleBasedMiddleware from "../middleware/index.js";

import {
  createHeadOfAccount,
  getAllHeadOfAccount,
  updateHeadOfAccount,
  deleteHeadOfAccount,
  findHeadOfAccountByName,
} from "../controllers/Setting/Ledger/HeadOfAccount/index.js";

router.post(
  "/create-head-of-account",
  roleBasedMiddleware("School"),
  createHeadOfAccount
);

router.get(
  "/get-all-head-of-account/:academicYear",
  roleBasedMiddleware("School"),
  getAllHeadOfAccount
);

router.put(
  "/update-head-of-account-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  updateHeadOfAccount
);

router.delete(
  "/delete-head-of-account-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  deleteHeadOfAccount
);

router.post(
  "/find-head-of-account-by-name",
  roleBasedMiddleware("School"),
  findHeadOfAccountByName
);

import {
  createBSPLLedger,
  getAllBSPLLedgerBySchoolId,
  updateBSPLLedgerById,
  deleteBSPLLedgerById,
  getAllByHeadOfAccountId,
  findBSPLLedgerByName,
} from "../controllers/Setting/Ledger/BSPLLedger/index.js";

router.post(
  "/create-bs-pl-ledger",
  roleBasedMiddleware("School"),
  createBSPLLedger
);

router.get(
  "/get-all-bs-pl-ledger/:academicYear",
  roleBasedMiddleware("School"),
  getAllBSPLLedgerBySchoolId
);

router.get(
  "/get-all-bs-pl-ledger-by-head-of-account-id/:headOfAccountId/:academicYear",
  roleBasedMiddleware("School"),
  getAllByHeadOfAccountId
);

router.put(
  "/update-bs-pl-ledger-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  updateBSPLLedgerById
);

router.delete(
  "/delete-bs-pl-ledger-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  deleteBSPLLedgerById
);

router.post(
  "/find-bs-pl-ledger-by-name",
  roleBasedMiddleware("School"),
  findBSPLLedgerByName
);

import {
  createGroupLedger,
  getAllGroupLedgerBySchoolId,
  updateGroupLedgerById,
  deleteGroupLedgerById,
  getAllByBSPLLedgerId,
  findGroupLedgerByName,
} from "../controllers/Setting/Ledger/GroupLedger/index.js";

router.post(
  "/create-group-ledger",
  roleBasedMiddleware("School"),
  createGroupLedger
);

router.get(
  "/get-all-group-ledger/:academicYear",
  roleBasedMiddleware("School"),
  getAllGroupLedgerBySchoolId
);

router.get(
  "/get-all-group-ledger-by-bs-and-pl-ledger-id/:bSPLLedgerId/:academicYear",
  roleBasedMiddleware("School"),
  getAllByBSPLLedgerId
);

router.put(
  "/update-group-ledger-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  updateGroupLedgerById
);

router.delete(
  "/delete-group-ledger-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  deleteGroupLedgerById
);

router.post(
  "/find-group-ledger-by-name",
  roleBasedMiddleware("School"),
  findGroupLedgerByName
);

import {
  createLedger,
  getAllLedgerBySchoolId,
  updateLedgerById,
  deleteLedgerById,
  getAllLedgerByName,
  updatePaymentModeById,
  getAllByPaymentMode,
  findLedgerByName,
  getAllLedgerByBankName,
  getAllLedgerByCashName,
} from "../controllers/Setting/Ledger/Ledger/index.js";

router.post("/create-ledger", roleBasedMiddleware("School"), createLedger);

router.get(
  "/get-all-ledger/:academicYear",
  roleBasedMiddleware("School"),
  getAllLedgerBySchoolId
);

router.get(
  "/get-all-ledger-by-name/:academicYear",
  roleBasedMiddleware("School"),
  getAllLedgerByName
);

router.get(
  "/get-all-ledger-by-bank-name/:academicYear",
  roleBasedMiddleware("School"),
  getAllLedgerByBankName
);

router.get(
  "/get-ledger-by-cash-name/:academicYear",
  roleBasedMiddleware("School"),
  getAllLedgerByCashName
);

router.get(
  "/get-all-ledger-by-payment-mode/:paymentMode/:academicYear",
  roleBasedMiddleware("School"),
  getAllByPaymentMode
);

router.put(
  "/update-ledger-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  updateLedgerById
);

router.put(
  "/update-ledger-payment-mode-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  updatePaymentModeById
);

router.delete(
  "/delete-ledger-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  deleteLedgerById
);

router.post(
  "/find-ledger-by-name",
  roleBasedMiddleware("School"),
  findLedgerByName
);

export default router;
