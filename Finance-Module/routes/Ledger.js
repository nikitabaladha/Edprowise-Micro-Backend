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

export default router;
