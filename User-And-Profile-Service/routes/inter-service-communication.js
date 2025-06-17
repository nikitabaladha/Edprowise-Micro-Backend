import express from "express";

import {
  checkEmailExists,
  requiredFieldFromSchoolProfile,
  sellerByDealingProducts,
  requiredFieldFromSellerProfile,
  bulkRequiredFieldsFromSellerProfile,
  requiredFieldFromEdprowise,
  getAllAdminWithRequiredFields,
  getRequiredFieldsBySellerIds,
  getSchoolsByIds,
  requiredFieldFromUser,
  requiredFieldFromSeller,
  getSchoolByEmailId,
  getSellerProfileByEmailId,
  getUserBySchoolId,
  getSellerById,
  getAllSchoolWithRequiredFields,
  getAllSellerWithRequiredFields,
  sellersByProducts,
  searchSchools,
  searchSellers,
} from "../controllers/Inter-Service-Communication/index.js";

const router = express.Router();

router.get("/get-school-by-emailid/:schoolEmail", getSchoolByEmailId);

router.get("/get-sellerprofile-by-emailid/:emailId", getSellerProfileByEmailId);

router.get("/get-user-by-schoolid/:schoolId", getUserBySchoolId);

router.get("/get-seller-by-id/:_id", getSellerById);

router.get("/check-email-exists", checkEmailExists);

router.get("/get-school-by-ids", getSchoolsByIds);

router.get(
  "/required-field-from-seller-profile/:sellerId",
  requiredFieldFromSellerProfile
);

router.get("/required-field-from-user/:userId", requiredFieldFromUser);

router.get(
  "/required-field-from-school-profile/:schoolId",
  requiredFieldFromSchoolProfile
);

router.get("/required-field-from-seller/:userId", requiredFieldFromSeller);

router.get(
  "/bulk-required-fields-from-seller-profile",
  bulkRequiredFieldsFromSellerProfile
);

router.get("/seller-by-dealing-products/:sellerId", sellerByDealingProducts);

router.get(
  "/required-field-from-edprowise-profile",
  requiredFieldFromEdprowise
);

router.get("/required-field-by-sellerids", getRequiredFieldsBySellerIds);

router.get("/required-field-from-all-admins", getAllAdminWithRequiredFields);

router.get("/required-field-from-all-schools", getAllSchoolWithRequiredFields);

router.get("/required-field-from-all-sellers", getAllSellerWithRequiredFields);

router.get("/sellers-by-products", sellersByProducts);

router.get("/search-schools", searchSchools);

router.get("/search-sellers", searchSellers);

export default router;
