// Finance-Module/routes/inter-service-communication.js
import express from "express";

import {
  batchProcessFeesPayments,
  batchProcessFeesRefund,
  addLedgerForFeesType,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.post("/batch-process-fees-payments", batchProcessFeesPayments);
router.post("/batch-process-fees-refund", batchProcessFeesRefund);
router.post("/add-ledger-for-feestype", addLedgerForFeesType);

export default router;
