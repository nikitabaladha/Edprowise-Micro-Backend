import express from "express";
const router = express.Router();
import roleBasedMiddleware from "../middleware/index.js";

import {
  createHeadOfAccount,
  getAllHeadOfAccount,
  updateHeadOfAccount,
  deleteHeadOfAccount,
} from "../controllers/Setting/Ledger/HeadOfAccount/index.js";

router.post(
  "/create-head-of-account",
  roleBasedMiddleware("School"),
  createHeadOfAccount
);

router.get(
  "/get-all-head-of-account",
  roleBasedMiddleware("School"),
  getAllHeadOfAccount
);

router.put(
  "/update-head-of-account-by-id/:id",
  roleBasedMiddleware("School"),
  updateHeadOfAccount
);

router.delete(
  "/delete-head-of-account-by-id/:id",
  roleBasedMiddleware("School"),
  deleteHeadOfAccount
);

import {
  createBSPLLedger,
  getAllBSPLLedgerBySchoolId,
  updateBSPLLedgerById,
  deleteBSPLLedgerById,
  getAllByHeadOfAccountId,
} from "../controllers/Setting/Ledger/BSPLLedger/index.js";

router.post(
  "/create-bs-pl-ledger",
  roleBasedMiddleware("School"),
  createBSPLLedger
);

router.get(
  "/get-all-bs-pl-ledger",
  roleBasedMiddleware("School"),
  getAllBSPLLedgerBySchoolId
);

router.get(
  "/get-all-bs-pl-ledger-by-head-of-account-id/:headOfAccountId",
  roleBasedMiddleware("School"),
  getAllByHeadOfAccountId
);

router.put(
  "/update-bs-pl-ledger-by-id/:id",
  roleBasedMiddleware("School"),
  updateBSPLLedgerById
);

router.delete(
  "/delete-bs-pl-ledger-by-id/:id",
  roleBasedMiddleware("School"),
  deleteBSPLLedgerById
);

import {
  createGroupLedger,
  getAllGroupLedgerBySchoolId,
  updateGroupLedgerById,
  deleteGroupLedgerById,
  getAllByBSPLLedgerId,
} from "../controllers/Setting/Ledger/GroupLedger/index.js";

router.post(
  "/create-group-ledger",
  roleBasedMiddleware("School"),
  createGroupLedger
);

router.get(
  "/get-all-group-ledger",
  roleBasedMiddleware("School"),
  getAllGroupLedgerBySchoolId
);

router.get(
  "/get-all-group-ledger-by-bs-and-pl-ledger-id/:bSPLLedgerId",
  roleBasedMiddleware("School"),
  getAllByBSPLLedgerId
);

router.put(
  "/update-group-ledger-by-id/:id",
  roleBasedMiddleware("School"),
  updateGroupLedgerById
);

router.delete(
  "/delete-group-ledger-by-id/:id",
  roleBasedMiddleware("School"),
  deleteGroupLedgerById
);

import {
  createLedger,
  getAllLedgerBySchoolId,
  updateLedgerById,
  deleteLedgerById,
  getAllLedgerByName,
  updatePaymentModeById,
  getAllByPaymentMode,
} from "../controllers/Setting/Ledger/Ledger/index.js";

router.post("/create-ledger", roleBasedMiddleware("School"), createLedger);

router.get(
  "/get-all-ledger",
  roleBasedMiddleware("School"),
  getAllLedgerBySchoolId
);

router.get(
  "/get-all-ledger-by-name",
  roleBasedMiddleware("School"),
  getAllLedgerByName
);

router.get(
  "/get-all-ledger-by-name-payment-mode/:paymentMode",
  roleBasedMiddleware("School"),
  getAllByPaymentMode
);

router.put(
  "/update-ledger-by-id/:id",
  roleBasedMiddleware("School"),
  updateLedgerById
);

router.put(
  "/update-ledger-payment-mode-by-id/:id",
  roleBasedMiddleware("School"),
  updatePaymentModeById
);

router.delete(
  "/delete-ledger-by-id/:id",
  roleBasedMiddleware("School"),
  deleteLedgerById
);

export default router;
