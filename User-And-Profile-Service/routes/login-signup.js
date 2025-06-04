import express from "express";

import roleBasedMiddleware from "../middleware/index.js";
import {
  adminSignup,
  adminLogin,
  userLogin,
  userSignup,
  changeSellerPassword,
  changeSchoolAdminPassword,
  changeEdprowiseAdminPassword,
  getUserEmailByUserId,
  resetUserOrSellerPassword,
} from "../controllers/Signup-Login/index.js";

const router = express.Router();

// Define routes
router.post("/admin-signup", adminSignup);
router.post("/admin-login", adminLogin);
router.post("/user-login", userLogin);
router.post("/user-signup", userSignup);

router.put(
  "/change-seller-password",
  roleBasedMiddleware("Seller"),
  changeSellerPassword
);

router.put(
  "/change-school-admin-password",
  roleBasedMiddleware("School"),
  changeSchoolAdminPassword
);

router.put(
  "/change-edprowise-admin-password",
  roleBasedMiddleware("Admin"),
  changeEdprowiseAdminPassword
);

router.get("/get-user-email-by-userId/:userId", getUserEmailByUserId);

router.put("/reset-user-or-seller-password", resetUserOrSellerPassword);

export default router;
