// Finance-Module/routes/inter-service-communication.js
import express from "express";

import {
  addInReceiptForFees,
  batchProcessFeesPayments,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.post("/add-receipt-for-fees", addInReceiptForFees);
router.post("/batch-process-fees-payments", batchProcessFeesPayments);

export default router;
