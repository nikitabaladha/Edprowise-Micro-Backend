import express from "express";

import {
  getQuoteRequestByEnquiryNumber,
  updateQuoteRequestStatus,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.get("/quote-requests/:enquiryNumber", getQuoteRequestByEnquiryNumber);

router.put("/quote-requests/:enquiryNumber/status", updateQuoteRequestStatus);

export default router;
