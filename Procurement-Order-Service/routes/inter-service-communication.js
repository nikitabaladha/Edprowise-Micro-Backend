import express from "express";

import {
  getOrderFromBuyerByEnquiryNumbers,
  getOrderDetailsFromSellerBySchooIdSellerId,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.get("/get-order-from-buyer", getOrderFromBuyerByEnquiryNumbers);

router.get(
  "/get-order-from-seller",
  getOrderDetailsFromSellerBySchooIdSellerId
);

export default router;
