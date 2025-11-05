// /Users/nikita/Desktop/EDPROWISE_Nikita_FINAL/Edprowise_Backend/Edprowise-Micro-Backend/Finance-Module/routes/inter-service-communication.js

import express from "express";

import { addInReceiptForFees } from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.post("/add-receipt-for-fees", addInReceiptForFees);

export default router;
