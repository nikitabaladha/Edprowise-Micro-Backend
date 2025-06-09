import express from "express";

import { getOrderFromBuyerByEnquiryNumbers } from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.get("/get-order-from-buyer", getOrderFromBuyerByEnquiryNumbers);

export default router;
