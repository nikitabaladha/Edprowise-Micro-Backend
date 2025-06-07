import express from "express";

import {
  checkEmailExists,
  requiredFieldFromSchoolProfile,
  sellerByDealingProducts,
  requiredFieldFromSellerProfile,
  bulkRequiredFieldsFromSellerProfile,
  requiredFieldFromEdprowise,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.post("/check-email-exists", checkEmailExists);

router.get(
  "/required-field-from-school-profile/:schoolId",
  requiredFieldFromSchoolProfile
);

router.get(
  "/required-field-from-seller-profile/:sellerId",
  requiredFieldFromSellerProfile
);

router.get(
  "/bulk-required-fields-from-seller-profile",
  bulkRequiredFieldsFromSellerProfile
);

router.get("/seller-by-dealing-products/:sellerId", sellerByDealingProducts);

router.get(
  "/required-field-from-edprowise-profile",
  requiredFieldFromEdprowise
);

export default router;
