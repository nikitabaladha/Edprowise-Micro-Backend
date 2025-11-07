// Finance-Module/routes/inter-service-communication.js
import express from "express";

import {
  batchProcessFeesPayments,
  batchProcessFeesRefund,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.post("/batch-process-fees-payments", batchProcessFeesPayments);
router.post("/batch-process-fees-refund", batchProcessFeesRefund);

export default router;
