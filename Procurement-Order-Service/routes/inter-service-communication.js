import express from "express";

import {
  getOrderFromBuyerByEnquiryNumbers,
  getOrderDetailsFromSellerBySchooIdSellerId,
  getOrderFromBuyerByOrdNo,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.get("/get-order-from-buyer", getOrderFromBuyerByEnquiryNumbers);

router.get(
  "/get-order-from-seller",
  getOrderDetailsFromSellerBySchooIdSellerId
);
router.get("/get-order-from-buyer-by-ord-no", getOrderFromBuyerByOrdNo);

export default router;
