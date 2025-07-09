import express from "express";
const router = express.Router();
import roleBasedMiddleware from "../middleware/index.js";

import {
  createVendor,
  getAllVendorBySchoolId,
  updateVendorById,
  deleteVendorById,
  getOneByVendorCode,
} from "../controllers/Setting/Vendor/index.js";

router.post("/create-Vendor", roleBasedMiddleware("School"), createVendor);

router.get(
  "/get-all-vendor/:academicYear",
  roleBasedMiddleware("School"),
  getAllVendorBySchoolId
);

router.get(
  "/get-one-by-vendor-code/:vendorCode/:academicYear",
  roleBasedMiddleware("School"),
  getOneByVendorCode
);

router.put(
  "/update-vendor-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  updateVendorById
);

router.delete(
  "/delete-vendor-by-id/:id/:academicYear",
  roleBasedMiddleware("School"),
  deleteVendorById
);

export default router;
