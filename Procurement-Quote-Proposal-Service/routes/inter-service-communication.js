import express from "express";

import {
  getSubmitQuoteBySellerIdAndEnqNos,
  getPrepareQuotes,
  updateSubmitQuoteStatus,
  getSubmitQuoteBySellerIdsAndEnqNo,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.get(
  "/submitquote-by-Sellerid-and-enq-nos",
  getSubmitQuoteBySellerIdAndEnqNos
);

router.get(
  "/submitquote-by-Sellerids-and-enq-no",
  getSubmitQuoteBySellerIdsAndEnqNo
);

router.get("/get-prepare-quotes", getPrepareQuotes);

router.put("/update-submitquote-by-status", updateSubmitQuoteStatus);

export default router;
