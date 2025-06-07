import express from "express";
const router = express.Router();
import roleBasedMiddleware from "../middleware/index.js";

import {
  getBySellerIdAndEnquiryNumber,
  getBySellerId,
} from "../controllers/QuoteProposal/index.js";

router.get(
  "/quote-proposal",
  roleBasedMiddleware("Seller", "Admin", "School"),
  getBySellerIdAndEnquiryNumber
);

router.get("/quote-proposal-by-seller-id/:sellerId", getBySellerId);

export default router;
