import express from "express";
const router = express.Router();
import roleBasedMiddleware from "../middleware/index.js";

import {
  createHeadOfAccount,
  getAllHeadOfAccount,
  updateHeadOfAccount,
  deleteHeadOfAccount,
  findHeadOfAccountByName,
  deleteAllHeadOfAccountBySchoolAndFinancialYear,
} from "../controllers/Setting/Ledger/HeadOfAccount/index.js";

router.post(
  "/create-head-of-account",
  roleBasedMiddleware("School"),
  createHeadOfAccount
);

router.get(
  "/get-all-head-of-account/:financialYear",
  roleBasedMiddleware("School"),
  getAllHeadOfAccount
);

router.put(
  "/update-head-of-account-by-id/:id/:financialYear",
  roleBasedMiddleware("School"),
  updateHeadOfAccount
);

router.delete(
  "/delete-head-of-account-by-id/:id/:financialYear",
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
  deleteAllBSPLLedgerBySchoolAndFinancialYear,
} from "../controllers/Setting/Ledger/BSPLLedger/index.js";

router.post(
  "/create-bs-pl-ledger",
  roleBasedMiddleware("School"),
  createBSPLLedger
);

router.get(
  "/get-all-bs-pl-ledger/:financialYear",
  roleBasedMiddleware("School"),
  getAllBSPLLedgerBySchoolId
);

router.get(
  "/get-all-bs-pl-ledger-by-head-of-account-id/:headOfAccountId/:financialYear",
  roleBasedMiddleware("School"),
  getAllByHeadOfAccountId
);

router.put(
  "/update-bs-pl-ledger-by-id/:id/:financialYear",
  roleBasedMiddleware("School"),
  updateBSPLLedgerById
);

router.delete(
  "/delete-bs-pl-ledger-by-id/:id/:financialYear",
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
  getAllByFixedAssets,
  getAllGroupLedgerBySchoolIdWithDate,
  deleteAllGroupLedgerBySchoolAndFinancialYear,
} from "../controllers/Setting/Ledger/GroupLedger/index.js";

router.post(
  "/create-group-ledger",
  roleBasedMiddleware("School"),
  createGroupLedger
);

router.get(
  "/get-all-group-ledger/:financialYear",
  roleBasedMiddleware("School"),
  getAllGroupLedgerBySchoolId
);

router.get(
  "/get-all-group-ledger-with-date/:financialYear",
  roleBasedMiddleware("School"),
  getAllGroupLedgerBySchoolIdWithDate
);

router.get(
  "/get-all-group-ledger-by-fixed-assets/:financialYear",
  roleBasedMiddleware("School"),
  getAllByFixedAssets
);

router.get(
  "/get-all-group-ledger-by-bs-and-pl-ledger-id/:bSPLLedgerId/:financialYear",
  roleBasedMiddleware("School"),
  getAllByBSPLLedgerId
);

router.put(
  "/update-group-ledger-by-id/:id/:financialYear",
  roleBasedMiddleware("School"),
  updateGroupLedgerById
);

router.delete(
  "/delete-group-ledger-by-id/:id/:financialYear",
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
  getAllLedgerByGroupLedgerId,
  getAllBySchoolIdWithDate,
  getAllByBankAndBankFixedDeposits,
  deleteAllBySchoolAndFinancialYear,
} from "../controllers/Setting/Ledger/Ledger/index.js";

router.post("/create-ledger", roleBasedMiddleware("School"), createLedger);

router.get(
  "/get-all-ledger/:financialYear",
  roleBasedMiddleware("School"),
  getAllLedgerBySchoolId
);

router.get(
  "/get-all-ledger-with-date/:financialYear",
  roleBasedMiddleware("School"),
  getAllBySchoolIdWithDate
);

router.get(
  "/get-all-ledger-by-name/:financialYear",
  roleBasedMiddleware("School"),
  getAllLedgerByName
);

router.get(
  "/get-all-ledger-by-bank-name/:financialYear",
  roleBasedMiddleware("School"),
  getAllLedgerByBankName
);

router.get(
  "/get-all-ledger-by-bank-and-fixed-deposits-name/:financialYear",
  roleBasedMiddleware("School"),
  getAllByBankAndBankFixedDeposits
);

router.get(
  "/get-ledger-by-cash-name/:financialYear",
  roleBasedMiddleware("School"),
  getAllLedgerByCashName
);

router.get(
  "/get-all-ledger-by-payment-mode/:paymentMode/:financialYear",
  roleBasedMiddleware("School"),
  getAllByPaymentMode
);

router.get(
  "/get-all-ledger-by-group-ledger-id/:groupLedgerId/:financialYear",
  roleBasedMiddleware("School"),
  getAllLedgerByGroupLedgerId
);

router.put(
  "/update-ledger-by-id/:id/:financialYear",
  roleBasedMiddleware("School"),
  updateLedgerById
);

router.put(
  "/update-ledger-payment-mode-by-id/:id/:financialYear",
  roleBasedMiddleware("School"),
  updatePaymentModeById
);

router.delete(
  "/delete-ledger-by-id/:id/:financialYear",
  roleBasedMiddleware("School"),
  deleteLedgerById
);

router.delete(
  "/delete-all-ledgers-for-test/:financialYear/:schoolId",
  deleteAllBySchoolAndFinancialYear
);

router.delete(
  "/delete-all-group-ledgers-for-test/:financialYear/:schoolId",
  deleteAllGroupLedgerBySchoolAndFinancialYear
);

router.delete(
  "/delete-all-bspl-ledgers-for-test/:financialYear/:schoolId",
  deleteAllBSPLLedgerBySchoolAndFinancialYear
);

router.delete(
  "/delete-all-headofaccount-ledgers-for-test/:financialYear/:schoolId",
  deleteAllHeadOfAccountBySchoolAndFinancialYear
);

router.post(
  "/find-ledger-by-name",
  roleBasedMiddleware("School"),
  findLedgerByName
);

export default router;
