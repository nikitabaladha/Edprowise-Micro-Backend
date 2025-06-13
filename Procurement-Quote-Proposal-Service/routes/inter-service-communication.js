import express from "express";

import {
  getSubmitQuoteBySellerIdAndEnqNos,
  getPrepareQuotes,
  updateSubmitQuoteStatus,
  getSubmitQuoteBySellerIdsAndEnqNo,
  updateQuoteProposal,
  getQuoteProposal,
  getPrepareQuoteBySellerIdsAndEnqNos,
  getQuoteProposalBySellerIdsAndEnqNos,
  getSubmitQuoteBySellerIdsAndEnqNos,
  getQuoteProposalBySellerIdEnqNoQuoteNo,
  getSubmitQuoteBySellerIdAndEnqNo,
  getPrepareQuoteBySellerIdAndEnqNo,
  getQuoteProposalBySellerId,
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

router.get(
  "/submitquote-by-Sellerid-and-enqno",
  getSubmitQuoteBySellerIdAndEnqNo
);

router.get(
  "/quote-proposal-by-Sellerids-and-enq-nos",
  getQuoteProposalBySellerIdsAndEnqNos
);

router.get(
  "/prepare-quote-by-Sellerid-and-enqno",
  getPrepareQuoteBySellerIdAndEnqNo
);

router.get(
  "/quote-proposal-by-Sellerid-enqno-quoteno",
  getQuoteProposalBySellerIdEnqNoQuoteNo
);

router.get(
  "/submitquote-by-Sellerids-and-enq-nos",
  getSubmitQuoteBySellerIdsAndEnqNos
);

router.get(
  "/preparequote-by-Sellerids-and-enq-nos",
  getPrepareQuoteBySellerIdsAndEnqNos
);

router.get("/get-prepare-quotes", getPrepareQuotes);

router.get("/get-quote-proposal", getQuoteProposal);

router.put("/update-submitquote-by-status", updateSubmitQuoteStatus);

router.put("/update-quote-proposal", updateQuoteProposal);

router.get(
  "/quote-proposal-by-seller-id/:sellerId",
  getQuoteProposalBySellerId
);

export default router;
