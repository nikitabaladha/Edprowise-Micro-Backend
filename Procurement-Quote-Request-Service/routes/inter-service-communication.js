import express from "express";

import {
  getQuoteRequestByEnquiryNumber,
  updateQuoteRequestStatus,
  updateQuoteRequest,
  getQuoteRequestByEnqNos,
  getQuoteRequestBySchoolIdAndEnqNos,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.get("/quote-requests/:enquiryNumber", getQuoteRequestByEnquiryNumber);

router.get("/quote-request-by-enqnos", getQuoteRequestByEnqNos);

router.get(
  "/quote-request-by-schoolid-enqnos",
  getQuoteRequestBySchoolIdAndEnqNos
);

router.put("/quote-requests/:enquiryNumber/status", updateQuoteRequestStatus);

router.put("/update-quote-request", updateQuoteRequest);

export default router;
